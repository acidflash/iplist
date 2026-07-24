package main

import (
	"database/sql"
	"testing"
)

// newTestDB returns an initialized in-memory database with the full schema
// applied, closed automatically at test cleanup.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := InitDB(":memory:")
	if err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}
