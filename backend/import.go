package main

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
)

type importResult struct {
	Imported int           `json:"imported"`
	Skipped  int           `json:"skipped"`
	Errors   []importError `json:"errors"`
}

type importError struct {
	Row   int    `json:"row"`
	Error string `json:"error"`
}

func parseCSVUpload(r *http.Request) (headers []string, rows [][]string, err error) {
	if err = r.ParseMultipartForm(8 << 20); err != nil {
		return
	}
	f, _, err := r.FormFile("file")
	if err != nil {
		return
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1

	all, err := reader.ReadAll()
	if err != nil {
		return
	}
	if len(all) == 0 {
		return
	}

	// Normalize header names
	for _, h := range all[0] {
		headers = append(headers, strings.ToLower(strings.TrimSpace(h)))
	}
	rows = all[1:]
	return
}

func colIndex(headers []string, name string) int {
	for i, h := range headers {
		if h == name {
			return i
		}
	}
	return -1
}

func colVal(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

// ImportVLANs handles POST /vlans/import
// Expected CSV columns (order-independent): vid, name, description, status
func ImportVLANs(repo *VLANRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, rows, err := parseCSVUpload(r)
		if err != nil {
			respondError(w, http.StatusBadRequest, "could not parse CSV: "+err.Error())
			return
		}

		vidIdx := colIndex(headers, "vid")
		nameIdx := colIndex(headers, "name")
		descIdx := colIndex(headers, "description")
		statusIdx := colIndex(headers, "status")

		if vidIdx < 0 {
			respondError(w, http.StatusBadRequest, "CSV must have a 'vid' column")
			return
		}

		var result importResult
		result.Errors = []importError{}

		for i, row := range rows {
			lineNum := i + 2 // 1-based, accounting for header row
			if len(row) == 0 || (len(row) == 1 && row[0] == "") {
				continue
			}

			vidStr := colVal(row, vidIdx)
			vid, err := strconv.Atoi(vidStr)
			if err != nil {
				result.Errors = append(result.Errors, importError{Row: lineNum, Error: "invalid vid: " + vidStr})
				result.Skipped++
				continue
			}

			status := colVal(row, statusIdx)
			if status == "" {
				status = "active"
			}

			req := vlanRequest{
				Vid:         vid,
				Name:        colVal(row, nameIdx),
				Description: colVal(row, descIdx),
				Status:      status,
			}
			if _, err := repo.Create(req); err != nil {
				result.Errors = append(result.Errors, importError{Row: lineNum, Error: err.Error()})
				result.Skipped++
				continue
			}
			result.Imported++
		}

		respondJSON(w, http.StatusOK, result)
	}
}

// ImportAddresses handles POST /addresses/import
// Expected CSV columns (order-independent): address, hostname, dns_name, description, status
// Prefix is auto-detected from the address.
func ImportAddresses(repo *AddressRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, rows, err := parseCSVUpload(r)
		if err != nil {
			respondError(w, http.StatusBadRequest, "could not parse CSV: "+err.Error())
			return
		}

		addrIdx := colIndex(headers, "address")
		hostIdx := colIndex(headers, "hostname")
		dnsIdx := colIndex(headers, "dns_name")
		descIdx := colIndex(headers, "description")
		statusIdx := colIndex(headers, "status")

		if addrIdx < 0 {
			respondError(w, http.StatusBadRequest, "CSV must have an 'address' column")
			return
		}

		var result importResult
		result.Errors = []importError{}

		for i, row := range rows {
			lineNum := i + 2
			if len(row) == 0 || (len(row) == 1 && row[0] == "") {
				continue
			}

			addr := colVal(row, addrIdx)
			if addr == "" {
				result.Errors = append(result.Errors, importError{Row: lineNum, Error: "address is empty"})
				result.Skipped++
				continue
			}

			status := colVal(row, statusIdx)
			if status == "" {
				status = "active"
			}

			req := addressRequest{
				Address:     addr,
				Hostname:    colVal(row, hostIdx),
				DNSName:     colVal(row, dnsIdx),
				Description: colVal(row, descIdx),
				Status:      status,
			}
			if _, err := repo.Create(req); err != nil {
				result.Errors = append(result.Errors, importError{Row: lineNum, Error: err.Error()})
				result.Skipped++
				continue
			}
			result.Imported++
		}

		respondJSON(w, http.StatusOK, result)
	}
}

// ImportPrefixes handles POST /prefixes/import
// Expected CSV columns (order-independent): prefix, name, description, status, vlan_vid
// parent_id is auto-detected. vlan_vid matches against VLAN vid numbers.
func ImportPrefixes(prefixRepo *PrefixRepo, vlanRepo *VLANRepo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, rows, err := parseCSVUpload(r)
		if err != nil {
			respondError(w, http.StatusBadRequest, "could not parse CSV: "+err.Error())
			return
		}

		prefixIdx := colIndex(headers, "prefix")
		nameIdx := colIndex(headers, "name")
		descIdx := colIndex(headers, "description")
		statusIdx := colIndex(headers, "status")
		vlanVidIdx := colIndex(headers, "vlan_vid")

		if prefixIdx < 0 {
			respondError(w, http.StatusBadRequest, "CSV must have a 'prefix' column")
			return
		}

		// Build vid→id map so users can reference VLANs by VID number
		vidToID := map[int]int64{}
		if vlanVidIdx >= 0 {
			if vlans, err := vlanRepo.List(); err == nil {
				for _, v := range vlans {
					vidToID[v.Vid] = v.ID
				}
			}
		}

		var result importResult
		result.Errors = []importError{}

		for i, row := range rows {
			lineNum := i + 2
			if len(row) == 0 || (len(row) == 1 && row[0] == "") {
				continue
			}

			cidr := colVal(row, prefixIdx)
			if cidr == "" {
				result.Errors = append(result.Errors, importError{Row: lineNum, Error: "prefix is empty"})
				result.Skipped++
				continue
			}

			status := colVal(row, statusIdx)
			if status == "" {
				status = "active"
			}

			req := prefixRequest{
				Prefix:      cidr,
				Name:        colVal(row, nameIdx),
				Description: colVal(row, descIdx),
				Status:      status,
			}

			if vlanVidIdx >= 0 {
				if vidStr := colVal(row, vlanVidIdx); vidStr != "" {
					vid, err := strconv.Atoi(vidStr)
					if err != nil {
						result.Errors = append(result.Errors, importError{Row: lineNum, Error: "invalid vlan_vid: " + vidStr})
						result.Skipped++
						continue
					}
					if id, ok := vidToID[vid]; ok {
						req.VlanID = &id
					}
				}
			}

			if _, err := prefixRepo.Create(req); err != nil {
				result.Errors = append(result.Errors, importError{Row: lineNum, Error: err.Error()})
				result.Skipped++
				continue
			}
			result.Imported++
		}

		respondJSON(w, http.StatusOK, result)
	}
}
