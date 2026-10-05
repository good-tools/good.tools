// Package geo answers IP geolocation lookups from MaxMind GeoLite2 (when a licence
// key is configured) or DB-IP Lite databases, downloaded and refreshed at runtime.
package geo

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/oschwald/maxminddb-golang/v2"
)

// ErrLoading is returned until both databases are available.
var ErrLoading = errors.New("geolocation database loading")

// Source names the data provider; DB-IP's CC BY 4.0 licence requires attribution.
type Source struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	License string `json:"license"`
}

var (
	dbipSource    = Source{Name: "IP geolocation by DB-IP", URL: "https://db-ip.com", License: "CC BY 4.0"}
	maxmindSource = Source{
		Name: "GeoLite2 by MaxMind", URL: "https://www.maxmind.com",
		License: "GeoLite2 End User License Agreement",
	}
)

const maxDBSize = 1 << 30 // refuse absurd downloads

// Config configures a DB. Zero values pick production defaults.
type Config struct {
	Dir        string // where the .mmdb files live
	LicenseKey string // MaxMind licence key; empty = DB-IP Lite
	BaseURL    string // override download host (tests)
	Client     *http.Client
	Now        func() time.Time
}

// DB holds the City and ASN readers and keeps them fresh.
type DB struct {
	cfg      Config
	source   Source
	interval time.Duration
	editions [2]string // city, asn

	mu   sync.RWMutex
	rdrs [2]*maxminddb.Reader
}

// New returns a DB; call Run (or Refresh) to load it.
func New(cfg Config) *DB {
	if cfg.Client == nil {
		cfg.Client = &http.Client{Timeout: 10 * time.Minute}
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	d := &DB{cfg: cfg}
	if cfg.LicenseKey != "" {
		d.source, d.interval, d.editions = maxmindSource, 7*24*time.Hour, [2]string{"GeoLite2-City", "GeoLite2-ASN"}
		if d.cfg.BaseURL == "" {
			d.cfg.BaseURL = "https://download.maxmind.com"
		}
	} else {
		d.source, d.interval, d.editions = dbipSource, 30*24*time.Hour, [2]string{"city", "asn"}
		if d.cfg.BaseURL == "" {
			d.cfg.BaseURL = "https://download.db-ip.com"
		}
	}
	return d
}

// Source returns the active provider.
func (d *DB) Source() Source { return d.source }

// Run refreshes now and then hourly (each database is re-downloaded once older than
// the provider's interval) until ctx is done. It never blocks the caller's startup.
func (d *DB) Run(ctx context.Context) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if err := d.Refresh(ctx); err != nil {
			slog.Error("geolocation refresh failed", "err", err)
		}
		select {
		case <-ctx.Done():
			d.Close()
			return
		case <-t.C:
		}
	}
}

// Close releases the readers.
func (d *DB) Close() {
	d.mu.Lock()
	defer d.mu.Unlock()
	for i, r := range d.rdrs {
		if r != nil {
			_ = r.Close()
			d.rdrs[i] = nil
		}
	}
}

func (d *DB) path(i int) string {
	prefix := "dbip-"
	if d.cfg.LicenseKey != "" {
		prefix = "maxmind-"
	}
	return filepath.Join(d.cfg.Dir, prefix+strings.ToLower(d.editions[i])+".mmdb")
}

// Refresh loads databases already on disk and downloads missing or stale ones.
func (d *DB) Refresh(ctx context.Context) error {
	if err := os.MkdirAll(d.cfg.Dir, 0o750); err != nil {
		return err
	}
	var errs []error
	for i := range d.editions {
		p := d.path(i)
		fi, statErr := os.Stat(p)
		d.mu.RLock()
		loaded := d.rdrs[i] != nil
		d.mu.RUnlock()
		if statErr == nil && !loaded {
			if r, err := open(p); err == nil {
				d.install(i, r)
			}
		}
		if statErr == nil && d.cfg.Now().Sub(fi.ModTime()) < d.interval {
			continue
		}
		if err := d.download(ctx, i); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", d.editions[i], err))
		}
	}
	return errors.Join(errs...)
}

