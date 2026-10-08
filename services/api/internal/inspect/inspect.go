// Package inspect requests a URL, follows its redirects one hop at a time and reports
// each hop's status, timing, response headers and TLS connection details.
package inspect

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"strings"
	"time"

	"github.com/good-tools/good.tools/services/api/internal/netx"
)

// Errors the HTTP layer maps to status codes.
var (
	ErrInvalidURL = errors.New("invalid URL: enter a host name or an http(s) URL")
	ErrForbidden  = errors.New("address not allowed: only public hosts can be inspected")
	ErrUpstream   = errors.New("request failed")
)

// MaxHops caps the redirect chain.
const MaxHops = 10

const timeout = 10 * time.Second // per phase: connect, TLS handshake, response headers

// Options exist for tests: AllowPrivate lifts the public-address check, Roots replaces
// the system trust store.
type Options struct {
	AllowPrivate bool
	Roots        *x509.CertPool
}

// Result is the redirect chain. Error says why it stopped early (e.g. a redirect to a
// forbidden address); a failure on the first request is returned as an error instead.
type Result struct {
	Hops  []Hop  `json:"hops"`
	Error string `json:"error,omitempty"`
}

// Hop is one request/response. Response bodies are never read.
type Hop struct {
	URL        string      `json:"url"`
	Status     int         `json:"status"`
	Proto      string      `json:"proto"`
	Location   string      `json:"location,omitempty"`
	RemoteAddr string      `json:"remote_addr,omitempty"`
	Timing     Timing      `json:"timing"`
	Headers    http.Header `json:"headers"`
	TLS        *TLS        `json:"tls,omitempty"`
}

// Timing is in milliseconds; phases that didn't happen (e.g. DNS for an IP) are 0.
type Timing struct {
	DNS     float64 `json:"dns"`
	Connect float64 `json:"connect"`
	TLS     float64 `json:"tls"`
	TTFB    float64 `json:"ttfb"`
	Total   float64 `json:"total"`
}

// TLS describes the negotiated connection. The handshake doesn't verify the chain, so
// broken certificates can still be inspected; Trusted and VerifyError report the result.
type TLS struct {
	Version     string `json:"version"`
	Cipher      string `json:"cipher"`
	ALPN        string `json:"alpn,omitempty"`
	OCSPStapled bool   `json:"ocsp_stapled"`
	Trusted     bool   `json:"trusted"`
	VerifyError string `json:"verify_error,omitempty"`
	Chain       []Cert `json:"chain"`
}

// Cert is one certificate as sent by the server, leaf first.
type Cert struct {
	Subject   string    `json:"subject"`
	Issuer    string    `json:"issuer"`
	SANs      []string  `json:"sans,omitempty"`
	NotBefore time.Time `json:"not_before"`
	NotAfter  time.Time `json:"not_after"`
	DaysLeft  int       `json:"days_left"`
	Key       string    `json:"key"`
	Signature string    `json:"signature"`
}

// Run inspects raw, a URL or bare host name (https:// is assumed).
func Run(ctx context.Context, raw string, o Options) (*Result, error) {
	u, err := parse(raw)
	if err != nil {
		return nil, err
	}
	client := newClient(o)
	res := &Result{Hops: []Hop{}}
	for range MaxHops {
		hop, next, err := fetch(ctx, client, u, o.Roots)
		if err != nil {
			if len(res.Hops) == 0 {
				return nil, err
			}
			res.Error = err.Error()
			if errors.Is(err, ErrForbidden) { // the dial error names the resolved address
				res.Error = ErrForbidden.Error()
			}
			return res, nil
		}
		res.Hops = append(res.Hops, *hop)
		if next == nil {
			return res, nil
		}
		u = next
	}
	res.Error = fmt.Sprintf("stopped after %d redirects", MaxHops)
	return res, nil
}

func parse(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
		return nil, ErrInvalidURL
	}
	u.Fragment = ""
	return u, nil
}

