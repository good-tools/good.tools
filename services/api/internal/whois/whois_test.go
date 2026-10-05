package whois

import (
	"bufio"
	"errors"
	"net"
	"strings"
	"testing"

	"github.com/good-tools/good.tools/services/api/internal/dns"
)

// fakeNet routes every WHOIS dial to one local listener and answers by "server|query".
type fakeNet struct {
	addr string
}

func (f *fakeNet) Dial(network, addr string) (net.Conn, error) {
	host, _, _ := net.SplitHostPort(addr)
	c, err := net.Dial(network, f.addr)
	if err != nil {
		return nil, err
	}
	// first line written identifies the dialed host to the server
	_, err = c.Write([]byte(host + "\n"))
	return c, err
}

func newFake(t *testing.T, answers map[string]string) *fakeNet {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = l.Close() })
	f := &fakeNet{addr: l.Addr().String()}
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			go func() {
				defer func() { _ = c.Close() }()
				r := bufio.NewReader(c)
				host, _ := r.ReadString('\n')
				q, _ := r.ReadString('\n')
				key := strings.TrimSpace(host) + "|" + strings.TrimSpace(q)
				if a, ok := answers[key]; ok {
					_, _ = c.Write([]byte(a))
				}
			}()
		}
	}()
	return f
}

func TestLookup(t *testing.T) {
	f := newFake(t, map[string]string{
		"whois.iana.org|com":                      "refer: whois.example-registry.test\n",
		"whois.example-registry.test|example.com": "Domain Name: EXAMPLE.COM\n",
		"whois.iana.org|zz":                       "domain: ZZ\n", // no whois server published
		"whois.nic.zz|example.zz":                 "Domain: example.zz (via nic)\n",
	})
	c := NewClient().SetDialer(f).SetDisableStats(true)

	got, err := Lookup(c, "www.Example.com")
	if err != nil || got != "Domain Name: EXAMPLE.COM" {
		t.Fatalf("got %q, %v", got, err)
	}

	got, err = Lookup(c, "example.zz")
	if err != nil || !strings.Contains(got, "via nic") {
		t.Fatalf("fallback: got %q, %v", got, err)
	}

	if _, err := Lookup(c, "example.yy"); !errors.Is(err, ErrNoServer) {
		t.Fatalf("no server: err = %v", err)
	}
	if _, err := Lookup(c, "not a domain"); !errors.Is(err, dns.ErrInvalidDomain) {
		t.Fatalf("invalid: err = %v", err)
	}
}
