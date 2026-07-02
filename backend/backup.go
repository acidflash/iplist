package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// backupVersion is bumped whenever the backup file format changes
// incompatibly; RestoreHandler refuses files with a different version.
const backupVersion = 1

// The backup structs mirror the raw table columns (no computed fields like
// utilization), so the file format stays stable even if the API models grow.

type backupVLAN struct {
	ID          int64     `json:"id"`
	Vid         int       `json:"vid"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type backupPrefix struct {
	ID          int64     `json:"id"`
	Prefix      string    `json:"prefix"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	ParentID    *int64    `json:"parent_id"`
	VlanID      *int64    `json:"vlan_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type backupAddress struct {
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

type backupUser struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"password_hash"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type backupFile struct {
	Version   int             `json:"version"`
	CreatedAt time.Time       `json:"created_at"`
	VLANs     []backupVLAN    `json:"vlans"`
	Prefixes  []backupPrefix  `json:"prefixes"`
	Addresses []backupAddress `json:"addresses"`
	Users     []backupUser    `json:"users"`
}

func collectBackup(db *sql.DB) (*backupFile, error) {
	b := &backupFile{
		Version:   backupVersion,
		CreatedAt: time.Now(),
		VLANs:     []backupVLAN{},
		Prefixes:  []backupPrefix{},
		Addresses: []backupAddress{},
		Users:     []backupUser{},
	}

	rows, err := db.Query(`SELECT id, vid, name, description, status, created_at, updated_at FROM vlans ORDER BY id`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var v backupVLAN
		if err := rows.Scan(&v.ID, &v.Vid, &v.Name, &v.Description, &v.Status, &v.CreatedAt, &v.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		b.VLANs = append(b.VLANs, v)
	}
	rows.Close()

	rows, err = db.Query(`SELECT id, prefix, name, description, status, parent_id, vlan_id, created_at, updated_at FROM prefixes ORDER BY id`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var p backupPrefix
		if err := rows.Scan(&p.ID, &p.Prefix, &p.Name, &p.Description, &p.Status, &p.ParentID, &p.VlanID, &p.CreatedAt, &p.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		b.Prefixes = append(b.Prefixes, p)
	}
	rows.Close()

	rows, err = db.Query(`SELECT id, address, prefix_id, hostname, description, status, dns_name, created_at, updated_at FROM ip_addresses ORDER BY id`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var a backupAddress
		if err := rows.Scan(&a.ID, &a.Address, &a.PrefixID, &a.Hostname, &a.Description, &a.Status, &a.DNSName, &a.CreatedAt, &a.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		b.Addresses = append(b.Addresses, a)
	}
	rows.Close()

	rows, err = db.Query(`SELECT id, username, password_hash, role, created_at, updated_at FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var u backupUser
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		b.Users = append(b.Users, u)
	}
	rows.Close()

	return b, nil
}

func applyRestore(db *sql.DB, b *backupFile) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Wipe children before parents; user rows are independent.
	for _, stmt := range []string{
		"DELETE FROM ip_addresses",
		"DELETE FROM prefixes",
		"DELETE FROM vlans",
		"DELETE FROM users",
	} {
		if _, err := tx.Exec(stmt); err != nil {
			return err
		}
	}

	for _, v := range b.VLANs {
		if _, err := tx.Exec(
			`INSERT INTO vlans (id, vid, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			v.ID, v.Vid, v.Name, v.Description, v.Status, v.CreatedAt, v.UpdatedAt,
		); err != nil {
			return fmt.Errorf("vlan %d: %w", v.Vid, err)
		}
	}

	// Prefixes reference each other via parent_id, and a parent can have a
	// higher id than its child (after reparenting). Insert every row with
	// parent_id NULL first, then wire up the parents in a second pass.
	for _, p := range b.Prefixes {
		if _, err := tx.Exec(
			`INSERT INTO prefixes (id, prefix, name, description, status, parent_id, vlan_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
			p.ID, p.Prefix, p.Name, p.Description, p.Status, p.VlanID, p.CreatedAt, p.UpdatedAt,
		); err != nil {
			return fmt.Errorf("prefix %s: %w", p.Prefix, err)
		}
	}
	for _, p := range b.Prefixes {
		if p.ParentID == nil {
			continue
		}
		if _, err := tx.Exec(`UPDATE prefixes SET parent_id = ? WHERE id = ?`, *p.ParentID, p.ID); err != nil {
			return fmt.Errorf("prefix %s parent: %w", p.Prefix, err)
		}
	}

	for _, a := range b.Addresses {
		if _, err := tx.Exec(
			`INSERT INTO ip_addresses (id, address, prefix_id, hostname, description, status, dns_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			a.ID, a.Address, a.PrefixID, a.Hostname, a.Description, a.Status, a.DNSName, a.CreatedAt, a.UpdatedAt,
		); err != nil {
			return fmt.Errorf("address %s: %w", a.Address, err)
		}
	}

	for _, u := range b.Users {
		if _, err := tx.Exec(
			`INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			u.ID, u.Username, u.PasswordHash, u.Role, u.CreatedAt, u.UpdatedAt,
		); err != nil {
			return fmt.Errorf("user %s: %w", u.Username, err)
		}
	}

	return tx.Commit()
}

// BackupHandler streams the whole database as a versioned JSON file.
// Contains password hashes — admin-only by route placement.
func BackupHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := collectBackup(db)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		filename := fmt.Sprintf("iplist_backup_%s.json", time.Now().Format("2006-01-02"))
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		enc.Encode(b)
	}
}

// RestoreHandler replaces ALL data with the uploaded backup, atomically.
func RestoreHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 64<<20)
		var b backupFile
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			respondError(w, http.StatusBadRequest, "invalid backup file: "+err.Error())
			return
		}
		if b.Version != backupVersion {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("unsupported backup version %d (expected %d)", b.Version, backupVersion))
			return
		}

		// A restore that leaves the system without any admin login would
		// brick the installation once current tokens expire.
		hasAdmin := false
		for _, u := range b.Users {
			if u.Role == "admin" && u.Username != "" && u.PasswordHash != "" {
				hasAdmin = true
				break
			}
		}
		if !hasAdmin {
			respondError(w, http.StatusBadRequest, "backup contains no admin user — refusing to restore")
			return
		}

		if err := applyRestore(db, &b); err != nil {
			respondError(w, http.StatusInternalServerError, "restore failed (database unchanged): "+err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]int{
			"vlans":     len(b.VLANs),
			"prefixes":  len(b.Prefixes),
			"addresses": len(b.Addresses),
			"users":     len(b.Users),
		})
	}
}
