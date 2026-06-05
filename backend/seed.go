package main

import (
	"database/sql"
	"fmt"
	"log"
)

func SeedDB(db *sql.DB) error {
	log.Println("Seeding database with test data...")

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// VLANs
	vlans := []struct {
		vid         int
		name        string
		description string
		status      string
	}{
		{1, "Management", "Nätverksutrustning och servermanagement", "active"},
		{10, "Servers", "Interna applikationsservrar", "active"},
		{20, "DMZ", "Demilitariserad zon för publika tjänster", "active"},
		{100, "Clients", "Klientdatorer och arbetsstationer", "active"},
		{200, "GuestWiFi", "Gäst-WiFi med begränsad åtkomst", "active"},
		{300, "VoIP", "IP-telefoni", "reserved"},
		{999, "Legacy", "Äldre system under avveckling", "deprecated"},
	}

	vlanIDs := map[string]int64{}
	for _, v := range vlans {
		res, err := tx.Exec(
			`INSERT INTO vlans (vid, name, description, status) VALUES (?, ?, ?, ?)`,
			v.vid, v.name, v.description, v.status,
		)
		if err != nil {
			return fmt.Errorf("insert vlan %d: %w", v.vid, err)
		}
		id, _ := res.LastInsertId()
		vlanIDs[v.name] = id
	}

	// Prefixes — parent_id sätts med namn för läsbarhet
	type prefixRow struct {
		prefix      string
		name        string
		description string
		status      string
		parentName  string
		vlanName    string
	}

	prefixes := []prefixRow{
		// Aggregat
		{"10.0.0.0/8", "RFC1918-10", "Privat adressrymd klass A", "active", "", ""},
		{"172.16.0.0/12", "RFC1918-172", "Privat adressrymd klass B", "active", "", ""},
		{"192.168.0.0/16", "RFC1918-192", "Privat adressrymd klass C", "active", "", ""},

		// Management
		{"10.0.0.0/24", "Management-LAN", "Managementnät för switchar och routrar", "active", "RFC1918-10", "Management"},

		// Servers
		{"10.10.0.0/16", "Servers", "Serverblock", "active", "RFC1918-10", ""},
		{"10.10.1.0/24", "Web-Servers", "Webbservrar", "active", "Servers", "Servers"},
		{"10.10.2.0/24", "DB-Servers", "Databasservrar", "active", "Servers", "Servers"},
		{"10.10.3.0/24", "App-Servers", "Applikationsservrar", "active", "Servers", "Servers"},

		// DMZ
		{"10.20.0.0/24", "DMZ", "Demilitariserad zon", "active", "RFC1918-10", "DMZ"},

		// Clients
		{"10.100.0.0/16", "Clients", "Klientblock", "active", "RFC1918-10", ""},
		{"10.100.1.0/24", "Clients-Floor1", "Klienter våning 1", "active", "Clients", "Clients"},
		{"10.100.2.0/24", "Clients-Floor2", "Klienter våning 2", "active", "Clients", "Clients"},
		{"10.100.3.0/24", "Clients-Floor3", "Klienter våning 3", "reserved", "Clients", "Clients"},

		// Guest
		{"192.168.100.0/24", "GuestWiFi", "Gäst-WiFi", "active", "RFC1918-192", "GuestWiFi"},

		// VoIP
		{"172.16.10.0/24", "VoIP", "IP-telefoni", "reserved", "RFC1918-172", "VoIP"},
	}

	prefixIDs := map[string]int64{}
	for _, p := range prefixes {
		var parentID, vlanID *int64
		if p.parentName != "" {
			if id, ok := prefixIDs[p.parentName]; ok {
				parentID = &id
			}
		}
		if p.vlanName != "" {
			if id, ok := vlanIDs[p.vlanName]; ok {
				vlanID = &id
			}
		}

		res, err := tx.Exec(
			`INSERT INTO prefixes (prefix, name, description, status, parent_id, vlan_id) VALUES (?, ?, ?, ?, ?, ?)`,
			p.prefix, p.name, p.description, p.status, parentID, vlanID,
		)
		if err != nil {
			return fmt.Errorf("insert prefix %s: %w", p.prefix, err)
		}
		id, _ := res.LastInsertId()
		prefixIDs[p.name] = id
	}

	// IP addresses
	type addrRow struct {
		address     string
		hostname    string
		dnsName     string
		description string
		status      string
		prefixName  string
	}

	addresses := []addrRow{
		// Management
		{"10.0.0.1", "gw-mgmt", "gw-mgmt.infra.local", "Management-gateway", "active", "Management-LAN"},
		{"10.0.0.2", "sw-core-01", "sw-core-01.infra.local", "Core-switch 1", "active", "Management-LAN"},
		{"10.0.0.3", "sw-core-02", "sw-core-02.infra.local", "Core-switch 2", "active", "Management-LAN"},
		{"10.0.0.10", "mgmt-server", "mgmt.infra.local", "Managementserver (Ansible/Zabbix)", "active", "Management-LAN"},
		{"10.0.0.20", "ups-01", "ups-01.infra.local", "UPS nätverkskort", "active", "Management-LAN"},

		// Web servers
		{"10.10.1.1", "gw-web", "gw-web.infra.local", "Gateway webb-nät", "active", "Web-Servers"},
		{"10.10.1.10", "web-01", "web01.example.com", "Webbserver 1 (nginx)", "active", "Web-Servers"},
		{"10.10.1.11", "web-02", "web02.example.com", "Webbserver 2 (nginx)", "active", "Web-Servers"},
		{"10.10.1.20", "lb-01", "lb.example.com", "Load balancer (HAProxy)", "active", "Web-Servers"},

		// DB servers
		{"10.10.2.1", "gw-db", "gw-db.infra.local", "Gateway DB-nät", "active", "DB-Servers"},
		{"10.10.2.10", "db-01", "db01.infra.local", "PostgreSQL primär", "active", "DB-Servers"},
		{"10.10.2.11", "db-02", "db02.infra.local", "PostgreSQL replika", "active", "DB-Servers"},
		{"10.10.2.12", "redis-01", "redis01.infra.local", "Redis cache", "active", "DB-Servers"},

		// App servers
		{"10.10.3.10", "app-01", "app01.infra.local", "Applikationsserver 1", "active", "App-Servers"},
		{"10.10.3.11", "app-02", "app02.infra.local", "Applikationsserver 2", "active", "App-Servers"},
		{"10.10.3.12", "app-03", "app03.infra.local", "Applikationsserver 3 (staging)", "reserved", "App-Servers"},

		// DMZ
		{"10.20.0.1", "fw-dmz", "fw-dmz.infra.local", "Brandvägg mot DMZ", "active", "DMZ"},
		{"10.20.0.10", "mail-gw", "mail.example.com", "E-postgateway", "active", "DMZ"},
		{"10.20.0.11", "vpn-gw", "vpn.example.com", "VPN-gateway", "active", "DMZ"},
		{"10.20.0.20", "proxy-01", "proxy.example.com", "Reverse proxy", "active", "DMZ"},

		// Clients Floor 1
		{"10.100.1.1", "gw-f1", "gw-f1.infra.local", "Gateway våning 1", "active", "Clients-Floor1"},
		{"10.100.1.10", "pc-f1-01", "pc-f1-01.clients.local", "Klientdator Jonas B", "active", "Clients-Floor1"},
		{"10.100.1.11", "pc-f1-02", "pc-f1-02.clients.local", "Klientdator Anna K", "active", "Clients-Floor1"},
		{"10.100.1.12", "pc-f1-03", "pc-f1-03.clients.local", "Klientdator Erik S", "active", "Clients-Floor1"},
		{"10.100.1.50", "printer-f1", "printer-f1.clients.local", "Skrivare våning 1", "active", "Clients-Floor1"},

		// Clients Floor 2
		{"10.100.2.1", "gw-f2", "gw-f2.infra.local", "Gateway våning 2", "active", "Clients-Floor2"},
		{"10.100.2.10", "pc-f2-01", "pc-f2-01.clients.local", "Klientdator Maria L", "active", "Clients-Floor2"},
		{"10.100.2.11", "pc-f2-02", "pc-f2-02.clients.local", "Klientdator Peter J", "deprecated", "Clients-Floor2"},
		{"10.100.2.50", "printer-f2", "printer-f2.clients.local", "Skrivare våning 2", "active", "Clients-Floor2"},

		// Guest WiFi
		{"192.168.100.1", "gw-guest", "gw-guest.infra.local", "Gateway gäst-WiFi", "active", "GuestWiFi"},
	}

	for _, a := range addresses {
		var prefixID *int64
		if a.prefixName != "" {
			if id, ok := prefixIDs[a.prefixName]; ok {
				prefixID = &id
			}
		}
		_, err := tx.Exec(
			`INSERT INTO ip_addresses (address, prefix_id, hostname, dns_name, description, status) VALUES (?, ?, ?, ?, ?, ?)`,
			a.address, prefixID, a.hostname, a.dnsName, a.description, a.status,
		)
		if err != nil {
			return fmt.Errorf("insert address %s: %w", a.address, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("Seed complete: %d VLANs, %d prefix, %d IP-adresser",
		len(vlans), len(prefixes), len(addresses))
	return nil
}

func dbIsEmpty(db *sql.DB) bool {
	var n int
	db.QueryRow("SELECT COUNT(*) FROM vlans").Scan(&n)
	return n == 0
}
