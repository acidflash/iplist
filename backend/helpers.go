package main

import (
	"encoding/json"
	"fmt"
	"math/big"
	"net"
	"net/http"
)

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func ipNetTotalSize(cidr string) int64 {
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return 0
	}
	ones, bits := ipNet.Mask.Size()
	hostBits := bits - ones
	if hostBits >= 63 {
		// Larger than int64 can hold (huge IPv6 range); treat as uncountable
		// so callers simply don't show a utilization figure.
		return 0
	}
	size := int64(1) << hostBits
	ip, _, _ := net.ParseCIDR(cidr)
	if ip.To4() != nil && ones < 31 {
		size -= 2
	}
	return size
}

type prefixCandidate struct {
	ID     int64
	Prefix string
}

// longestMatchingPrefix returns the ID of the most specific candidate whose
// network contains ip (longest-prefix-match), or nil if none match. Pure
// in-memory scan so callers can reuse one preloaded candidate set across many
// lookups instead of re-querying the whole prefixes table each time.
func longestMatchingPrefix(ip net.IP, candidates []prefixCandidate) *int64 {
	var bestID *int64
	bestOnes := -1
	for _, c := range candidates {
		_, network, err := net.ParseCIDR(c.Prefix)
		if err != nil {
			continue
		}
		if network.Contains(ip) {
			ones, _ := network.Mask.Size()
			if ones > bestOnes {
				bestOnes = ones
				id := c.ID
				bestID = &id
			}
		}
	}
	return bestID
}

func normalizeCIDR(cidr string) (string, error) {
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return "", err
	}
	return ipNet.String(), nil
}

func computeNetworkInfo(cidr string) *NetworkInfo {
	_, network, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil
	}

	ones, bits := network.Mask.Size()
	hostBits := bits - ones
	isIPv4 := bits == 32
	ipSize := bits / 8

	baseInt := new(big.Int).SetBytes(network.IP.To16()[16-ipSize:])

	if isIPv4 {
		// Netmask: fill ones bits from the left
		maskInt := new(big.Int).Not(new(big.Int).Sub(
			new(big.Int).Lsh(big.NewInt(1), uint(hostBits)), big.NewInt(1),
		))
		maskInt.And(maskInt, new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 32), big.NewInt(1)))

		wildcardInt := new(big.Int).Xor(maskInt,
			new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 32), big.NewInt(1)))

		broadcastInt := new(big.Int).Or(baseInt, wildcardInt)

		var firstHost, lastHost net.IP
		if ones < 31 {
			firstHost = intToIP(new(big.Int).Add(baseInt, big.NewInt(1)), 4)
			lastHost = intToIP(new(big.Int).Sub(broadcastInt, big.NewInt(1)), 4)
		} else {
			firstHost = intToIP(baseInt, 4)
			lastHost = intToIP(broadcastInt, 4)
		}

		usable := int64(1) << hostBits
		if ones < 31 {
			usable -= 2
		}

		return &NetworkInfo{
			Version:    4,
			Network:    intToIP(baseInt, 4).String(),
			Broadcast:  intToIP(broadcastInt, 4).String(),
			Netmask:    intToIP(maskInt, 4).String(),
			Wildcard:   intToIP(wildcardInt, 4).String(),
			FirstHost:  firstHost.String(),
			LastHost:   lastHost.String(),
			TotalHosts: fmt.Sprintf("%d", usable),
		}
	}

	// IPv6
	lastInt := new(big.Int).Add(baseInt,
		new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), uint(hostBits)), big.NewInt(1)))

	var totalHosts string
	if hostBits < 63 {
		totalHosts = fmt.Sprintf("%d", int64(1)<<hostBits)
	} else {
		totalHosts = new(big.Int).Lsh(big.NewInt(1), uint(hostBits)).String()
	}

	return &NetworkInfo{
		Version:    6,
		Network:    intToIP(baseInt, 16).String(),
		FirstHost:  intToIP(baseInt, 16).String(),
		LastHost:   intToIP(lastInt, 16).String(),
		TotalHosts: totalHosts,
	}
}
