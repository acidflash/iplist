package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

type VLANRepo struct{ db *sql.DB }

func NewVLANRepo(db *sql.DB) *VLANRepo { return &VLANRepo{db: db} }

type vlanRequest struct {
	Vid         int    `json:"vid"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

func (r *VLANRepo) List() ([]VLAN, error) {
	rows, err := r.db.Query(`
		SELECT id, vid, name, description, status, created_at, updated_at
		FROM vlans ORDER BY vid`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vlans []VLAN
	for rows.Next() {
		var v VLAN
		if err := rows.Scan(&v.ID, &v.Vid, &v.Name, &v.Description,
			&v.Status, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, err
		}
		vlans = append(vlans, v)
	}
	if vlans == nil {
		vlans = []VLAN{}
	}
	return vlans, nil
}

func (r *VLANRepo) GetByID(id int64) (*VLAN, error) {
	var v VLAN
	err := r.db.QueryRow(`
		SELECT id, vid, name, description, status, created_at, updated_at
		FROM vlans WHERE id = ?`, id).Scan(
		&v.ID, &v.Vid, &v.Name, &v.Description,
		&v.Status, &v.CreatedAt, &v.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("vlan not found")
	}
	if err != nil {
		return nil, err
	}

	// Load associated prefixes
	rows, err := r.db.Query(`
		SELECT id, prefix, name, description, status, parent_id, vlan_id, created_at, updated_at
		FROM prefixes WHERE vlan_id = ? ORDER BY prefix`, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p Prefix
			if err := rows.Scan(&p.ID, &p.Prefix, &p.Name, &p.Description,
				&p.Status, &p.ParentID, &p.VlanID, &p.CreatedAt, &p.UpdatedAt); err == nil {
				v.Prefixes = append(v.Prefixes, p)
			}
		}
	}
	if v.Prefixes == nil {
		v.Prefixes = []Prefix{}
	}

	return &v, nil
}

func (r *VLANRepo) Create(req vlanRequest) (*VLAN, error) {
	if req.Vid < 1 || req.Vid > 4094 {
		return nil, fmt.Errorf("VLAN ID must be between 1 and 4094")
	}
	if req.Status == "" {
		req.Status = "active"
	}

	now := time.Now()
	result, err := r.db.Exec(`
		INSERT INTO vlans (vid, name, description, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		req.Vid, req.Name, req.Description, req.Status, now, now)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	return r.GetByID(id)
}

func (r *VLANRepo) Update(id int64, req vlanRequest) (*VLAN, error) {
	if req.Vid < 1 || req.Vid > 4094 {
		return nil, fmt.Errorf("VLAN ID must be between 1 and 4094")
	}
	if req.Status == "" {
		req.Status = "active"
	}

	_, err := r.db.Exec(`
		UPDATE vlans SET vid=?, name=?, description=?, status=?, updated_at=?
		WHERE id=?`,
		req.Vid, req.Name, req.Description, req.Status, time.Now(), id)
	if err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *VLANRepo) Delete(id int64) error {
	_, err := r.db.Exec("DELETE FROM vlans WHERE id = ?", id)
	return err
}

func (r *VLANRepo) TotalCount() (int, error) {
	var n int
	err := r.db.QueryRow("SELECT COUNT(*) FROM vlans").Scan(&n)
	return n, err
}

// HTTP handlers

func ListVLANs(repo *VLANRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vlans, err := repo.List()
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, vlans)
	}
}

func GetVLAN(vlanRepo *VLANRepo, _ *PrefixRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		v, err := vlanRepo.GetByID(id)
		if err != nil {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, v)
	}
}

func CreateVLAN(repo *VLANRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req vlanRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		v, err := repo.Create(req)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondJSON(w, http.StatusCreated, v)
	}
}

func UpdateVLAN(repo *VLANRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req vlanRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		v, err := repo.Update(id, req)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, v)
	}
}

func DeleteVLAN(repo *VLANRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		if err := repo.Delete(id); err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
