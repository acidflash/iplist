package main

import "time"

type VLAN struct {
	ID          int64     `json:"id"`
	Vid         int       `json:"vid"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Prefixes    []Prefix  `json:"prefixes,omitempty"`
}

type NetworkInfo struct {
	Version    int    `json:"version"`               // 4 or 6
	Network    string `json:"network"`               // network address
	Broadcast  string `json:"broadcast,omitempty"`   // IPv4 only
	Netmask    string `json:"netmask,omitempty"`     // IPv4 only, e.g. "255.255.255.0"
	Wildcard   string `json:"wildcard,omitempty"`    // IPv4 only, e.g. "0.0.0.255"
	FirstHost  string `json:"first_host"`            // first usable address
	LastHost   string `json:"last_host"`             // last usable address
	TotalHosts string `json:"total_hosts"`           // total usable hosts as string
}

type Prefix struct {
	ID          int64        `json:"id"`
	Prefix      string       `json:"prefix"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Status      string       `json:"status"`
	ParentID    *int64       `json:"parent_id"`
	VlanID      *int64       `json:"vlan_id"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	Utilization float64      `json:"utilization"`
	TotalIPs    int64        `json:"total_ips"`
	UsedIPs     int64        `json:"used_ips"`
	PendingIPs  int64        `json:"pending_ips"`
	Children    []Prefix     `json:"children,omitempty"`
	Addresses   []IPAddress  `json:"addresses,omitempty"`
	Vlan        *VLAN        `json:"vlan,omitempty"`
	NetInfo     *NetworkInfo `json:"net_info,omitempty"`
}

type IPAddress struct {
	ID          int64     `json:"id"`
	Address     string    `json:"address"`
	PrefixID    *int64    `json:"prefix_id"`
	Hostname    string    `json:"hostname"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	DNSName     string    `json:"dns_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Stats struct {
	TotalPrefixes  int     `json:"total_prefixes"`
	TotalVLANs     int     `json:"total_vlans"`
	TotalAddresses int     `json:"total_addresses"`
	Utilization    float64 `json:"utilization"`
}
