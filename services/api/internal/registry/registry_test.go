package registry

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/go-containerregistry/pkg/compression"
	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/registry"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/empty"
	"github.com/google/go-containerregistry/pkg/v1/mutate"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/google/go-containerregistry/pkg/v1/tarball"
)

type tf struct {
	name, body, link string
	typ              byte
}

func layer(t *testing.T, comp compression.Compression, files ...tf) v1.Layer {
	t.Helper()
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	for _, f := range files {
		h := &tar.Header{Name: f.name, Typeflag: f.typ, Mode: 0o644, Linkname: f.link, Size: int64(len(f.body)), Uid: 1, Gid: 2}
		if f.typ == 0 {
			h.Typeflag = tar.TypeReg
		}
		if h.Typeflag == tar.TypeDir {
			h.Mode = 0o755
		}
		if h.Typeflag != tar.TypeReg {
			h.Size = 0
		}
		if err := tw.WriteHeader(h); err != nil {
			t.Fatal(err)
		}
		if h.Typeflag == tar.TypeReg {
			_, _ = tw.Write([]byte(f.body))
		}
	}
	_ = tw.Close()
	l, err := tarball.LayerFromOpener(func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(buf.Bytes())), nil
	}, tarball.WithCompression(comp))
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func testImage(t *testing.T, marker string) v1.Image {
	base := layer(t, compression.GZip,
		tf{name: "etc/", typ: tar.TypeDir},
		tf{name: "etc/hosts", body: "127.0.0.1 localhost\n"},
		tf{name: "etc/hosts.hl", typ: tar.TypeLink, link: "etc/hosts"},
		tf{name: "etc/passwd", body: "root:x:0:0\n"},
		tf{name: "./data/old/a.txt", body: "old"},
		tf{name: "data/keep.txt", body: "keep"},
		tf{name: "opq/lower.txt", body: "lower"},
		tf{name: "replaced/child.txt", body: "hidden by a file"},
		tf{name: "bin/tool", body: "\x7fELF\x02\x01\x01\x00binary"},
		tf{name: "link", typ: tar.TypeSymlink, link: "/etc/hosts"},
	)
	top := layer(t, compression.ZStd,
		tf{name: "etc/.wh.passwd"},
		tf{name: "data/.wh.old"},
		tf{name: "opq/", typ: tar.TypeDir},
		tf{name: "opq/.wh..wh..opq"},
		tf{name: "opq/upper.txt", body: "upper"},
		tf{name: "etc/hosts", body: "updated\n"},
		tf{name: "replaced", body: "now a file"},
		tf{name: "escape", typ: tar.TypeSymlink, link: "../../../../etc/shadow"},
		tf{name: "marker", body: marker},
	)
	img, err := mutate.AppendLayers(empty.Image, base, top)
	if err != nil {
		t.Fatal(err)
	}
	cfg, _ := img.ConfigFile()
	cfg.OS, cfg.Architecture = "linux", "amd64"
	cfg.Config.Env = []string{"PATH=/bin"}
	img, err = mutate.ConfigFile(img, cfg)
	if err != nil {
		t.Fatal(err)
	}
	return img
}

// startRegistry runs an in-memory registry and counts blob downloads.
func startRegistry(t *testing.T) (host string, blobGets *atomic.Int32) {
	t.Helper()
	blobGets = new(atomic.Int32)
	reg := registry.New(registry.Logger(log.New(io.Discard, "", 0)))
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/blobs/") {
			blobGets.Add(1)
		}
		reg.ServeHTTP(w, r)
	}))
	t.Cleanup(srv.Close)
	return strings.TrimPrefix(srv.URL, "http://"), blobGets
}

func push(t *testing.T, ref string, img v1.Image) {
	t.Helper()
	r, err := name.ParseReference(ref)
	if err != nil {
		t.Fatal(err)
	}
	if err := remote.Write(r, img); err != nil {
		t.Fatal(err)
	}
}

