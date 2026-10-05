package netx

import (
	"net/netip"
	"testing"
)

func TestIsPublic(t *testing.T) {
	for addr, want := range map[string]bool{
		"8.8.8.8":              true,
		"2606:4700:4700::1111": true,
		"127.0.0.1":            false,
		"10.1.2.3":             false,
		"192.168.0.1":          false,
		"169.254.169.254":      false, // cloud metadata
		"100.64.1.1":           false, // CGNAT
		"fdaa::3":              false, // Fly private network DNS
		"::1":                  false,
		"0.0.0.0":              false,
		"::ffff:10.0.0.1":      false, // v4-mapped private
	} {
		if got := IsPublic(netip.MustParseAddr(addr)); got != want {
			t.Errorf("IsPublic(%s) = %v, want %v", addr, got, want)
		}
	}
}
