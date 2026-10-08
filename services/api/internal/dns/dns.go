// Package dns looks up the common record types of a domain in parallel.
package dns

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	mdns "github.com/miekg/dns"
)

// Record is one answer; TTL is a Go duration string ("5m0s") as the frontend expects.
type Record struct {
	TTL      string `json:"ttl"`
	Content  string `json:"content"`
	Priority uint16 `json:"priority"`
}

// ErrInvalidDomain is returned for anything that isn't a plausible host name.
var ErrInvalidDomain = errors.New("invalid domain")

// ErrUnreachable means no query got an answer from the resolver.
var ErrUnreachable = errors.New("DNS resolver did not respond")

var queryTypes = []uint16{
	mdns.TypeA, mdns.TypeAAAA, mdns.TypeNS, mdns.TypeMX, mdns.TypeTXT, mdns.TypeSOA, mdns.TypeCNAME,
}

const (
	timeout = 2 * time.Second
	retries = 1
)

// Normalize lower-cases, strips a trailing dot and validates a domain name
// (ASCII labels of letters, digits, '-' and '_', 1-63 chars, ≤253 total, ≥2 labels).
func Normalize(domain string) (string, error) {
	d := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	if d == "" || len(d) > 253 {
		return "", ErrInvalidDomain
	}
	labels := strings.Split(d, ".")
	if len(labels) < 2 {
		return "", ErrInvalidDomain
	}
	for _, l := range labels {
		if l == "" || len(l) > 63 || l[0] == '-' || l[len(l)-1] == '-' {
			return "", ErrInvalidDomain
		}
		for _, c := range l {
			if (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '-' && c != '_' {
				return "", ErrInvalidDomain
			}
		}
	}
	return d, nil
}

// Lookup queries server ("host:port") for every record type in parallel over
// network ("udp" or "tcp"). Types without answers are omitted from the result.
func Lookup(ctx context.Context, domain, server, network string) (map[string][]Record, error) {
	domain, err := Normalize(domain)
	if err != nil {
		return nil, err
	}

	type answer struct {
		qtype   uint16
		records []Record
		err     error
	}
	answers := make(chan answer, len(queryTypes))
	var wg sync.WaitGroup
	for _, t := range queryTypes {
		wg.Go(func() {
			recs, err := exchange(ctx, domain, server, network, t)
			answers <- answer{t, recs, err}
		})
	}
	wg.Wait()
	close(answers)

	result := map[string][]Record{}
	var lastErr error
	failed := 0
	for a := range answers {
		if a.err != nil {
			failed++
			lastErr = a.err
			continue
		}
		if len(a.records) > 0 {
			result[mdns.TypeToString[a.qtype]] = a.records
		}
	}
	if failed == len(queryTypes) {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, fmt.Errorf("%w: %w", ErrUnreachable, lastErr)
	}
	return result, nil
}

func exchange(ctx context.Context, domain, server, network string, qtype uint16) ([]Record, error) {
	msg := new(mdns.Msg)
	msg.SetQuestion(mdns.Fqdn(domain), qtype)
	client := &mdns.Client{Net: network, Timeout: timeout}
	var (
		res *mdns.Msg
		err error
	)
	for range retries + 1 {
		if res, _, err = client.ExchangeContext(ctx, msg, server); err == nil {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	var out []Record
	for _, rr := range res.Answer {
		// a CNAME query also returns the target's A records etc.; keep only the asked type
		if rr.Header().Rrtype != qtype {
			continue
		}
		rec := Record{TTL: (time.Duration(rr.Header().Ttl) * time.Second).String()}
		switch v := rr.(type) {
		case *mdns.A:
			rec.Content = v.A.String()
		case *mdns.AAAA:
			rec.Content = v.AAAA.String()
		case *mdns.CNAME:
			rec.Content = v.Target
		case *mdns.NS:
			rec.Content = v.Ns
		case *mdns.MX:
			rec.Content, rec.Priority = v.Mx, v.Preference
		case *mdns.TXT:
			// long records are split into 255-byte strings that are concatenated as-is (RFC 7208 §3.3, RFC 6376 §3.6.2.2)
			rec.Content = strings.Join(v.Txt, "")
		case *mdns.SOA:
			rec.Content = fmt.Sprintf("%s %s %d %d %d %d %d", v.Ns, v.Mbox, v.Serial, v.Refresh, v.Retry, v.Expire, v.Minttl)
		}
		if rec.Content != "" {
			out = append(out, rec)
		}
	}
	return out, nil
}