func newBrowser(t *testing.T, dir string, o Options) *Browser {
	t.Helper()
	o.CacheDir, o.AllowPrivate = dir, true
	if o.CacheSize == 0 {
		o.CacheSize = 1 << 30
	}
	b, err := New(o)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func names(fs []File) []string {
	var out []string
	for _, f := range fs {
		out = append(out, f.Name)
	}
	return out
}

func read(t *testing.T, b *Browser, ref, p string) string {
	t.Helper()
	_, rc, err := b.Open(context.Background(), ref, p)
	if err != nil {
		t.Fatalf("open %s: %v", p, err)
	}
	defer func() { _ = rc.Close() }()
	data, _ := io.ReadAll(rc)
	return string(data)
}

func TestBrowse(t *testing.T) {
	host, blobGets := startRegistry(t)
	ref := host + "/test/img:latest"
	push(t, ref, testImage(t, "amd64"))
	ctx := context.Background()
	dir := t.TempDir()
	b := newBrowser(t, dir, Options{})

	info, err := b.Inspect(ctx, ref)
	if err != nil {
		t.Fatal(err)
	}
	var cfg v1.ConfigFile
	if err := json.Unmarshal(info.Image, &cfg); err != nil || cfg.Architecture != "amd64" || len(cfg.RootFS.DiffIDs) != 2 ||
		cfg.Config.Env[0] != "PATH=/bin" {
		t.Fatalf("config %+v %v", cfg, err)
	}
	if !strings.HasPrefix(info.Metadata.Digest, "sha256:") || info.Metadata.Size == 0 || info.Metadata.Name != ref {
		t.Fatalf("metadata %+v", info.Metadata)
	}

	cases := map[string][]string{
		"":          {"bin", "data", "escape", "etc", "link", "marker", "opq", "replaced"},
		"/etc":      {"hosts", "hosts.hl"},
		"/data":     {"keep.txt"},
		"/opq":      {"upper.txt"},
		"/data/../": {"bin", "data", "escape", "etc", "link", "marker", "opq", "replaced"},
	}
	for p, want := range cases {
		got, err := b.List(ctx, ref, p)
		if err != nil || !slices.Equal(names(got), want) {
			t.Errorf("List(%q) = %v, %v; want %v", p, names(got), err, want)
		}
	}

	root, _ := b.List(ctx, ref, "/")
	for _, f := range root {
		switch f.Name {
		case "link":
			if f.Symlink == nil || *f.Symlink != "/etc/hosts" || f.MimeType != "" || f.Mode[0] != 'L' {
				t.Errorf("link entry %+v", f)
			}
		case "etc":
			if !f.Directory || f.Mode != "drwxr-xr-x" || f.UID != 1 || f.GID != 2 {
				t.Errorf("etc entry %+v", f)
			}
		case "bin", "data":
			if !f.Directory {
				t.Errorf("synthesized dir %+v", f)
			}
		case "replaced":
			if f.Directory {
				t.Errorf("replaced should be a file: %+v", f)
			}
		}
	}
	etc, _ := b.List(ctx, ref, "/etc")
	if etc[0].MimeType != "text/plain; charset=utf-8" || etc[0].Size != 8 {
		t.Errorf("hosts entry %+v", etc[0])
	}
	bin, _ := b.List(ctx, ref, "/bin")
	if bin[0].MimeType != "application/octet-stream" {
		t.Errorf("binary mime %q", bin[0].MimeType)
	}

	if got := read(t, b, ref, "/etc/hosts"); got != "updated\n" {
		t.Errorf("hosts = %q", got)
	}
	if got := read(t, b, ref, "etc/hosts.hl"); got != "127.0.0.1 localhost\n" {
		t.Errorf("hard link = %q", got)
	}
	if got := read(t, b, ref, "/opq/upper.txt"); got != "upper" {
		t.Errorf("upper = %q", got)
	}

	for p, want := range map[string]error{
		"/link": ErrInvalid, "/escape": ErrInvalid, "/etc": ErrInvalid,
		"/etc/passwd": ErrNotFound, "/data/old/a.txt": ErrNotFound, "/opq/lower.txt": ErrNotFound,
		"/replaced/child.txt": ErrNotFound, "/../../etc/shadow": ErrNotFound,
	} {
		if _, _, err := b.Open(ctx, ref, p); !errors.Is(err, want) {
			t.Errorf("Open(%s) err = %v, want %v", p, err, want)
		}
	}
	if _, err := b.List(ctx, ref, "/etc/hosts"); !errors.Is(err, ErrInvalid) {
		t.Errorf("List(file) err = %v", err)
	}
	if _, err := b.List(ctx, ref, "/nope"); !errors.Is(err, ErrNotFound) {
		t.Errorf("List(missing) err = %v", err)
	}

	// Cache reuse: a fresh browser on the same cache dir downloads no blobs except the config.
	before := blobGets.Load()
	b2 := newBrowser(t, dir, Options{})
	if _, err := b2.Inspect(ctx, ref); err != nil {
		t.Fatal(err)
	}
	if got := read(t, b2, ref, "/marker"); got != "amd64" {
		t.Errorf("marker = %q", got)
	}
	if n := blobGets.Load() - before; n != 1 { // config blob only
		t.Errorf("blob GETs after restart = %d, want 1", n)
	}
}

func TestErrors(t *testing.T) {
	host, _ := startRegistry(t)
	ref := host + "/test/img:latest"
	push(t, ref, testImage(t, "x"))
	ctx := context.Background()

	small := newBrowser(t, t.TempDir(), Options{MaxSize: 100})
	if _, err := small.Inspect(ctx, ref); !errors.Is(err, ErrTooLarge) {
		t.Errorf("size limit err = %v", err)
	}
	b := newBrowser(t, t.TempDir(), Options{})
	if _, err := b.Inspect(ctx, host+"/test/missing:latest"); !errors.Is(err, ErrNotFound) {
		t.Errorf("missing err = %v", err)
	}
	if _, err := b.Inspect(ctx, "UPPER/case::bad"); !errors.Is(err, ErrInvalid) {
		t.Errorf("bad ref err = %v", err)
	}

	guarded, err := New(Options{CacheDir: t.TempDir(), CacheSize: 1 << 20})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := guarded.Inspect(ctx, ref); !errors.Is(err, ErrForbiddenHost) {
		t.Errorf("private registry err = %v", err)
	}
}

func TestMultiArchAndEviction(t *testing.T) {
	host, blobGets := startRegistry(t)
	ref := host + "/test/multi:latest"
	idx := mutate.AppendManifests(empty.Index,
		mutate.IndexAddendum{Add: testImage(t, "arm64"), Descriptor: v1.Descriptor{Platform: &v1.Platform{OS: "linux", Architecture: "arm64"}}},
		mutate.IndexAddendum{Add: testImage(t, "amd64"), Descriptor: v1.Descriptor{Platform: &v1.Platform{OS: "linux", Architecture: "amd64"}}},
	)
	r, _ := name.ParseReference(ref)
	if err := remote.WriteIndex(r, idx); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	b := newBrowser(t, dir, Options{CacheSize: 1}) // every layer evicts the previous one
	info, err := b.Inspect(context.Background(), ref)
	if err != nil {
		t.Fatal(err)
	}
	d, _ := idx.Digest()
	if info.Metadata.Digest != d.String() {
		t.Errorf("digest %s, want index digest %s", info.Metadata.Digest, d)
	}
	if got := read(t, b, ref, "/marker"); got != "amd64" {
		t.Errorf("marker = %q", got)
	}
	if got := read(t, b, ref, "/etc/hosts.hl"); got != "127.0.0.1 localhost\n" { // evicted base layer re-fetched
		t.Errorf("hard link = %q", got)
	}
	if ents, _ := os.ReadDir(dir); len(ents) != 1 {
		t.Errorf("cache holds %d blobs, want 1", len(ents))
	}

	// Concurrent first requests for one image build it once.
	b2 := newBrowser(t, t.TempDir(), Options{})
	before := blobGets.Load()
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			if _, err := b2.List(context.Background(), ref, "/etc"); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if n := blobGets.Load() - before; n != 3 { // config + 2 layers
		t.Errorf("blob GETs = %d, want 3", n)
	}
}
