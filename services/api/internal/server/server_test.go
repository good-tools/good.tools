package server

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-containerregistry/pkg/name"
	ggcr "github.com/google/go-containerregistry/pkg/registry"
	"github.com/google/go-containerregistry/pkg/v1/empty"
	"github.com/google/go-containerregistry/pkg/v1/mutate"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/google/go-containerregistry/pkg/v1/tarball"

	"github.com/good-tools/good.tools/services/api/internal/geo"
	"github.com/good-tools/good.tools/services/api/internal/registry"
)

func newServer(t *testing.T, env map[string]string) http.Handler {
	t.Helper()
	cfg, err := FromEnv(func(k string) string { return env[k] })
	if err != nil {
		t.Fatal(err)
	}
	b, err := registry.New(registry.Options{CacheDir: t.TempDir(), CacheSize: 1 << 30, MaxSize: cfg.ImageMaxSize, AllowPrivate: cfg.ImageAllowPrivate})
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{Config: cfg, Geo: geo.New(geo.Config{Dir: t.TempDir()}), Images: b, Resolver: "127.0.0.1:1"}
	return s.Handler()
}

func get(h http.Handler, target string, hdr ...string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, target, nil)
	for i := 0; i+1 < len(hdr); i += 2 {
		r.Header.Set(hdr[i], hdr[i+1])
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func message(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("error Content-Type = %q", ct)
	}
	var body struct{ Message string }
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body %q: %v", w.Body, err)
	}
	return body.Message
}

func TestConfig(t *testing.T) {
	c, err := FromEnv(func(k string) string {
		return map[string]string{"CORS_ORIGINS": " https://a.test/, *", "RATE_LIMIT": "0"}[k]
	})
	if err != nil || c.Port != "8080" || c.DataDir != "/data" || c.APIURL != "/api" || c.RateLimit != 0 ||
		c.ImageCacheSize != 5<<30 || c.ImageMaxSize != 0 || c.DisableOnlineTools || len(c.CORSOrigins) != 2 ||
		c.CORSOrigins[0] != "https://a.test" {
		t.Fatalf("%+v %v", c, err)
	}
	for _, bad := range []map[string]string{{"TRUST_PROXY": "all"}, {"RATE_LIMIT": "-1"}, {"ENABLE_TELEMETRY": "maybe"}} {
		if _, err := FromEnv(func(k string) string { return bad[k] }); err == nil {
			t.Errorf("%v accepted", bad)
		}
	}
}

func TestErrorsAndAliases(t *testing.T) {
	h := newServer(t, nil)
	if w := get(h, "/healthz"); w.Code != 200 {
		t.Fatal(w.Code)
	}
	for _, p := range []string{"/v1/dns?domain=bad..domain", "/dns?domain=bad..domain", "/whois?domain=x", "/v1/whois"} {
		if w := get(h, p); w.Code != 400 || message(t, w) != "invalid domain" {
			t.Errorf("%s: %d %s", p, w.Code, w.Body)
		}
	}
	if w := get(h, "/v1/dns?domain=example.com&resolver=nope"); w.Code != 400 {
		t.Errorf("bad resolver: %d", w.Code)
	}
	if w := get(h, "/dns?domain=example.com"); w.Code != 502 { // resolver 127.0.0.1:1 is closed
		t.Errorf("unreachable resolver: %d %s", w.Code, w.Body)
	}
	if w := get(h, "/ip?ip=nope"); w.Code != 400 || message(t, w) != "Invalid IP supplied" {
		t.Errorf("bad ip: %d", w.Code)
	}
	if w := get(h, "/v1/ip?ip=1.1.1.1"); w.Code != 503 || message(t, w) != "geolocation database loading" {
		t.Errorf("loading: %d %s", w.Code, w.Body)
	}
	if w := get(h, "/v1/image"); w.Code != 400 {
		t.Errorf("missing ref: %d", w.Code)
	}
	if w := get(h, "/nope"); w.Code != 404 || message(t, w) != "not found" {
		t.Errorf("404: %d", w.Code)
	}
	if w := get(h, "/api/v1/dns?domain=x"); w.Code != 404 { // /api prefix only with the web app
		t.Errorf("/api without web: %d", w.Code)
	}
}

