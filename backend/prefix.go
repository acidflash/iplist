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

type PrefixRepo struct{ db *sql.DB }

func NewPrefixRepo(db *sql.DB) *PrefixRepo { return &PrefixRepo{db: db} }

type prefixRequest struct {
	Prefix      string `json:"prefix"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`
	ParentID    *int64 `json:"parent_id"`
	VlanID      *int64 `json:"vlan_id"`
}

func (r *PrefixRepo) findBestParent(cidr string, excludeID *int64) (*int64, error) {
	ip, _, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, err
	}

	query := "SELECT id, prefix FROM prefixes WHERE prefix != ?"
	args := []any{cidr}
	if excludeID != nil {
		query += " AND id != ?"
		args = append(args, *excludeID)
	}

	rows, err := r.db.Query(query, args...)
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

func (r *PrefixRepo) calculateUsage(cidr string, prefixID int64) (total, used int64) {
	total = ipNetTotalSize(cidr)
	if total <= 0 {
		return 0, 0
	}

	rows, err := r.db.Query("SELECT prefix FROM prefixes WHERE parent_id = ?", prefixID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var childCIDR string
			if rows.Scan(&childCIDR) == nil {
				_, childNet, err := net.ParseCIDR(childCIDR)
				if err == nil {
					ones, bits := childNet.Mask.Size()
					used += int64(1) << (bits - ones)
				}
			}
		}
	}

	var addrCount int64
	r.db.QueryRow("SELECT COUNT(*) FROM ip_addresses WHERE prefix_id = ?", prefixID).Scan(&addrCount)
	used += addrCount
	return total, used
}

func (r *PrefixRepo) scanPrefix(rows *sql.Rows) (Prefix, error) {
	var p Prefix
	var vlanDBID sql.NullInt64
	var vlanVid sql.NullInt64
	var vlanName sql.NullString
	err := rows.Scan(
		&p.ID, &p.Prefix, &p.Name, &p.Description, &p.Status,
		&p.ParentID, &p.VlanID, &p.CreatedAt, &p.UpdatedAt,
		&vlanDBID, &vlanVid, &vlanName,
	)
	if err != nil {
		return p, err
	}
	if vlanDBID.Valid {
		p.Vlan = &VLAN{ID: vlanDBID.Int64, Vid: int(vlanVid.Int64), Name: vlanName.String}
	}
	return p, nil
}

