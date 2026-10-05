// Package whois looks up the WHOIS record of a registrable domain.
package whois

import (
	"errors"
	"fmt"
	"strings"
	"time"

	lib "github.com/likexian/whois"
	"golang.org/x/net/publicsuffix"

	"github.com/good-tools/good.tools/services/api/internal/dns"
)

// ErrNoServer means neither IANA nor whois.nic.<tld> know a WHOIS server for the TLD.
var ErrNoServer = errors.New("no WHOIS server found")

// NewClient returns a client with a sane timeout. Tests replace the dialer.
func NewClient() *lib.Client {
	return lib.NewClient().SetTimeout(10 * time.Second)
}

// Lookup validates domain, reduces it to its registrable part (www.example.co.uk →
// example.co.uk) and queries WHOIS via the IANA referral. If IANA publishes no server
// for the TLD, or that server fails, whois.nic.<tld> is tried before giving up.
func Lookup(c *lib.Client, domain string) (string, error) {
	d, err := dns.Normalize(domain)
	if err != nil {
		return "", err
	}
	if reg, err := publicsuffix.EffectiveTLDPlusOne(d); err == nil {
		d = reg
	}
	res, err := c.Whois(d)
	if err == nil && strings.TrimSpace(res) != "" {
		return res, nil
	}
	tld := d[strings.LastIndexByte(d, '.')+1:]
	if res, ferr := c.Whois(d, "whois.nic."+tld); ferr == nil && strings.TrimSpace(res) != "" {
		return res, nil
	}
	if err == nil || errors.Is(err, lib.ErrWhoisServerNotFound) {
		return "", fmt.Errorf("%w for .%s", ErrNoServer, tld)
	}
	return "", err
}