func TestMyIP(t *testing.T) {
	for trust, want := range map[string]string{"none": "192.0.2.1", "fly": "203.0.113.7", "xff": "198.51.100.2"} {
		h := newServer(t, map[string]string{"TRUST_PROXY": trust})
		// the client controls everything left of the proxy-appended (rightmost) X-Forwarded-For entry
		w := get(h, "/my-ip", "Fly-Client-IP", "203.0.113.7", "X-Forwarded-For", "6.6.6.6, 198.51.100.2", "User-Agent", "ua/1")
		var got map[string]string
		_ = json.Unmarshal(w.Body.Bytes(), &got)
		if got["ip"] != want || got["user_agent"] != "ua/1" {
			t.Errorf("%s: %v", trust, got)
		}
	}
}

func TestRateLimit(t *testing.T) {
	h := newServer(t, map[string]string{"RATE_LIMIT": "3"})
	for i := range 3 {
		if w := get(h, "/v1/my-ip"); w.Code != 200 {
			t.Fatalf("request %d: %d", i, w.Code)
		}
	}
	w := get(h, "/v1/my-ip")
	if w.Code != 429 || w.Header().Get("Retry-After") == "" || message(t, w) == "" {
		t.Fatalf("got %d", w.Code)
	}
	if w := get(h, "/healthz"); w.Code != 200 {
		t.Fatalf("healthz limited: %d", w.Code)
	}
	if w := get(newServer(t, map[string]string{"RATE_LIMIT": "0"}), "/v1/my-ip"); w.Code != 200 {
		t.Fatal("disabled limit")
	}
}

func TestCORS(t *testing.T) {
	none := newServer(t, nil)
	if w := get(none, "/v1/my-ip", "Origin", "https://evil.test"); w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("CORS header without CORS_ORIGINS")
	}
	h := newServer(t, map[string]string{"CORS_ORIGINS": "https://good.tools"})
	if w := get(h, "/v1/my-ip", "Origin", "https://good.tools"); w.Header().Get("Access-Control-Allow-Origin") != "https://good.tools" {
		t.Error("allowed origin missing")
	}
	if w := get(h, "/v1/my-ip", "Origin", "https://evil.test"); w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("disallowed origin allowed")
	}
	r := httptest.NewRequest(http.MethodOptions, "/v1/dns", nil)
	r.Header.Set("Origin", "https://good.tools")
	r.Header.Set("Access-Control-Request-Method", "GET")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 204 || w.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Errorf("preflight: %d %v", w.Code, w.Header())
	}
	pr := newServer(t, map[string]string{"CORS_ORIGINS": "https://good.tools,https://pr-*.good.tools"})
	for origin, want := range map[string]bool{
		"https://pr-29.good.tools":      true,
		"https://pr-.good.tools":        false, // empty label
		"https://pr-1.evil.good.tools":  false, // more than one label
		"https://pr-1.good.tools.evil":  false,
		"http://pr-1.good.tools":        false,
		"https://pr-1_x.good.tools":     false,
		"https://pr-29.good.tools:8443": false,
	} {
		got := get(pr, "/v1/my-ip", "Origin", origin).Header().Get("Access-Control-Allow-Origin") == origin
		if got != want {
			t.Errorf("origin %s: allowed=%v, want %v", origin, got, want)
		}
	}
	star := newServer(t, map[string]string{"CORS_ORIGINS": "*"})
	if w := get(star, "/v1/my-ip", "Origin", "https://x.test"); w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("wildcard")
	}
}