func (r *PrefixRepo) List() ([]Prefix, error) {
	rows, err := r.db.Query(`
		SELECT p.id, p.prefix, p.name, p.description, p.status,
		       p.parent_id, p.vlan_id, p.created_at, p.updated_at,
		       v.id, v.vid, v.name
		FROM prefixes p
		LEFT JOIN vlans v ON p.vlan_id = v.id
		ORDER BY p.prefix`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prefixes []Prefix
	for rows.Next() {
		p, err := r.scanPrefix(rows)
		if err != nil {
			return nil, err
		}
		p.TotalIPs, p.UsedIPs = r.calculateUsage(p.Prefix, p.ID)
		if p.TotalIPs > 0 {
			p.Utilization = float64(p.UsedIPs) / float64(p.TotalIPs) * 100
		}
		prefixes = append(prefixes, p)
	}
	if prefixes == nil {
		prefixes = []Prefix{}
	}
	return prefixes, nil
}

func (r *PrefixRepo) GetByID(id int64) (*Prefix, error) {
	rows, err := r.db.Query(`
		SELECT p.id, p.prefix, p.name, p.description, p.status,
		       p.parent_id, p.vlan_id, p.created_at, p.updated_at,
		       v.id, v.vid, v.name
		FROM prefixes p
		LEFT JOIN vlans v ON p.vlan_id = v.id
		WHERE p.id = ?`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, fmt.Errorf("prefix not found")
	}
	p, err := r.scanPrefix(rows)
	if err != nil {
		return nil, err
	}
	rows.Close()

	p.TotalIPs, p.UsedIPs = r.calculateUsage(p.Prefix, p.ID)
	if p.TotalIPs > 0 {
		p.Utilization = float64(p.UsedIPs) / float64(p.TotalIPs) * 100
	}

	// Load direct children
	childRows, err := r.db.Query(`
		SELECT p.id, p.prefix, p.name, p.description, p.status,
		       p.parent_id, p.vlan_id, p.created_at, p.updated_at,
		       v.id, v.vid, v.name
		FROM prefixes p
		LEFT JOIN vlans v ON p.vlan_id = v.id
		WHERE p.parent_id = ?
		ORDER BY p.prefix`, id)
	if err == nil {
		defer childRows.Close()
		for childRows.Next() {
			child, err := r.scanPrefix(childRows)
			if err == nil {
				child.TotalIPs, child.UsedIPs = r.calculateUsage(child.Prefix, child.ID)
				if child.TotalIPs > 0 {
					child.Utilization = float64(child.UsedIPs) / float64(child.TotalIPs) * 100
				}
				p.Children = append(p.Children, child)
			}
		}
	}
	if p.Children == nil {
		p.Children = []Prefix{}
	}

	// Load addresses
	addrRows, err := r.db.Query(`
		SELECT id, address, prefix_id, hostname, description, status, dns_name, created_at, updated_at
		FROM ip_addresses WHERE prefix_id = ? ORDER BY address`, id)
	if err == nil {
		defer addrRows.Close()
		for addrRows.Next() {
			var a IPAddress
			if err := addrRows.Scan(&a.ID, &a.Address, &a.PrefixID, &a.Hostname,
				&a.Description, &a.Status, &a.DNSName, &a.CreatedAt, &a.UpdatedAt); err == nil {
				p.Addresses = append(p.Addresses, a)
			}
		}
	}
	if p.Addresses == nil {
		p.Addresses = []IPAddress{}
	}

	return &p, nil
}

func (r *PrefixRepo) Create(req prefixRequest) (*Prefix, error) {
	cidr, err := normalizeCIDR(req.Prefix)
	if err != nil {
		return nil, fmt.Errorf("invalid CIDR: %s", req.Prefix)
	}

	parentID := req.ParentID
	if parentID == nil {
		parentID, err = r.findBestParent(cidr, nil)
		if err != nil {
			return nil, err
		}
	}

	if req.Status == "" {
		req.Status = "active"
	}

	now := time.Now()
	result, err := r.db.Exec(`
		INSERT INTO prefixes (prefix, name, description, status, parent_id, vlan_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		cidr, req.Name, req.Description, req.Status, parentID, req.VlanID, now, now)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	return r.GetByID(id)
}

func (r *PrefixRepo) Update(id int64, req prefixRequest) (*Prefix, error) {
	cidr, err := normalizeCIDR(req.Prefix)
	if err != nil {
		return nil, fmt.Errorf("invalid CIDR: %s", req.Prefix)
	}

	if req.Status == "" {
		req.Status = "active"
	}

	parentID := req.ParentID
	if parentID == nil {
		parentID, err = r.findBestParent(cidr, &id)
		if err != nil {
			return nil, err
		}
	}

	_, err = r.db.Exec(`
		UPDATE prefixes SET prefix=?, name=?, description=?, status=?, parent_id=?, vlan_id=?, updated_at=?
		WHERE id=?`,
		cidr, req.Name, req.Description, req.Status, parentID, req.VlanID, time.Now(), id)
	if err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *PrefixRepo) Delete(id int64) error {
	_, err := r.db.Exec("DELETE FROM prefixes WHERE id = ?", id)
	return err
}

func (r *PrefixRepo) TotalCount() (int, error) {
	var n int
	err := r.db.QueryRow("SELECT COUNT(*) FROM prefixes").Scan(&n)
	return n, err
}

// HTTP handlers

func ListPrefixes(repo *PrefixRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		prefixes, err := repo.List()
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, prefixes)
	}
}

func GetPrefix(repo *PrefixRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		p, err := repo.GetByID(id)
		if err != nil {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, p)
	}
}

func CreatePrefix(repo *PrefixRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req prefixRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		p, err := repo.Create(req)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondJSON(w, http.StatusCreated, p)
	}
}

func UpdatePrefix(repo *PrefixRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req prefixRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		p, err := repo.Update(id, req)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, p)
	}
}

func DeletePrefix(repo *PrefixRepo) http.HandlerFunc {
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
