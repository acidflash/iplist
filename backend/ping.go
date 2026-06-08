package main

import (
	"net"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

type PingResult struct {
	AddressID int64  `json:"address_id"`
	Address   string `json:"address"`
	Alive     bool   `json:"alive"`
}

type DiscoverResponse struct {
	Added   int      `json:"added"`
	Updated int      `json:"updated"`
	Alive   int      `json:"alive"`
	Total   int      `json:"total"`
	Errors  []string `json:"errors,omitempty"`
}

func pingHost(ip string) bool {
	return exec.Command("ping", "-c", "1", "-W", "1", ip).Run() == nil
}

func ptrLookup(ip string) string {
	names, err := net.LookupAddr(ip)
	if err != nil || len(names) == 0 {
		return ""
	}
	return strings.TrimSuffix(names[0], ".")
}

// maxEnumerableHosts caps enumerateCIDR so a huge range (especially IPv6)
// can't allocate an unbounded slice and exhaust memory. Callers that surface
// a friendlier error should guard on prefix size before calling.
const maxEnumerableHosts = 1 << 16

func enumerateCIDR(cidr string) []string {
	_, network, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil
	}
	if ones, bits := network.Mask.Size(); bits-ones > 16 {
		return nil
	}
	ip := make(net.IP, len(network.IP))
	copy(ip, network.IP)

	var ips []string
	for network.Contains(ip) {
		if len(ips) >= maxEnumerableHosts {
			return nil
		}
		ips = append(ips, ip.String())
		for i := len(ip) - 1; i >= 0; i-- {
			ip[i]++
			if ip[i] != 0 {
				break
			}
		}
	}
	// Drop network address and broadcast for IPv4
	if len(network.IP) == 4 && len(ips) > 2 {
		ips = ips[1 : len(ips)-1]
	}
	return ips
}

func PingPrefix(addrRepo *AddressRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}

		addrs, err := addrRepo.List(&id, "")
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Cap concurrency so a large prefix can't spawn thousands of
		// simultaneous ping processes.
		results := make([]PingResult, len(addrs))
		sem := make(chan struct{}, 100)
		var wg sync.WaitGroup
		for i, a := range addrs {
			wg.Add(1)
			go func(i int, a IPAddress) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				results[i] = PingResult{
					AddressID: a.ID,
					Address:   a.Address,
					Alive:     pingHost(a.Address),
				}
			}(i, a)
		}
		wg.Wait()

		respondJSON(w, http.StatusOK, results)
	}
}

func DiscoverPrefix(prefixRepo *PrefixRepo, addrRepo *AddressRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid id")
			return
		}

		prefix, err := prefixRepo.GetByID(id)
		if err != nil || prefix == nil {
			respondError(w, http.StatusNotFound, "prefix not found")
			return
		}

		// Guard on prefix size *before* enumerating: a large range (especially
		// an IPv6 prefix) would otherwise try to allocate billions of entries
		// and exhaust memory. >11 host bits means more than 2048 addresses.
		if _, network, err := net.ParseCIDR(prefix.Prefix); err != nil {
			respondError(w, http.StatusBadRequest, "could not enumerate addresses")
			return
		} else if ones, bits := network.Mask.Size(); bits-ones > 11 {
			respondError(w, http.StatusBadRequest, "subnet too large — max 2046 hosts (e.g. IPv4 /21)")
			return
		}

		ips := enumerateCIDR(prefix.Prefix)
		if len(ips) == 0 {
			respondError(w, http.StatusBadRequest, "could not enumerate addresses")
			return
		}

		// Build map from ALL addresses globally (address is UNIQUE in DB)
		allExisting, _ := addrRepo.List(nil, "")
		globalByIP := make(map[string]*IPAddress, len(allExisting))
		for i := range allExisting {
			globalByIP[allExisting[i].Address] = &allExisting[i]
		}

		// Scan concurrently (max 100 parallel)
		type scanResult struct {
			ip    string
			alive bool
			ptr   string
		}
		results := make([]scanResult, len(ips))
		sem := make(chan struct{}, 100)
		var wg sync.WaitGroup
		for i, ip := range ips {
			wg.Add(1)
			go func(i int, ip string) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				alive := pingHost(ip)
				ptr := ""
				if alive {
					ptr = ptrLookup(ip)
				}
				results[i] = scanResult{ip, alive, ptr}
			}(i, ip)
		}
		wg.Wait()

		added, updated, alive := 0, 0, 0
		var errs []string
		for _, res := range results {
			if !res.alive {
				continue
			}
			alive++
			if known, ok := globalByIP[res.ip]; ok {
				if known.DNSName == "" && res.ptr != "" {
					if _, err := addrRepo.db.Exec(
						"UPDATE ip_addresses SET dns_name=?, updated_at=? WHERE id=?",
						res.ptr, time.Now(), known.ID,
					); err != nil {
						errs = append(errs, res.ip+": "+err.Error())
					} else {
						updated++
					}
				}
			} else {
				_, err := addrRepo.Create(addressRequest{
					Address:  res.ip,
					PrefixID: &id,
					DNSName:  res.ptr,
					Status:   "pending",
				})
				if err != nil {
					errs = append(errs, res.ip+": "+err.Error())
				} else {
					added++
				}
			}
		}

		respondJSON(w, http.StatusOK, DiscoverResponse{
			Added:   added,
			Updated: updated,
			Alive:   alive,
			Total:   len(ips),
			Errors:  errs,
		})
	}
}
