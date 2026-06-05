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

type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	Role         string    `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UserRepo struct{ db *sql.DB }

func NewUserRepo(db *sql.DB) *UserRepo { return &UserRepo{db: db} }

func (r *UserRepo) GetByUsername(username string) (*User, error) {
	var u User
	err := r.db.QueryRow(
		`SELECT id, username, password_hash, role, created_at, updated_at FROM users WHERE username = ?`,
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	return &u, err
}

func (r *UserRepo) List() ([]User, error) {
	rows, err := r.db.Query(
		`SELECT id, username, role, created_at, updated_at FROM users ORDER BY username`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if users == nil {
		users = []User{}
	}
	return users, nil
}

func (r *UserRepo) Create(username, password, role string) (*User, error) {
	if role != "admin" && role != "read" {
		return nil, fmt.Errorf("role must be 'admin' or 'read'")
	}
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	res, err := r.db.Exec(
		`INSERT INTO users (username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		username, hash, role, now, now,
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &User{ID: id, Username: username, Role: role, CreatedAt: now, UpdatedAt: now}, nil
}

func (r *UserRepo) UpdatePassword(id int64, password string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(
		`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`,
		hash, time.Now(), id,
	)
	return err
}

func (r *UserRepo) UpdateRole(id int64, role string) error {
	if role != "admin" && role != "read" {
		return fmt.Errorf("role must be 'admin' or 'read'")
	}
	_, err := r.db.Exec(
		`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`,
		role, time.Now(), id,
	)
	return err
}

func (r *UserRepo) Delete(id int64) error {
	// Prevent deleting the last admin
	var adminCount int
	r.db.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&adminCount)
	var userRole string
	r.db.QueryRow(`SELECT role FROM users WHERE id = ?`, id).Scan(&userRole)
	if userRole == "admin" && adminCount <= 1 {
		return fmt.Errorf("cannot delete the last admin user")
	}
	_, err := r.db.Exec(`DELETE FROM users WHERE id = ?`, id)
	return err
}

func (r *UserRepo) Count() (int, error) {
	var n int
	err := r.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n)
	return n, err
}

// HTTP handlers

func ListUsers(repo *UserRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		users, err := repo.List()
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, users)
	}
}

func CreateUser(repo *UserRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Username == "" || req.Password == "" {
			respondError(w, http.StatusBadRequest, "username and password required")
			return
		}
		u, err := repo.Create(req.Username, req.Password, req.Role)
		if err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondJSON(w, http.StatusCreated, u)
	}
}

func UpdateUser(repo *UserRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req struct {
			Password string `json:"password"`
			Role     string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Role != "" {
			if err := repo.UpdateRole(id, req.Role); err != nil {
				respondError(w, http.StatusBadRequest, err.Error())
				return
			}
		}
		if req.Password != "" {
			if err := repo.UpdatePassword(id, req.Password); err != nil {
				respondError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func DeleteUser(repo *UserRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}
		if err := repo.Delete(id); err != nil {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
