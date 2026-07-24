package main

import (
	"net"
	"testing"
)

func TestIPNetTotalSize(t *testing.T) {
	cases := []struct {
		cidr string
		want int64
	}{
		{"192.168.1.0/24", 254},  // network + broadcast excluded
		{"192.168.1.0/31", 2},    // point-to-point, both usable
		{"192.168.1.0/32", 1},    // host route
		{"192.168.1.0/30", 2},    // 4 total - 2
		{"2001:db8::/64", 0},     // huge IPv6 range treated as uncountable
		{"not-a-cidr", 0},
	}
	for _, c := range cases {
		if got := ipNetTotalSize(c.cidr); got != c.want {
			t.Errorf("ipNetTotalSize(%q) = %d, want %d", c.cidr, got, c.want)
		}
	}
}

func TestNormalizeCIDR(t *testing.T) {
	got, err := normalizeCIDR("192.168.1.5/24")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "192.168.1.0/24" {
		t.Errorf("normalizeCIDR host bits not masked: got %q", got)
	}

	if _, err := normalizeCIDR("garbage"); err == nil {
		t.Error("expected error for invalid CIDR")
	}
}

func TestComputeNetworkInfoIPv4(t *testing.T) {
	info := computeNetworkInfo("192.168.1.0/24")
	if info == nil {
		t.Fatal("expected non-nil NetworkInfo")
	}
	if info.Version != 4 {
		t.Errorf("Version = %d, want 4", info.Version)
	}
	if info.Network != "192.168.1.0" {
		t.Errorf("Network = %q, want 192.168.1.0", info.Network)
	}
	if info.Broadcast != "192.168.1.255" {
		t.Errorf("Broadcast = %q, want 192.168.1.255", info.Broadcast)
	}
	if info.Netmask != "255.255.255.0" {
		t.Errorf("Netmask = %q, want 255.255.255.0", info.Netmask)
	}
	if info.FirstHost != "192.168.1.1" || info.LastHost != "192.168.1.254" {
		t.Errorf("host range = %s..%s, want 192.168.1.1..192.168.1.254", info.FirstHost, info.LastHost)
	}
	if info.TotalHosts != "254" {
		t.Errorf("TotalHosts = %q, want 254", info.TotalHosts)
	}
}

func TestComputeNetworkInfoPointToPoint(t *testing.T) {
	// /31 has no network/broadcast reserved — both addresses are usable.
	info := computeNetworkInfo("10.0.0.0/31")
	if info == nil {
		t.Fatal("expected non-nil NetworkInfo")
	}
	if info.FirstHost != "10.0.0.0" || info.LastHost != "10.0.0.1" {
		t.Errorf("host range = %s..%s, want 10.0.0.0..10.0.0.1", info.FirstHost, info.LastHost)
	}
	if info.TotalHosts != "2" {
		t.Errorf("TotalHosts = %q, want 2", info.TotalHosts)
	}
}

func TestComputeNetworkInfoIPv6(t *testing.T) {
	info := computeNetworkInfo("2001:db8::/64")
	if info == nil {
		t.Fatal("expected non-nil NetworkInfo")
	}
	if info.Version != 6 {
		t.Errorf("Version = %d, want 6", info.Version)
	}
	if info.Network != "2001:db8::" {
		t.Errorf("Network = %q, want 2001:db8::", info.Network)
	}
	if info.Broadcast != "" || info.Netmask != "" {
		t.Error("IPv6 should not populate IPv4-only broadcast/netmask fields")
	}
}

func TestComputeNetworkInfoInvalid(t *testing.T) {
	if computeNetworkInfo("not-a-cidr") != nil {
		t.Error("expected nil NetworkInfo for invalid CIDR")
	}
}

func TestLongestMatchingPrefix(t *testing.T) {
	candidates := []prefixCandidate{
		{ID: 1, Prefix: "10.0.0.0/8"},
		{ID: 2, Prefix: "10.1.0.0/16"},
		{ID: 3, Prefix: "10.1.1.0/24"},
		{ID: 4, Prefix: "192.168.0.0/16"},
	}

	got := longestMatchingPrefix(net.ParseIP("10.1.1.5"), candidates)
	if got == nil || *got != 3 {
		t.Errorf("expected longest match id=3, got %v", got)
	}

	got = longestMatchingPrefix(net.ParseIP("10.1.2.5"), candidates)
	if got == nil || *got != 2 {
		t.Errorf("expected longest match id=2, got %v", got)
	}

	got = longestMatchingPrefix(net.ParseIP("172.16.0.1"), candidates)
	if got != nil {
		t.Errorf("expected no match, got %v", got)
	}

	if longestMatchingPrefix(net.ParseIP("10.1.1.5"), nil) != nil {
		t.Error("expected nil match against empty candidate set")
	}
}