func open(p string) (*maxminddb.Reader, error) {
	r, err := maxminddb.Open(p)
	if err != nil {
		return nil, err
	}
	if err := r.Verify(); err != nil {
		_ = r.Close()
		return nil, err
	}
	return r, nil
}

// install swaps in a reader. Lookups hold the read lock for their whole duration,
// so once the write lock is acquired nobody can still be using the old reader.
func (d *DB) install(i int, r *maxminddb.Reader) {
	d.mu.Lock()
	old := d.rdrs[i]
	d.rdrs[i] = r
	d.mu.Unlock()
	if old != nil {
		_ = old.Close()
	}
}

// download fetches edition i into a temp file, verifies it opens, then renames it
// over the live file and swaps the reader in.
func (d *DB) download(ctx context.Context, i int) error {
	body, err := d.fetch(ctx, i)
	if err != nil {
		return err
	}
	defer func() { _ = body.Close() }()

	tmp, err := os.CreateTemp(d.cfg.Dir, ".download-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }() // no-op after a successful rename
	n, err := io.Copy(tmp, io.LimitReader(body, maxDBSize+1))
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return err
	}
	if n > maxDBSize {
		return errors.New("database too large")
	}
	r, err := open(tmp.Name())
	if err != nil {
		return fmt.Errorf("downloaded database is invalid: %w", err)
	}
	if err := os.Rename(tmp.Name(), d.path(i)); err != nil {
		_ = r.Close()
		return err
	}
	d.install(i, r) // the mapping survives the rename (same inode)
	slog.Info("geolocation database updated", "edition", d.editions[i], "build", r.Metadata.BuildTime().UTC())
	return nil
}

// fetch returns a reader of the raw .mmdb for edition i.
func (d *DB) fetch(ctx context.Context, i int) (io.ReadCloser, error) {
	if d.cfg.LicenseKey != "" {
		u := fmt.Sprintf("%s/app/geoip_download?edition_id=%s&license_key=%s&suffix=tar.gz",
			d.cfg.BaseURL, d.editions[i], url.QueryEscape(d.cfg.LicenseKey))
		resp, err := d.get(ctx, u)
		if err != nil {
			return nil, err
		}
		gz, err := gzip.NewReader(resp.Body)
		if err != nil {
			_ = resp.Body.Close()
			return nil, err
		}
		tr := tar.NewReader(gz)
		for {
			h, err := tr.Next()
			if err != nil {
				_ = resp.Body.Close()
				return nil, fmt.Errorf("no .mmdb in archive: %w", err)
			}
			if strings.HasSuffix(h.Name, ".mmdb") {
				return readCloser{tr, resp.Body}, nil
			}
		}
	}

	// DB-IP publishes monthly; early in a month the new file may not exist yet.
	now := d.cfg.Now().UTC()
	var lastErr error
	for _, month := range []time.Time{now, now.AddDate(0, 0, -now.Day())} {
		u := fmt.Sprintf("%s/free/dbip-%s-lite-%s.mmdb.gz", d.cfg.BaseURL, d.editions[i], month.Format("2006-01"))
		resp, err := d.get(ctx, u)
		if err != nil {
			lastErr = err
			continue
		}
		gz, err := gzip.NewReader(resp.Body)
		if err != nil {
			_ = resp.Body.Close()
			return nil, err
		}
		return readCloser{gz, resp.Body}, nil
	}
	return nil, lastErr
}

type readCloser struct {
	io.Reader
	io.Closer
}

