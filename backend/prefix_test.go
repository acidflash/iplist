package main

import "testing"

func TestSplitSubnets(t *testing.T) {
	db := newTestDB(t)
	repo := NewPrefixRepo(db)

	parent, err := repo.Create(prefixRequest{Prefix: "10.0.0.0/24"})
	if err != nil {
		t.Fatalf("create parent: %v", err)
	}
	// Pre-existing exact-match child of the split size.
	child, err := repo.Create(prefixRequest{Prefix: "10.0.0.0/26", ParentID: &parent.ID})
	if err != nil {
		t.Fatalf("create child: %v", err)
	}

	result, err := repo.SplitSubnets(parent, 26)
	if err != nil {
		t.Fatalf("SplitSubnets: %v", err)
	}

	if result.TotalCount != "4" {
		t.Errorf("TotalCount = %q, want 4", result.TotalCount)
	}
	if len(result.Subnets) != 4 {
		t.Fatalf("len(Subnets) = %d, want 4", len(result.Subnets))
	}
	if result.Truncated {
		t.Error("expected Truncated = false for 4 subnets")
	}

	first := result.Subnets[0]
	if first.Subnet != "10.0.0.0/26" {
		t.Errorf("Subnets[0].Subnet = %q, want 10.0.0.0/26", first.Subnet)
	}
	if !first.Allocated || first.PrefixID == nil || *first.PrefixID != child.ID {
		t.Errorf("Subnets[0] should be allocated to child id=%d, got Allocated=%v PrefixID=%v",
			child.ID, first.Allocated, first.PrefixID)
	}

	for i := 1; i < 4; i++ {
		if result.Subnets[i].Allocated {
			t.Errorf("Subnets[%d] (%s) should not be allocated", i, result.Subnets[i].Subnet)
		}
	}
}

func TestSplitSubnetsRejectsOutOfRange(t *testing.T) {
	db := newTestDB(t)
	repo := NewPrefixRepo(db)

	parent, err := repo.Create(prefixRequest{Prefix: "10.0.0.0/24"})
	if err != nil {
		t.Fatalf("create parent: %v", err)
	}

	if _, err := repo.SplitSubnets(parent, 24); err == nil {
		t.Error("expected error splitting into same-or-larger prefix length")
	}
	if _, err := repo.SplitSubnets(parent, 33); err == nil {
		t.Error("expected error splitting IPv4 prefix beyond /32")
	}
}

func TestFindBestParentAmongPicksLongestMatch(t *testing.T) {
	candidates := []prefixCandidate{
		{ID: 1, Prefix: "10.0.0.0/8"},
		{ID: 2, Prefix: "10.1.0.0/16"},
	}
	id, err := findBestParentAmong("10.1.1.0/24", candidates)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id == nil || *id != 2 {
		t.Errorf("expected parent id=2, got %v", id)
	}
}

func TestFindBestParentAmongExcludesSelf(t *testing.T) {
	candidates := []prefixCandidate{
		{ID: 1, Prefix: "10.0.0.0/8"},
		{ID: 2, Prefix: "10.1.0.0/16"},
	}
	// Splitting/re-creating the exact same CIDR shouldn't match itself as parent.
	id, err := findBestParentAmong("10.1.0.0/16", candidates)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id == nil || *id != 1 {
		t.Errorf("expected parent id=1 (self excluded), got %v", id)
	}
}