func TestWeb(t *testing.T) {
	dir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(dir, "assets"), 0o750)
	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html><title>app</title>"), 0o600)
	_ = os.WriteFile(filepath.Join(dir, "assets", "app-abc.js"), []byte(strings.Repeat("console.log(1);", 100)), 0o600)
	_ = os.WriteFile(filepath.Join(dir, "favicon.ico"), []byte{0, 0, 1, 0}, 0o600)
	h := newServer(t, map[string]string{"STATIC_DIR": dir, "ENABLE_TELEMETRY": "true", "GA_TRACKING_ID": `G-"x`})

	w := get(h, "/config.js")
	body := w.Body.String()
	for _, want := range []string{`window.__RUNTIME_CONFIG__ = {`, `"ENABLE_TELEMETRY": true`, `"GA_TRACKING_ID": "G-\"x"`,
		`"DISABLE_ONLINE_TOOLS": false`, `"API_URL": "/api"`} {
		if !strings.Contains(body, want) {
			t.Errorf("config.js missing %s:\n%s", want, body)
		}
	}
	if w.Header().Get("Cache-Control") != "no-store" || !strings.HasPrefix(w.Header().Get("Content-Type"), "text/javascript") {
		t.Errorf("config.js headers %v", w.Header())
	}

	for _, p := range []string{"/", "/dns", "/whois?q=x", "/some/deep/route", "/index.html"} {
		w := get(h, p)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "<title>app</title>") || w.Header().Get("Cache-Control") != "no-cache" {
			t.Errorf("%s: %d %q %v", p, w.Code, w.Body, w.Header())
		}
		if w.Header().Get("Cross-Origin-Embedder-Policy") != "require-corp" || w.Header().Get("X-Frame-Options") != "SAMEORIGIN" ||
			w.Header().Get("Cross-Origin-Opener-Policy") != "same-origin" || w.Header().Get("X-Content-Type-Options") != "nosniff" ||
			w.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
			t.Errorf("%s: security headers %v", p, w.Header())
		}
	}
	w = get(h, "/assets/app-abc.js", "Accept-Encoding", "gzip")
	if w.Code != 200 || w.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" ||
		w.Header().Get("Content-Encoding") != "gzip" {
		t.Errorf("asset: %d %v", w.Code, w.Header())
	}
	zr, err := gzip.NewReader(w.Body)
	if err != nil {
		t.Fatal(err)
	}
	if b, _ := io.ReadAll(zr); !strings.HasPrefix(string(b), "console.log") {
		t.Errorf("gunzipped %q", b)
	}
	if w := get(h, "/favicon.ico", "Accept-Encoding", "gzip"); w.Code != 200 || w.Header().Get("Content-Encoding") != "" {
		t.Errorf("binary gzipped: %v", w.Header())
	}
	if w := get(h, "/assets/missing.js"); w.Code != 404 {
		t.Errorf("missing asset: %d", w.Code)
	}
	if w := get(h, "/api/nope"); w.Code != 404 || message(t, w) != "not found" {
		t.Errorf("/api/nope: %d", w.Code)
	}
	if w := get(h, "/api/v1/my-ip"); w.Code != 200 || !strings.Contains(w.Body.String(), `"ip"`) {
		t.Errorf("/api/v1: %d", w.Code)
	}
	if w := get(h, "/api/my-ip"); w.Code != 200 || !strings.Contains(w.Body.String(), `"ip"`) {
		t.Errorf("/api legacy: %d", w.Code)
	}
	if w := get(h, "/v1/my-ip"); w.Code != 200 {
		t.Errorf("/v1 with web: %d", w.Code)
	}

	off := newServer(t, map[string]string{"STATIC_DIR": dir, "DISABLE_ONLINE_TOOLS": "true"})
	if w := get(off, "/api/v1/my-ip"); w.Code != 404 {
		t.Errorf("online tools disabled: %d", w.Code)
	}
}

