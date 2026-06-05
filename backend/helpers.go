package main

import (
	"encoding/json"
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
	size := int64(1) << hostBits
	ip, _, _ := net.ParseCIDR(cidr)
	if ip.To4() != nil && ones < 31 {
		size -= 2
	}
	return size
}

func normalizeCIDR(cidr string) (string, error) {
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return "", err
	}
	return ipNet.String(), nil
}
