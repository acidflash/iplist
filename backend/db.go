package main

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func InitDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)

	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
		PRAGMA journal_mode=WAL;
		PRAGMA foreign_keys=ON;

		CREATE TABLE IF NOT EXISTS vlans (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			vid         INTEGER NOT NULL UNIQUE CHECK(vid >= 1 AND vid <= 4094),
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated')),
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS prefixes (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			prefix      TEXT NOT NULL UNIQUE,
			name        TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated')),
			parent_id   INTEGER REFERENCES prefixes(id) ON DELETE SET NULL,
			vlan_id     INTEGER REFERENCES vlans(id) ON DELETE SET NULL,
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS ip_addresses (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			address     TEXT NOT NULL UNIQUE,
			prefix_id   INTEGER REFERENCES prefixes(id) ON DELETE SET NULL,
			hostname    TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated')),
			dns_name    TEXT NOT NULL DEFAULT '',
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`)
	return err
}
