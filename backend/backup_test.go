package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func TestBackupRestoreRoundtrip(t *testing.T) {
	db := newTestDB(t)

	userRepo := NewUserRepo(db)
	vlanRepo := NewVLANRepo(db)
	prefixRepo := NewPrefixRepo(db)
	addressRepo := NewAddressRepo(db)

	if _, err := userRepo.Create("admin", "hunter2hunter2", "admin"); err != nil {
		t.Fatalf("create user: %v", err)
	}
	vlan, err := vlanRepo.Create(vlanRequest{Vid: 100, Name: "corp"})
	if err != nil {
		t.Fatalf("create vlan: %v", err)
	}
	parent, err := prefixRepo.Create(prefixRequest{Prefix: "10.0.0.0/24", VlanID: &vlan.ID})
	if err != nil {
		t.Fatalf("create parent prefix: %v", err)
	}
	child, err := prefixRepo.Create(prefixRequest{Prefix: "10.0.0.0/26", ParentID: &parent.ID})
	if err != nil {
		t.Fatalf("create child prefix: %v", err)
	}
	if _, err := addressRepo.Create(addressRequest{Address: "10.0.0.5", PrefixID: &child.ID}); err != nil {
		t.Fatalf("create address: %v", err)
	}

	backup, err := collectBackup(db)
	if err != nil {
		t.Fatalf("collectBackup: %v", err)
	}
	if len(backup.Users) != 1 || len(backup.VLANs) != 1 || len(backup.Prefixes) != 2 || len(backup.Addresses) != 1 {
		t.Fatalf("unexpected backup shape: %+v", backup)
	}

	// Wipe the database, then restore from the collected backup.
	if err := applyRestore(db, &backupFile{
		Version: backupVersion,
		Users:   []backupUser{{ID: 999, Username: "placeholder", PasswordHash: "x", Role: "admin"}},
	}); err != nil {
		t.Fatalf("wipe restore: %v", err)
	}

	if err := applyRestore(db, backup); err != nil {
		t.Fatalf("applyRestore: %v", err)
	}

	after, err := collectBackup(db)
	if err != nil {
		t.Fatalf("collectBackup after restore: %v", err)
	}

	if len(after.Users) != 1 || after.Users[0].Username != "admin" {
		t.Errorf("users not restored correctly: %+v", after.Users)
	}
	if len(after.Prefixes) != 2 {
		t.Fatalf("prefixes not restored correctly: %+v", after.Prefixes)
	}
	var restoredChild *backupPrefix
	for i := range after.Prefixes {
		if after.Prefixes[i].ID == child.ID {
			restoredChild = &after.Prefixes[i]
		}
	}
	if restoredChild == nil {
		t.Fatal("child prefix missing after restore")
	}
	if restoredChild.ParentID == nil || *restoredChild.ParentID != parent.ID {
		t.Errorf("child parent_id not rewired correctly: %+v", restoredChild.ParentID)
	}
	if len(after.Addresses) != 1 || after.Addresses[0].Address != "10.0.0.5" {
		t.Errorf("addresses not restored correctly: %+v", after.Addresses)
	}
}

func TestRestoreHandlerRefusesWithoutAdmin(t *testing.T) {
	db := newTestDB(t)
	userRepo := NewUserRepo(db)
	if _, err := userRepo.Create("admin", "hunter2hunter2", "admin"); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	payload, _ := json.Marshal(backupFile{
		Version: backupVersion,
		Users:   []backupUser{{ID: 1, Username: "reader", PasswordHash: "x", Role: "read"}},
	})

	req := httptest.NewRequest("POST", "/restore", bytes.NewReader(payload))
	w := httptest.NewRecorder()
	RestoreHandler(db)(w, req)

	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}

	users, err := userRepo.List()
	if err != nil {
		t.Fatalf("list users: %v", err)
	}
	if len(users) != 1 || users[0].Username != "admin" {
		t.Errorf("database should be untouched after refused restore, got users: %+v", users)
	}
}

func TestRestoreHandlerRefusesWrongVersion(t *testing.T) {
	db := newTestDB(t)
	payload, _ := json.Marshal(backupFile{
		Version: backupVersion + 1,
		Users:   []backupUser{{ID: 1, Username: "admin", PasswordHash: "x", Role: "admin"}},
	})

	req := httptest.NewRequest("POST", "/restore", bytes.NewReader(payload))
	w := httptest.NewRecorder()
	RestoreHandler(db)(w, req)

	if w.Code != 400 {
		t.Errorf("status = %d, want 400", w.Code)
	}
}