func TestImageEndpoints(t *testing.T) {
	reg := httptest.NewServer(ggcr.New(ggcr.Logger(log.New(io.Discard, "", 0))))
	defer reg.Close()
	ref := strings.TrimPrefix(reg.URL, "http://") + "/test/img:1"

	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	_ = tw.WriteHeader(&tar.Header{Name: "etc/os-release", Mode: 0o644, Size: 9})
	_, _ = tw.Write([]byte("ID=test\n\n"))
	_ = tw.WriteHeader(&tar.Header{Name: "sh", Typeflag: tar.TypeSymlink, Linkname: "/bin/busybox", Mode: 0o777})
	_ = tw.Close()
	l, _ := tarball.LayerFromOpener(func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(buf.Bytes())), nil
	})
	img, _ := mutate.AppendLayers(empty.Image, l)
	r, _ := name.ParseReference(ref)
	if err := remote.Write(r, img); err != nil {
		t.Fatal(err)
	}

	h := newServer(t, map[string]string{"IMAGE_ALLOW_PRIVATE_REGISTRIES": "true"})
	q := "?ref=" + ref
	w := get(h, "/v1/image"+q)
	var info struct {
		Metadata struct {
			Name, Digest string
			Size         int64
		}
		Image struct {
			RootFS struct {
				DiffIDs []string `json:"diff_ids"`
			} `json:"rootfs"`
		}
	}
	if err := json.Unmarshal(w.Body.Bytes(), &info); err != nil || w.Code != 200 || len(info.Image.RootFS.DiffIDs) != 1 ||
		!strings.HasPrefix(info.Metadata.Digest, "sha256:") {
		t.Fatalf("/image: %d %s", w.Code, w.Body)
	}
	for _, p := range []string{"/v1/image/list", "/list"} {
		w := get(h, p+q+"&path=")
		var files []map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &files)
		if w.Code != 200 || len(files) != 2 || files[1]["name"] != "sh" || files[1]["symlink"] != "/bin/busybox" {
			t.Errorf("%s: %s", p, w.Body)
		}
	}
	for _, p := range []string{"/v1/image/file", "/download"} {
		w := get(h, p+q+"&path=/etc/os-release")
		if w.Code != 200 || w.Body.String() != "ID=test\n\n" ||
			w.Header().Get("Content-Disposition") != "attachment; filename=os-release" {
			t.Errorf("%s: %d %v %q", p, w.Code, w.Header(), w.Body)
		}
	}
	if w := get(h, "/download"+q+"&path=/sh"); w.Code != 400 || message(t, w) != "invalid request: symlinks are not supported" {
		t.Errorf("symlink download: %d %s", w.Code, w.Body)
	}
	if w := get(h, "/download"+q+"&path=/nope"); w.Code != 404 {
		t.Errorf("missing file: %d", w.Code)
	}
	limited := newServer(t, map[string]string{"IMAGE_ALLOW_PRIVATE_REGISTRIES": "true", "IMAGE_MAX_SIZE": "10"})
	if w := get(limited, "/v1/image"+q); w.Code != 413 || !strings.Contains(message(t, w), "limit") {
		t.Errorf("too large: %d %s", w.Code, w.Body)
	}
}

// A private resolver would expose internal DNS (e.g. Fly's fdaa::3 answers *.internal).
func TestDNSRejectsPrivateResolvers(t *testing.T) {
	h := newServer(t, nil)
	for _, r := range []string{"127.0.0.1", "10.0.0.53", "fdaa::3", "169.254.169.253"} {
		w := get(h, "/v1/dns?domain=example.com&resolver="+r)
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "public IP") {
			t.Errorf("resolver %s: %d %s", r, w.Code, w.Body.String())
		}
	}
}

func TestHTTPInspectRefusesInternalTargets(t *testing.T) {
	h := newServer(t, nil)
	for _, u := range []string{"http://127.0.0.1:1/", "localhost", "http://169.254.169.254/latest/meta-data/", "http://[fd00::1]/"} {
		w := get(h, "/v1/http-inspect?url="+url.QueryEscape(u))
		if w.Code != http.StatusBadRequest || !strings.Contains(message(t, w), "only public hosts") {
			t.Errorf("%s: %d %s", u, w.Code, w.Body)
		}
	}
	if w := get(h, "/http-inspect?url=ftp://example.com"); w.Code != http.StatusBadRequest || !strings.Contains(message(t, w), "invalid URL") {
		t.Errorf("ftp: %d %s", w.Code, w.Body)
	}
}
