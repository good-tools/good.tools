// Package netx holds network-safety checks shared by the API's outbound features.
package netx

import (
	"net"
	"net/netip"
	"syscall"
)

var cgnat = netip.MustParsePrefix("100.64.0.0/10")

// IsPublic reports whether ip is a globally routable unicast address: not loopback,
// private (including fc00::/7, which covers Fly's fdaa:: network), link-local,
// multicast, unspecified or carrier-grade NAT.
func IsPublic(ip netip.Addr) bool {
	ip = ip.Unmap()
	return ip.IsGlobalUnicast() && !ip.IsPrivate() && !cgnat.Contains(ip)
}

// PublicOnly returns a net.Dialer Control that fails with forbidden for any non-public
// address. It sees the address actually being dialled, after DNS resolution, so a name
// that resolves (or re-resolves, DNS rebinding) to an internal address is still refused.
func PublicOnly(forbidden error) func(network, address string, c syscall.RawConn) error {
	return func(_, address string, _ syscall.RawConn) error {
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return err
		}
		ip, err := netip.ParseAddr(host)
		if err != nil {
			return err
		}
		if !IsPublic(ip) {
			return forbidden
		}
		return nil
	}
}
