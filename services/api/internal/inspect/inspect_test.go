package inspect

import (
	"context"
	"crypto/x509"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRedirectChainAndTLS(t *testing.T) {
	tlsSrv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/final#frag", http.StatusFound)
			return
		}
		w.Header().Set("Strict-Transport-Security", "max-age=63072000")
		_, _ = w.Write([]byte(strings.Repeat("x", 1<<20))) // never read
	}))
	tlsSrv.EnableHTTP2 = true
	tlsSrv.StartTLS()
	defer tlsSrv.Close()
	plain := httptest.NewServer(http.RedirectHandler(tlsSrv.URL+"/", http.StatusMovedPermanently))
	defer plain.Close()

	roots := x509.NewCertPool()
	roots.AddCert(tlsSrv.Certificate())
	res, err := Run(context.Background(), plain.URL, Options{AllowPrivate: true, Roots: roots})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Hops) != 3 || res.Error != "" {
		t.Fatalf("hops %+v, error %q", res.Hops, res.Error)
	}
	h0, h1, h2 := res.Hops[0], res.Hops[1], res.Hops[2]
	if h0.Status != 301 || h0.Location != tlsSrv.URL+"/" || h0.TLS != nil || h0.RemoteAddr == "" {
		t.Errorf("hop 0: %+v", h0)
	}
	if h1.Status != 302 || h1.Location != "/final#frag" || h2.URL != tlsSrv.URL+"/final" {
		t.Errorf("hop 1: %+v, hop 2 url %s", h1, h2.URL)
	}
	if h2.Status != 200 || h2.Proto != "HTTP/2.0" || h2.Headers.Get("Strict-Transport-Security") == "" || h2.Timing.Total <= 0 {
		t.Errorf("hop 2: %+v", h2)
	}
	tl := h2.TLS
	if tl == nil || tl.Version != "TLS 1.3" || tl.ALPN != "h2" || tl.Cipher == "" || !tl.Trusted || len(tl.Chain) != 1 {
		t.Fatalf("tls: %+v", tl)
	}
	c := tl.Chain[0]
	if !strings.Contains(c.Subject, "O=Acme Co") || c.Key != "RSA 2048" || c.DaysLeft <= 0 || !strings.Contains(strings.Join(c.SANs, ","), "127.0.0.1") {
		t.Errorf("cert: %+v", c)
	}

	// without the test CA the chain is reported, not refused
	res, err = Run(context.Background(), tlsSrv.URL+"/final", Options{AllowPrivate: true})
	if err != nil || res.Hops[0].TLS.Trusted || res.Hops[0].TLS.VerifyError == "" {
		t.Fatalf("untrusted: %+v %v", res, err)
	}
}

func TestRedirectLimit(t *testing.T) {
	srv := httptest.NewServer(http.RedirectHandler("/", http.StatusFound))
	defer srv.Close()
	res, err := Run(context.Background(), srv.URL, Options{AllowPrivate: true})
	if err != nil || len(res.Hops) != MaxHops || !strings.Contains(res.Error, "redirects") {
		t.Fatalf("%d hops, %q, %v", len(res.Hops), res.Error, err)
	}
}

func TestRefusesNonPublicAddresses(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("request reached a loopback server")
	}))
	defer srv.Close()
	port := srv.URL[strings.LastIndex(srv.URL, ":"):]
	for _, u := range []string{
		srv.URL,
		"localhost" + port, // a name is checked after resolution, at dial time
		"http://[::1]" + port,
		"http://169.254.169.254/latest/meta-data/",
		"http://10.0.0.1",
	} {
		if _, err := Run(context.Background(), u, Options{}); !errors.Is(err, ErrForbidden) {
			t.Errorf("%s: %v", u, err)
		}
	}
}

func TestParse(t *testing.T) {
	for _, bad := range []string{"", "ftp://example.com", "https://", "http://user:pw@example.com", "javascript:alert(1)"} {
		if _, err := parse(bad); !errors.Is(err, ErrInvalidURL) {
			t.Errorf("%q: %v", bad, err)
		}
	}
	if u, err := parse(" example.com/a#b "); err != nil || u.String() != "https://example.com/a" {
		t.Errorf("bare host: %v %v", u, err)
	}
}
