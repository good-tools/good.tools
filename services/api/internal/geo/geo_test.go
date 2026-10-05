package geo

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/maxmind/mmdbwriter"
	"github.com/maxmind/mmdbwriter/mmdbtype"
)

// mmdb builds a tiny database mapping 81.2.69.0/24 to rec.
func mmdb(t *testing.T, dbType string, rec mmdbtype.Map) []byte {
	t.Helper()
	tree, err := mmdbwriter.New(mmdbwriter.Options{DatabaseType: dbType, RecordSize: 24, BuildEpoch: 1700000000,
		Description: map[string]string{"en": "test"}, Languages: []string{"en", "de"}})
	if err != nil {
		t.Fatal(err)
	}
	_, n, _ := net.ParseCIDR("81.2.69.0/24")
	if err := tree.Insert(n, rec); err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	if _, err := tree.WriteTo(&buf); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func en(s string) mmdbtype.Map {
	return mmdbtype.Map{"names": mmdbtype.Map{"en": mmdbtype.String(s), "de": mmdbtype.String(s + "-de")}}
}

func cityDB(t *testing.T, city string) []byte {
	return mmdb(t, "DBIP-City-Lite", mmdbtype.Map{
		"city":         en(city),
		"country":      en("United Kingdom"),
		"continent":    en("Europe"),
		"subdivisions": mmdbtype.Slice{en("England")},
		"location":     mmdbtype.Map{"latitude": mmdbtype.Float64(51.5), "longitude": mmdbtype.Float64(-0.1)},
	})
}

func asnDB(t *testing.T) []byte {
	return mmdb(t, "DBIP-ASN-Lite", mmdbtype.Map{
		"autonomous_system_number":       mmdbtype.Uint32(64500),
		"autonomous_system_organization": mmdbtype.String("Example Net"),
	})
}

func gz(b []byte) []byte {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	_, _ = w.Write(b)
	_ = w.Close()
	return buf.Bytes()
}

var ip = netip.MustParseAddr("81.2.69.160")

func TestDBIP(t *testing.T) {
	city, asn := gz(cityDB(t, "London")), gz(asnDB(t))
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		switch r.URL.Path { // October not published yet → previous month
		case "/free/dbip-city-lite-2026-09.mmdb.gz":
			_, _ = w.Write(city)
		case "/free/dbip-asn-lite-2026-09.mmdb.gz":
			_, _ = w.Write(asn)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	dir := t.TempDir()
	now := func() time.Time { return time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC) }
	d := New(Config{Dir: dir, BaseURL: srv.URL, Now: now})
	defer d.Close()

	if _, err := d.Lookup(ip, "en"); !errors.Is(err, ErrLoading) {
		t.Fatalf("before load: %v", err)
	}
	if err := d.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	res, err := d.Lookup(ip, "de")
	if err != nil {
		t.Fatal(err)
	}
	if res.City != "London-de" || res.Country != "United Kingdom-de" || res.Continent != "Europe-de" ||
		len(res.Subdivisions) != 1 || res.Location.Lat != 51.5 || res.ASN.Number != 64500 ||
		res.ASN.Organization != "Example Net" || res.Build.City != "2023-11-14" || res.Source != dbipSource {
		t.Fatalf("unexpected result %+v", res)
	}
	if res, _ := d.Lookup(ip, "xx"); res.City != "London" {
		t.Fatalf("lang fallback: %q", res.City)
	}

	// Fresh files on disk: a new DB loads them without downloading.
	before := hits.Load()
	d2 := New(Config{Dir: dir, BaseURL: srv.URL, Now: time.Now})
	defer d2.Close()
	if err := d2.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	if hits.Load() != before {
		t.Fatal("fresh databases were downloaded again")
	}
	if _, err := d2.Lookup(ip, "en"); err != nil {
		t.Fatal(err)
	}
}

func TestMaxMind(t *testing.T) {
	tgz := func(name string, b []byte) []byte {
		var buf bytes.Buffer
		zw := gzip.NewWriter(&buf)
		tw := tar.NewWriter(zw)
		_ = tw.WriteHeader(&tar.Header{Name: "GeoLite2_20260101/COPYRIGHT.txt", Mode: 0o644, Size: 2})
		_, _ = tw.Write([]byte("hi"))
		_ = tw.WriteHeader(&tar.Header{Name: "GeoLite2_20260101/" + name, Mode: 0o644, Size: int64(len(b))})
		_, _ = tw.Write(b)
		_ = tw.Close()
		_ = zw.Close()
		return buf.Bytes()
	}
	files := map[string][]byte{
		"GeoLite2-City": tgz("GeoLite2-City.mmdb", cityDB(t, "Paris")),
		"GeoLite2-ASN":  tgz("GeoLite2-ASN.mmdb", asnDB(t)),
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.URL.Path != "/app/geoip_download" || q.Get("license_key") != "k&y" || q.Get("suffix") != "tar.gz" {
			http.Error(w, "bad", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write(files[q.Get("edition_id")])
	}))
	defer srv.Close()

	d := New(Config{Dir: t.TempDir(), BaseURL: srv.URL, LicenseKey: "k&y"})
	defer d.Close()
	if err := d.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	res, err := d.Lookup(ip, "en")
	if err != nil || res.City != "Paris" || res.Source != maxmindSource {
		t.Fatalf("%+v %v", res, err)
	}

	// A bad key must not leak into errors.
	bad := New(Config{Dir: t.TempDir(), BaseURL: "http://127.0.0.1:1", LicenseKey: "secret-key"})
	if err := bad.Refresh(context.Background()); err == nil || strings.Contains(err.Error(), "secret-key") {
		t.Fatalf("err = %v", err)
	}
}

func TestInvalidDownloadKeepsOldDB(t *testing.T) {
	city, asn := gz(cityDB(t, "London")), gz(asnDB(t))
	var broken atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case broken.Load():
			_, _ = w.Write(gz([]byte("not a database")))
		case strings.Contains(r.URL.Path, "city"):
			_, _ = w.Write(city)
		default:
			_, _ = w.Write(asn)
		}
	}))
	defer srv.Close()
	now := time.Now()
	clock := func() time.Time { return now }
	d := New(Config{Dir: t.TempDir(), BaseURL: srv.URL, Now: clock})
	defer d.Close()
	if err := d.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	broken.Store(true)
	now = now.Add(60 * 24 * time.Hour) // everything stale
	if err := d.Refresh(context.Background()); err == nil {
		t.Fatal("expected invalid database error")
	}
	if res, err := d.Lookup(ip, "en"); err != nil || res.City != "London" {
		t.Fatalf("old database lost: %+v %v", res, err)
	}
}

// Swapping readers while lookups run must be race-free (run with -race).
func TestConcurrentSwap(t *testing.T) {
	city, asn := gz(cityDB(t, "London")), gz(asnDB(t))
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "city") {
			_, _ = w.Write(city)
		} else {
			_, _ = w.Write(asn)
		}
	}))
	defer srv.Close()
	d := New(Config{Dir: t.TempDir(), BaseURL: srv.URL})
	defer d.Close()
	if err := d.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	for range 4 {
		wg.Go(func() {
			for ctx.Err() == nil {
				if res, err := d.Lookup(ip, "en"); err != nil || res.City != "London" {
					t.Errorf("lookup during swap: %+v %v", res, err)
					return
				}
			}
		})
	}
	for range 10 {
		if err := d.download(context.Background(), 0); err != nil {
			t.Error(err)
		}
	}
	cancel()
	wg.Wait()
}
