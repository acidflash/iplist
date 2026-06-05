package main

import "time"

type VLAN struct {
	ID          int64     `json:"id"`
	Vid         int       `json:"vid"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Prefixes    []Prefix  `json:"prefixes,omitempty"`
}

type Prefix struct {
	ID          int64       `json:"id"`
	Prefix      string      `json:"prefix"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Status      string      `json:"status"`
	ParentID    *int64      `json:"parent_id"`
	VlanID      *int64      `json:"vlan_id"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
	Utilization float64     `json:"utilization"`
	TotalIPs    int64       `json:"total_ips"`
	UsedIPs     int64       `json:"used_ips"`
	Children    []Prefix    `json:"children,omitempty"`
	Addresses   []IPAddress `json:"addresses,omitempty"`
	Vlan        *VLAN       `json:"vlan,omitempty"`
}

type IPAddress struct {
	ID          int64     `json:"id"`
	Address     string    `json:"address"`
	PrefixID    *int64    `json:"prefix_id"`
	Hostname    string    `json:"hostname"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	DNSName     string    `json:"dns_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Stats struct {
	TotalPrefixes  int     `json:"total_prefixes"`
	TotalVLANs     int     `json:"total_vlans"`
	TotalAddresses int     `json:"total_addresses"`
	Utilization    float64 `json:"utilization"`
}
