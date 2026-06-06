package main

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"strconv"
	"sync"

	"github.com/go-chi/chi/v5"
)

type PingResult struct {
	AddressID int64  `json:"address_id"`
	Address   string `json:"address"`
	Alive     bool   `json:"alive"`
}

func pingHost(ip string) bool {
	return exec.Command("ping", "-c", "1", "-W", "1", ip).Run() == nil
}

func PingPrefix(addrRepo *AddressRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			http.Error(w, "invalid id", http.StatusBadRequest)
			return
		}

		addrs, err := addrRepo.List(&id, "")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		results := make([]PingResult, len(addrs))
		var wg sync.WaitGroup
		for i, a := range addrs {
			wg.Add(1)
			go func(i int, a IPAddress) {
				defer wg.Done()
				results[i] = PingResult{
					AddressID: a.ID,
					Address:   a.Address,
					Alive:     pingHost(a.Address),
				}
			}(i, a)
		}
		wg.Wait()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(results)
	}
}