func (d *DB) get(ctx context.Context, u string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := d.cfg.Client.Do(req)
	if err != nil {
		// the URL may contain the licence key; don't let it reach the logs
		if ue := (*url.Error)(nil); errors.As(err, &ue) {
			err = ue.Err
		}
		return nil, fmt.Errorf("download failed: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}
	return resp, nil
}

type names struct {
	Names map[string]string `maxminddb:"names"`
}

func (n names) get(lang string) string {
	if v, ok := n.Names[lang]; ok {
		return v
	}
	return n.Names["en"]
}

type cityRecord struct {
	City         names   `maxminddb:"city"`
	Continent    names   `maxminddb:"continent"`
	Country      names   `maxminddb:"country"`
	Subdivisions []names `maxminddb:"subdivisions"`
	Postal       struct {
		Code string `maxminddb:"code"`
	} `maxminddb:"postal"`
	Location struct {
		Latitude       float64 `maxminddb:"latitude"`
		Longitude      float64 `maxminddb:"longitude"`
		AccuracyRadius uint16  `maxminddb:"accuracy_radius"`
		TimeZone       string  `maxminddb:"time_zone"`
	} `maxminddb:"location"`
	Traits struct {
		IsAnonymousProxy    bool `maxminddb:"is_anonymous_proxy"`
		IsSatelliteProvider bool `maxminddb:"is_satellite_provider"`
	} `maxminddb:"traits"`
}

type asnRecord struct {
	Number       uint   `maxminddb:"autonomous_system_number"`
	Organization string `maxminddb:"autonomous_system_organization"`
}

// Result is the /ip response (unchanged shape from the previous service, plus Source).
type Result struct {
	IP           string   `json:"ip"`
	City         string   `json:"city"`
	Country      string   `json:"country"`
	Subdivisions []string `json:"subdivisions"`
	Continent    string   `json:"continent"`
	TimeZone     string   `json:"time_zone"`
	PostalCode   string   `json:"postal_code"`
	Location     struct {
		Lat      float64 `json:"lat"`
		Lng      float64 `json:"lng"`
		Accuracy uint16  `json:"accuracy"`
	} `json:"location"`
	Traits struct {
		AnonymousProxy    bool `json:"anonymous_proxy"`
		SatelliteProvider bool `json:"satellite_provider"`
	} `json:"traits"`
	ASN struct {
		Number       uint   `json:"number"`
		Organization string `json:"organization"`
	} `json:"asn"`
	Build struct {
		City string `json:"city"`
		ASN  string `json:"asn"`
	} `json:"build"`
	Source Source `json:"source"`
}

// Lookup returns location and ASN data for ip with names in lang (falling back to English).
func (d *DB) Lookup(ip netip.Addr, lang string) (*Result, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	city, asnDB := d.rdrs[0], d.rdrs[1]
	if city == nil || asnDB == nil {
		return nil, ErrLoading
	}
	var c cityRecord
	if err := city.Lookup(ip).Decode(&c); err != nil {
		return nil, err
	}
	var a asnRecord
	if err := asnDB.Lookup(ip).Decode(&a); err != nil {
		return nil, err
	}

	res := &Result{
		IP: ip.String(), City: c.City.get(lang), Country: c.Country.get(lang), Continent: c.Continent.get(lang),
		TimeZone: c.Location.TimeZone, PostalCode: c.Postal.Code, Subdivisions: make([]string, len(c.Subdivisions)),
		Source: d.source,
	}
	for i, s := range c.Subdivisions {
		res.Subdivisions[i] = s.get(lang)
	}
	res.Location.Lat, res.Location.Lng, res.Location.Accuracy =
		c.Location.Latitude, c.Location.Longitude, c.Location.AccuracyRadius
	res.Traits.AnonymousProxy, res.Traits.SatelliteProvider = c.Traits.IsAnonymousProxy, c.Traits.IsSatelliteProvider
	res.ASN.Number, res.ASN.Organization = a.Number, a.Organization
	res.Build.City = city.Metadata.BuildTime().UTC().Format(time.DateOnly)
	res.Build.ASN = asnDB.Metadata.BuildTime().UTC().Format(time.DateOnly)
	return res, nil
}