func newClient(o Options) *http.Client {
	d := &net.Dialer{Timeout: timeout, FallbackDelay: -1} // no parallel dials, so trace callbacks don't race
	if !o.AllowPrivate {
		d.Control = netx.PublicOnly(ErrForbidden)
	}
	return &http.Client{
		Transport: &http.Transport{
			Proxy:       nil, // a proxy would dial on our behalf, bypassing the address check
			DialContext: d.DialContext,
			// verification happens after the handshake, in tlsInfo, so bad certificates can be shown
			TLSClientConfig:        &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // see above
			TLSHandshakeTimeout:    timeout,
			ResponseHeaderTimeout:  timeout,
			MaxResponseHeaderBytes: 64 << 10,
			DisableKeepAlives:      true, // a fresh connection (and TLS handshake) per hop
			ForceAttemptHTTP2:      true,
		},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func ms(d time.Duration) float64 { return float64(d.Microseconds()) / 1000 }

func fetch(ctx context.Context, client *http.Client, u *url.URL, roots *x509.CertPool) (*Hop, *url.URL, error) {
	hop := &Hop{URL: u.String()}
	var dnsStart, connStart, tlsStart time.Time
	start := time.Now()
	trace := &httptrace.ClientTrace{
		DNSStart:             func(httptrace.DNSStartInfo) { dnsStart = time.Now() },
		DNSDone:              func(httptrace.DNSDoneInfo) { hop.Timing.DNS = ms(time.Since(dnsStart)) },
		ConnectStart:         func(_, _ string) { connStart = time.Now() },
		ConnectDone:          func(_, _ string, _ error) { hop.Timing.Connect = ms(time.Since(connStart)) },
		TLSHandshakeStart:    func() { tlsStart = time.Now() },
		TLSHandshakeDone:     func(tls.ConnectionState, error) { hop.Timing.TLS = ms(time.Since(tlsStart)) },
		GotConn:              func(i httptrace.GotConnInfo) { hop.RemoteAddr = i.Conn.RemoteAddr().String() },
		GotFirstResponseByte: func() { hop.Timing.TTFB = ms(time.Since(start)) },
	}
	req, err := http.NewRequestWithContext(httptrace.WithClientTrace(ctx, trace), http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, nil, ErrInvalidURL
	}
	req.Header.Set("User-Agent", "good.tools-http-inspector (+https://good.tools)")
	req.Header.Set("Accept-Encoding", "gzip, br") // set explicitly so Go keeps Content-Encoding in the headers
	resp, err := client.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: %w", ErrUpstream, err)
	}
	_ = resp.Body.Close() // the body is never read
	hop.Timing.Total = ms(time.Since(start))
	hop.Status, hop.Proto, hop.Headers = resp.StatusCode, resp.Proto, resp.Header
	if resp.TLS != nil {
		hop.TLS = tlsInfo(resp.TLS, u.Hostname(), roots)
	}
	loc := resp.Header.Get("Location")
	if resp.StatusCode < 300 || resp.StatusCode > 399 || loc == "" {
		return hop, nil, nil
	}
	hop.Location = loc
	next, err := u.Parse(loc)
	if err != nil || (next.Scheme != "http" && next.Scheme != "https") {
		return nil, nil, fmt.Errorf("%w: unsupported redirect to %q", ErrUpstream, loc)
	}
	next.Fragment = ""
	return hop, next, nil
}

func tlsInfo(cs *tls.ConnectionState, host string, roots *x509.CertPool) *TLS {
	t := &TLS{
		Version:     tls.VersionName(cs.Version),
		Cipher:      tls.CipherSuiteName(cs.CipherSuite),
		ALPN:        cs.NegotiatedProtocol,
		OCSPStapled: len(cs.OCSPResponse) > 0,
		Chain:       make([]Cert, 0, len(cs.PeerCertificates)),
	}
	if len(cs.PeerCertificates) > 0 {
		inter := x509.NewCertPool()
		for _, c := range cs.PeerCertificates[1:] {
			inter.AddCert(c)
		}
		_, err := cs.PeerCertificates[0].Verify(x509.VerifyOptions{DNSName: host, Roots: roots, Intermediates: inter})
		t.Trusted = err == nil
		if err != nil {
			t.VerifyError = err.Error()
		}
	}
	for _, c := range cs.PeerCertificates {
		sans := append([]string{}, c.DNSNames...)
		for _, ip := range c.IPAddresses {
			sans = append(sans, ip.String())
		}
		t.Chain = append(t.Chain, Cert{
			Subject:   c.Subject.String(),
			Issuer:    c.Issuer.String(),
			SANs:      sans,
			NotBefore: c.NotBefore,
			NotAfter:  c.NotAfter,
			DaysLeft:  int(time.Until(c.NotAfter).Hours() / 24),
			Key:       keyType(c),
			Signature: c.SignatureAlgorithm.String(),
		})
	}
	return t
}

func keyType(c *x509.Certificate) string {
	switch k := c.PublicKey.(type) {
	case *rsa.PublicKey:
		return fmt.Sprintf("RSA %d", k.N.BitLen())
	case *ecdsa.PublicKey:
		return "ECDSA " + k.Curve.Params().Name
	case ed25519.PublicKey:
		return "Ed25519"
	}
	return c.PublicKeyAlgorithm.String()
}
