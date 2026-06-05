package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
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

	rows, err := r.db.Query("SELECT id, prefix FROM prefixes ORDER BY prefix DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bestID *int64
	bestOnes := -1

	for rows.Next() {
		var id int64
		var prefix string
		if err := rows.Scan(&id, &prefix); err != nil {
			continue
		}
		_, network, err := net.ParseCIDR(prefix)
		if err != nil {
			continue
		}
		if network.Contains(ip) {
			ones, _ := network.Mask.Size()
			if ones > bestOnes {
				bestOnes = ones
				tmp := id
				bestID = &tmp
			}
		}
	}

	return bestID, nil
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
	query += " ORDER BY address"

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
