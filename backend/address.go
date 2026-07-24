package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

type AddressRepo struct{ db *sql.DB }

func NewAddressRepo(db *sql.DB) *AddressRepo { return &AddressRepo{db: db} }

type addressRequest struct {
	Address     string `json:"address"`
	PrefixID    *int64 `json:"prefix_id"`
	Hostname    string `json:"hostname"`
	Description string `json:"description"`
	Status      string `json:"status"`
	DNSName     string `json:"dns_name"`
}

func (r *AddressRepo) findContainingPrefix(ipStr string) (*int64, error) {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return nil, fmt.Errorf("invalid IP address: %s", ipStr)
	}

	candidates, err := r.listCandidates()
	if err != nil {
		return nil, err
	}
	return longestMatchingPrefix(ip, candidates), nil
}

// listCandidates loads all prefixes as (id, prefix) pairs. Callers doing many
// lookups in a row (e.g. CSV import) should call this once and reuse the
// result via longestMatchingPrefix instead of re-querying per row.
func (r *AddressRepo) listCandidates() ([]prefixCandidate, error) {
	rows, err := r.db.Query("SELECT id, prefix FROM prefixes ORDER BY prefix DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []prefixCandidate
	for rows.Next() {
		var c prefixCandidate
		if err := rows.Scan(&c.ID, &c.Prefix); err != nil {
			continue
		}
		candidates = append(candidates, c)
	}
	return candidates, nil
}

func (r *AddressRepo) List(prefixID *int64, status string) ([]IPAddress, error) {
	query := `
		SELECT id, address, prefix_id, hostname, description, status, dns_name, created_at, updated_at
		FROM ip_addresses WHERE 1=1`
	args := []any{}

	if prefixID != nil {
		query += " AND prefix_id = ?"
		args = append(args, *prefixID)
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addresses []IPAddress
	for rows.Next() {
		var a IPAddress
		if err := rows.Scan(&a.ID, &a.Address, &a.PrefixID, &a.Hostname,
			&a.Description, &a.Status, &a.DNSName, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		addresses = append(addresses, a)
	}
	sort.Slice(addresses, func(i, j int) bool {
		a := net.ParseIP(addresses[i].Address).To16()
		b := net.ParseIP(addresses[j].Address).To16()
		return bytes.Compare(a, b) < 0
	})
	if addresses == nil {
		addresses = []IPAddress{}
	}
	return addresses, nil
}

func (r *AddressRepo) GetByID(id int64) (*IPAddress, error) {
	var a IPAddress
	err := r.db.QueryRow(`
		SELECT id, address, prefix_id, hostname, description, status, dns_name, created_at, updated_at
		FROM ip_addresses WHERE id = ?`, id).Scan(
		&a.ID, &a.Address, &a.PrefixID, &a.Hostname,
		&a.Description, &a.Status, &a.DNSName, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("address not found")
	}
	return &a, err
}

func (r *AddressRepo) Create(req addressRequest) (*IPAddress, error) {
	if net.ParseIP(req.Address) == nil {
		return nil, fmt.Errorf("invalid IP address: %s", req.Address)
	}

	prefixID := req.PrefixID
	if prefixID == nil {
		var err error
		prefixID, err = r.findContainingPrefix(req.Address)
		if err != nil {
			return nil, err
		}
	}

	if req.Status == "" {
		req.Status = "active"
	}

	now := time.Now()
	result, err := r.db.Exec(`
		INSERT INTO ip_addresses (address, prefix_id, hostname, description, status, dns_name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		req.Address, prefixID, req.Hostname, req.Description, req.Status, req.DNSName, now, now)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	return r.GetByID(id)
}

// CreateBatch is like Create but resolves the containing prefix by
// longest-prefix-match against a preloaded candidate set instead of
// re-querying the whole prefixes table. Intended for CSV import, where
// calling Create per row would scan the full prefixes table per row.
func (r *AddressRepo) CreateBatch(req addressRequest, candidates []prefixCandidate) (*IPAddress, error) {
	ip := net.ParseIP(req.Address)
	if ip == nil {
		return nil, fmt.Errorf("invalid IP address: %s", req.Address)
	}

	prefixID := req.PrefixID
	if prefixID == nil {
		prefixID = longestMatchingPrefix(ip, candidates)
	}

	if req.Status == "" {
		req.Status = "active"
	}

	now := time.Now()
	result, err := r.db.Exec(`
		INSERT INTO ip_addresses (address, prefix_id, hostname, description, status, dns_name, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		req.Address, prefixID, req.Hostname, req.Description, req.Status, req.DNSName, now, now)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	return r.GetByID(id)
}

func (r *AddressRepo) Update(id int64, req addressRequest) (*IPAddress, error) {
	if net.ParseIP(req.Address) == nil {
		return nil, fmt.Errorf("invalid IP address: %s", req.Address)
	}

	prefixID := req.PrefixID
	if prefixID == nil {
		var err error
		prefixID, err = r.findContainingPrefix(req.Address)
		if err != nil {
			return nil, err
		}
	}

	if req.Status == "" {
		req.Status = "active"
	}

	_, err := r.db.Exec(`
		UPDATE ip_addresses SET address=?, prefix_id=?, hostname=?, description=?, status=?, dns_name=?, updated_at=?
		WHERE id=?`,
		req.Address, prefixID, req.Hostname, req.Description, req.Status, req.DNSName, time.Now(), id)
	if err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *AddressRepo) Delete(id int64) error {
	_, err := r.db.Exec("DELETE FROM ip_addresses WHERE id = ?", id)
	return err
}

func (r *AddressRepo) TotalCount() (int, error) {
	var n int
	err := r.db.QueryRow("SELECT COUNT(*) FROM ip_addresses").Scan(&n)
	return n, err
}

// HTTP handlers

func ListAddresses(repo *AddressRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var prefixID *int64
		if pid := r.URL.Query().Get("prefix_id"); pid != "" {
			id, err := strconv.ParseInt(pid, 10, 64)
			if err == nil {
				prefixID = &id
			}
		}
		status := r.URL.Query().Get("status")

		addresses, err := repo.List(prefixID, status)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, addresses)
	}
}

func GetAddress(repo *AddressRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		a, err := repo.GetByID(id)
		if err != nil {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, a)
	}
}

func CreateAddress(repo *AddressRepo, _ *PrefixRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req addressRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		a, err := repo.Create(req)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondJSON(w, http.StatusCreated, a)
	}
}

func UpdateAddress(repo *AddressRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req addressRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		a, err := repo.Update(id, req)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, a)
	}
}

func DeleteAddress(repo *AddressRepo) http.HandlerFunc {
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
