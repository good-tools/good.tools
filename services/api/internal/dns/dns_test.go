package dns

import (
	"context"
	"errors"
	"net"
	"testing"

	mdns "github.com/miekg/dns"
)

var zone = map[uint16][]string{
	mdns.TypeA:     {"example.test. 300 IN A 192.0.2.1"},
	mdns.TypeAAAA:  {"example.test. 300 IN AAAA 2001:db8::1"},
	mdns.TypeNS:    {"example.test. 3600 IN NS ns1.example.test.", "example.test. 3600 IN NS ns2.example.test."},
	mdns.TypeMX:    {"example.test. 60 IN MX 10 mail.example.test."},
	mdns.TypeTXT:   {`example.test. 60 IN TXT "v=spf1 ip4:192.0.2" ".1 -all"`},
	mdns.TypeSOA:   {"example.test. 3600 IN SOA ns1.example.test. hostmaster.example.test. 2024010101 7200 900 1209600 86400"},
	mdns.TypeCNAME: {"example.test. 60 IN CNAME target.example.test.", "target.example.test. 60 IN A 192.0.2.9"},
}

// StartServer runs an in-process authoritative server for example.test and returns its address.
func startServer(t *testing.T, network string) string {
	t.Helper()
	handler := mdns.HandlerFunc(func(w mdns.ResponseWriter, r *mdns.Msg) {
		m := new(mdns.Msg)
		m.SetReply(r)
		for _, s := range zone[r.Question[0].Qtype] {
			rr, err := mdns.NewRR(s)
			if err != nil {
				t.Error(err)
			}
			m.Answer = append(m.Answer, rr)
		}
		_ = w.WriteMsg(m)
	})
	srv := &mdns.Server{Handler: handler}
	if network == "udp" {
		pc, err := net.ListenPacket("udp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		srv.PacketConn = pc
	} else {
		l, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		srv.Listener = l
	}
	started := make(chan struct{})
	srv.NotifyStartedFunc = func() { close(started) }
	go func() { _ = srv.ActivateAndServe() }()
	<-started
	t.Cleanup(func() { _ = srv.Shutdown() })
	if srv.PacketConn != nil {
		return srv.PacketConn.LocalAddr().String()
	}
	return srv.Listener.Addr().String()
}

func TestLookup(t *testing.T) {
	for _, network := range []string{"udp", "tcp"} {
		t.Run(network, func(t *testing.T) {
			addr := startServer(t, network)
			got, err := Lookup(context.Background(), "Example.TEST.", addr, network)
			if err != nil {
				t.Fatal(err)
			}
			want := map[string][]Record{
				"A":     {{TTL: "5m0s", Content: "192.0.2.1"}},
				"AAAA":  {{TTL: "5m0s", Content: "2001:db8::1"}},
				"MX":    {{TTL: "1m0s", Content: "mail.example.test.", Priority: 10}},
				"TXT":   {{TTL: "1m0s", Content: "v=spf1 ip4:192.0.2.1 -all"}},
				"SOA":   {{TTL: "1h0m0s", Content: "ns1.example.test. hostmaster.example.test. 2024010101 7200 900 1209600 86400"}},
				"CNAME": {{TTL: "1m0s", Content: "target.example.test."}},
			}
			for k, v := range want {
				if len(got[k]) != 1 || got[k][0] != v[0] {
					t.Errorf("%s = %+v, want %+v", k, got[k], v)
				}
			}
			if len(got["NS"]) != 2 {
				t.Errorf("NS = %+v", got["NS"])
			}
			if len(got) != 7 {
				t.Errorf("got %d types: %v", len(got), got)
			}
		})
	}
}

func TestLookupUnreachable(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	_ = l.Close()
	if _, err := Lookup(context.Background(), "example.test", addr, "tcp"); !errors.Is(err, ErrUnreachable) {
		t.Fatalf("err = %v", err)
	}
}

func TestNormalize(t *testing.T) {
	for in, ok := range map[string]bool{
		"example.com": true, "_dmarc.Example.com.": true, "a-b.co.uk": true,
		"": false, "com": false, "-a.com": false, "a..com": false, "exa mple.com": false,
		"例子.com": false, "a.com/x": false, string(make([]byte, 254)): false,
	} {
		if _, err := Normalize(in); (err == nil) != ok {
			t.Errorf("Normalize(%q) err = %v", in, err)
		}
	}
}
