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

		CREATE TABLE IF NOT EXISTS users (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			username      TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role          TEXT NOT NULL DEFAULT 'read' CHECK(role IN ('admin','read')),
			created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS vlans (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			vid         INTEGER NOT NULL UNIQUE CHECK(vid >= 1 AND vid <= 4094),
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated','pending')),
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS prefixes (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			prefix      TEXT NOT NULL UNIQUE,
			name        TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated','pending')),
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
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated','pending')),
			dns_name    TEXT NOT NULL DEFAULT '',
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		return err
	}

	return runMigrations(db)
}

func runMigrations(db *sql.DB) error {
	var version int
	db.QueryRow("PRAGMA user_version").Scan(&version)

	if version < 1 {
		if err := migration1AddPendingStatus(db); err != nil {
			return err
		}
		if _, err := db.Exec("PRAGMA user_version = 1"); err != nil {
			return err
		}
	}

	return nil
}

// migration1AddPendingStatus recreates the three status columns to allow 'pending'.
func migration1AddPendingStatus(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`PRAGMA foreign_keys=OFF`); err != nil {
		return err
	}

	migrations := []string{
		// ip_addresses
		`CREATE TABLE IF NOT EXISTS ip_addresses_new (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			address     TEXT NOT NULL UNIQUE,
			prefix_id   INTEGER REFERENCES prefixes(id) ON DELETE SET NULL,
			hostname    TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated','pending')),
			dns_name    TEXT NOT NULL DEFAULT '',
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`INSERT INTO ip_addresses_new SELECT * FROM ip_addresses`,
		`DROP TABLE ip_addresses`,
		`ALTER TABLE ip_addresses_new RENAME TO ip_addresses`,

		// vlans
		`CREATE TABLE IF NOT EXISTS vlans_new (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			vid         INTEGER NOT NULL UNIQUE CHECK(vid >= 1 AND vid <= 4094),
			name        TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated','pending')),
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`INSERT INTO vlans_new SELECT * FROM vlans`,
		`DROP TABLE vlans`,
		`ALTER TABLE vlans_new RENAME TO vlans`,

		// prefixes
		`CREATE TABLE IF NOT EXISTS prefixes_new (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			prefix      TEXT NOT NULL UNIQUE,
			name        TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated','pending')),
			parent_id   INTEGER REFERENCES prefixes(id) ON DELETE SET NULL,
			vlan_id     INTEGER REFERENCES vlans(id) ON DELETE SET NULL,
			created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`INSERT INTO prefixes_new SELECT * FROM prefixes`,
		`DROP TABLE prefixes`,
		`ALTER TABLE prefixes_new RENAME TO prefixes`,
	}

	for _, stmt := range migrations {
		if _, err := tx.Exec(stmt); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(`PRAGMA foreign_keys=ON`); err != nil {
		return err
	}

	return tx.Commit()
}

func seedDefaultUsers(db *sql.DB) error {
	var n int
	db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n)
	if n > 0 {
		return nil
	}
	repo := NewUserRepo(db)
	if _, err := repo.Create("admin", "admin", "admin"); err != nil {
		return err
	}
	_, err := repo.Create("reader", "reader", "read")
	return err
}
