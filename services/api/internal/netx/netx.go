// Package netx holds network-safety checks shared by the API's outbound features.
package netx

import "net/netip"

var cgnat = netip.MustParsePrefix("100.64.0.0/10")

// IsPublic reports whether ip is a globally routable unicast address: not loopback,
// private (including fc00::/7, which covers Fly's fdaa:: network), link-local,
// multicast, unspecified or carrier-grade NAT.
func IsPublic(ip netip.Addr) bool {
	ip = ip.Unmap()
	return ip.IsGlobalUnicast() && !ip.IsPrivate() && !cgnat.Contains(ip)
}
