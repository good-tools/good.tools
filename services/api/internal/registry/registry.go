// Package registry browses container image filesystems straight from a registry:
// no daemon, no root, no mounts. Layers are cached compressed on disk; a flattened
// file index (whiteouts applied) is kept in memory; file bytes come from the layer tar.
package registry

import (
	"archive/tar"
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"os"
	"path"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/good-tools/good.tools/services/api/internal/netx"

	"github.com/google/go-containerregistry/pkg/name"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/google/go-containerregistry/pkg/v1/remote/transport"
	"github.com/klauspost/compress/gzip"
	"github.com/klauspost/compress/zstd"
	"golang.org/x/sync/singleflight"
)

// Errors the HTTP layer maps to status codes.
var (
	ErrInvalid       = errors.New("invalid request")
	ErrTooLarge      = errors.New("image too large")
	ErrNotFound      = errors.New("not found")
	ErrForbiddenHost = errors.New("registry address not allowed")
	ErrUpstream      = errors.New("registry error")
)

// BuildTimeout bounds pulling and indexing one image.
const BuildTimeout = 10 * time.Minute

// Options configures a Browser.
type Options struct {
	CacheDir     string // compressed layer blobs
	CacheSize    int64  // disk cap for CacheDir
	MaxSize      int64  // max compressed image size; 0 = unlimited
	Images       int    // in-memory file indexes kept (LRU by count)
	AllowPrivate bool   // allow registries on loopback/private addresses (tests, self-hosted registries)
}

// Browser serves image metadata, listings and files.
type Browser struct {
	opts   Options
	remote []remote.Option
	blobs  *lru[string] // digest → path
	images *lru[*image] // ref → index
	sf     singleflight.Group
}

// Info is the /image response.
type Info struct {
	Metadata struct {
		Name   string `json:"name"`
		Digest string `json:"digest"`
		Size   int64  `json:"size"`
	} `json:"metadata"`
	Image json.RawMessage `json:"image"` // the OCI image config, verbatim
}

// File is one /list entry.
type File struct {
	Name         string    `json:"name"`
	Directory    bool      `json:"directory"`
	Mode         string    `json:"mode"`
	Size         int64     `json:"size"`
	Symlink      *string   `json:"symlink,omitempty"`
	UID          int       `json:"uid"`
	GID          int       `json:"gid"`
	CreationTime time.Time `json:"creation_time"`
	ModifyTime   time.Time `json:"modify_time"`
	MimeType     string    `json:"mime_type,omitempty"`
}

type entry struct {
	File
	typ    byte
	layer  int
	source string // normalized tar path holding the bytes (link target for hard links)
	sized  bool   // hard link whose size was resolved within its own layer
}

type image struct {
	info     Info
	repo     name.Repository
	layers   []v1.Hash
	sizes    []int64 // compressed layer sizes from the manifest
	files    map[string]*entry
	children map[string][]*entry
}

// New prepares the cache directory and indexes blobs left by a previous run.
func New(opts Options) (*Browser, error) {
	if opts.Images <= 0 {
		opts.Images = 16
	}
	if err := os.MkdirAll(opts.CacheDir, 0o750); err != nil {
		return nil, err
	}
	b := &Browser{
		opts:   opts,
		blobs:  newLRU(opts.CacheSize, func(_ string, p string) { _ = os.Remove(p) }),
		images: newLRU[*image](int64(opts.Images), nil),
	}
	b.remote = []remote.Option{remote.WithUserAgent("good.tools-api")}
	if !opts.AllowPrivate {
		b.remote = append(b.remote, remote.WithTransport(publicOnlyTransport()))
	}

	ents, err := os.ReadDir(opts.CacheDir)
	if err != nil {
		return nil, err
	}
	type blob struct {
		name string
		fi   os.FileInfo
	}
	var existing []blob
	for _, e := range ents {
		p := filepath.Join(opts.CacheDir, e.Name())
		fi, err := e.Info()
		if err != nil || !fi.Mode().IsRegular() || strings.HasPrefix(e.Name(), ".") {
			_ = os.RemoveAll(p) // leftover temp files
			continue
		}
		existing = append(existing, blob{e.Name(), fi})
	}
	sort.Slice(existing, func(i, j int) bool { return existing[i].fi.ModTime().Before(existing[j].fi.ModTime()) })
	for _, e := range existing {
		b.blobs.add("sha256:"+e.name, filepath.Join(opts.CacheDir, e.name), e.fi.Size())
	}
	return b, nil
}

// publicOnlyTransport refuses to dial loopback, private, link-local and other
// non-public addresses, so image refs can't be used to probe internal networks.
func publicOnlyTransport() http.RoundTripper {
	d := &net.Dialer{Timeout: 30 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return err
		}
		ip, err := netip.ParseAddr(host)
		if err != nil {
			return err
		}
		if !netx.IsPublic(ip) {
			return ErrForbiddenHost
		}
		return nil
	}}
	t := remote.DefaultTransport.(*http.Transport).Clone()
	t.Proxy = nil
	t.DialContext = d.DialContext
	return t
}

// Inspect resolves ref, indexes the image (or reuses the index if the digest is
// unchanged) and returns its metadata and config.
func (b *Browser) Inspect(ctx context.Context, ref string) (*Info, error) {
	img, err := b.load(ctx, ref, true)
	if err != nil {
		return nil, err
	}
	return &img.info, nil
}

// List returns the entries of directory p ("" or "/" for the root).
func (b *Browser) List(ctx context.Context, ref, p string) ([]File, error) {
	img, err := b.load(ctx, ref, false)
	if err != nil {
		return nil, err
	}
	p = cleanPath(p)
	if e, ok := img.files[p]; p != "/" && (!ok || e.typ != tar.TypeDir) {
		if !ok {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, p)
		}
		return nil, fmt.Errorf("%w: %s is not a directory", ErrInvalid, p)
	}
	out := make([]File, 0, len(img.children[p]))
	for _, e := range img.children[p] {
		out = append(out, e.File)
	}
	return out, nil
}

// Open returns the metadata and content of regular file p. Symlinks are not followed.
func (b *Browser) Open(ctx context.Context, ref, p string) (*File, io.ReadCloser, error) {
	img, err := b.load(ctx, ref, false)
	if err != nil {
		return nil, nil, err
	}
	p = cleanPath(p)
	e, ok := img.files[p]
	switch {
	case !ok:
		return nil, nil, fmt.Errorf("%w: %s", ErrNotFound, p)
	case e.typ == tar.TypeSymlink:
		return nil, nil, fmt.Errorf("%w: symlinks are not supported", ErrInvalid)
	case e.typ != tar.TypeReg && e.typ != tar.TypeLink:
		return nil, nil, fmt.Errorf("%w: %s is not a regular file", ErrInvalid, p)
	}

	f, err := b.openBlob(ctx, img.repo, img.layers[e.layer], img.sizes[e.layer])
	if err != nil {
		return nil, nil, err
	}
	rc, err := walkLayer(f, func(name string, h *tar.Header, _ io.Reader) (bool, error) {
		return name == e.source && h.Typeflag == tar.TypeReg, nil
	})
	if err != nil {
		return nil, nil, err
	}
	if rc == nil {
		return nil, nil, fmt.Errorf("%w: %s (hard link target missing)", ErrNotFound, p)
	}
	return &e.File, rc, nil
}

// load returns the index for ref, building it once per ref even under concurrency.
// With refresh, the ref is re-resolved and a moved tag rebuilds the index.
func (b *Browser) load(ctx context.Context, ref string, refresh bool) (*image, error) {
	r, err := name.ParseReference(strings.TrimSpace(ref))
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalid, err)
	}
	key := r.Name()
	if img, ok := b.images.get(key); ok && !refresh {
		return img, nil
	}
	v, err, _ := b.sf.Do(key, func() (any, error) {
		// shared by every waiter, so it must not die with the first caller's request
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), BuildTimeout)
		defer cancel()
		desc, err := remote.Get(r, append(b.remote, remote.WithContext(ctx))...)
		if err != nil {
			return nil, upstreamErr(err)
		}
		if img, ok := b.images.get(key); ok && img.info.Metadata.Digest == desc.Digest.String() {
			return img, nil
		}
		img, err := b.build(ctx, r, desc)
		if err != nil {
			return nil, err
		}
		b.images.add(key, img, 1)
		return img, nil
	})
	if err != nil {
		return nil, err
	}
	return v.(*image), nil
}

func upstreamErr(err error) error {
	var te *transport.Error
	switch {
	case errors.Is(err, ErrForbiddenHost), errors.Is(err, context.DeadlineExceeded):
		return err
	case errors.As(err, &te) && (te.StatusCode == http.StatusNotFound || te.StatusCode == http.StatusUnauthorized ||
		te.StatusCode == http.StatusForbidden):
		return fmt.Errorf("%w: image not found (private images are not supported)", ErrNotFound)
	}
	return fmt.Errorf("%w: %w", ErrUpstream, err)
}

func (b *Browser) build(ctx context.Context, r name.Reference, desc *remote.Descriptor) (*image, error) {
	var (
		img v1.Image
		err error
	)
	if desc.MediaType.IsIndex() {
		img, err = pickPlatform(desc)
	} else {
		img, err = desc.Image()
	}
	if err != nil {
		return nil, upstreamErr(err)
	}
	m, err := img.Manifest()
	if err != nil {
		return nil, upstreamErr(err)
	}
	size := m.Config.Size
	for _, l := range m.Layers {
		size += l.Size
	}
	if b.opts.MaxSize > 0 && size > b.opts.MaxSize {
		return nil, fmt.Errorf("%w: %s compressed exceeds the %s limit", ErrTooLarge, human(size), human(b.opts.MaxSize))
	}
	cfg, err := img.RawConfigFile()
	if err != nil {
		return nil, upstreamErr(err)
	}
	layers := make([]v1.Hash, len(m.Layers))
	sizes := make([]int64, len(m.Layers))
	for i, l := range m.Layers {
		layers[i], sizes[i] = l.Digest, l.Size
	}

	out := &image{repo: r.Context(), layers: layers, sizes: sizes, files: map[string]*entry{}, children: map[string][]*entry{}}
	out.info.Metadata.Name = r.Name()
	out.info.Metadata.Digest = desc.Digest.String()
	out.info.Metadata.Size = size
	out.info.Image = cfg

	hidden := map[string]bool{} // whited-out paths (and their subtrees) from newer layers
	opaque := map[string]bool{} // directories whose lower-layer contents are hidden
	for li := len(layers) - 1; li >= 0; li-- {
		f, err := b.openBlob(ctx, out.repo, layers[li], sizes[li])
		if err != nil {
			return nil, err
		}
		var newHidden, newOpaque []string
		// regular-file sizes in this layer: a hard link's bytes come from its own layer, so its
		// size must too (a newer layer may replace or delete the target path)
		layerSizes := map[string]int64{}
		_, err = walkLayer(f, func(p string, h *tar.Header, r io.Reader) (bool, error) {
			if h.Typeflag == tar.TypeReg {
				layerSizes[p] = h.Size
			}
			dir, base := path.Split(p)
			dir = path.Clean(dir)
			switch {
			case base == ".wh..wh..opq":
				newOpaque = append(newOpaque, dir)
				return false, nil
			case strings.HasPrefix(base, ".wh."):
				newHidden = append(newHidden, path.Join(dir, base[len(".wh."):]))
				return false, nil
			}
			if _, ok := out.files[p]; ok || out.shadowed(p, hidden, opaque) {
				return false, nil
			}
			e := &entry{typ: h.Typeflag, layer: li, source: p, File: File{
				Name: base, Directory: h.Typeflag == tar.TypeDir, Mode: h.FileInfo().Mode().String(), Size: h.Size,
				UID: h.Uid, GID: h.Gid, ModifyTime: h.ModTime, CreationTime: h.ChangeTime,
			}}
			if e.CreationTime.IsZero() {
				e.CreationTime = h.ModTime
			}
			switch h.Typeflag {
			case tar.TypeSymlink:
				target := h.Linkname
				e.Symlink = &target
			case tar.TypeLink:
				e.source = cleanPath(h.Linkname)
				e.MimeType = mimeType(base, nil)
				if size, ok := layerSizes[e.source]; ok {
					e.Size, e.sized = size, true
				}
			case tar.TypeReg:
				var head [512]byte
				n, _ := io.ReadFull(r, head[:])
				e.MimeType = mimeType(base, head[:n])
			}
			out.files[p] = e
			return false, nil
		})
		if err != nil {
			return nil, err
		}
		for _, p := range newHidden {
			hidden[p] = true
		}
		for _, p := range newOpaque {
			opaque[p] = true
		}
	}

	// collect first: synthesized parents are added to the map below
	for _, p := range slices.Collect(maps.Keys(out.files)) {
		e := out.files[p]
		if e.typ == tar.TypeLink && !e.sized {
			if t, ok := out.files[e.source]; ok && t.layer == e.layer {
				e.Size, e.MimeType = t.Size, t.MimeType
			}
		}
		// parents missing from the tar are synthesized
		for p != "/" {
			parent := path.Dir(p)
			out.children[parent] = append(out.children[parent], out.files[p])
			if _, ok := out.files[parent]; ok || parent == "/" {
				break
			}
			out.files[parent] = &entry{typ: tar.TypeDir, File: File{Name: path.Base(parent), Directory: true, Mode: "drwxr-xr-x"}}
			p = parent
		}
	}
	for _, c := range out.children {
		slices.SortFunc(c, func(a, b *entry) int { return strings.Compare(a.Name, b.Name) })
	}
	return out, nil
}

// shadowed reports whether a lower-layer path p is hidden by newer layers: whited
// out itself, under a whited-out or opaque directory, or under a newer non-directory.
func (img *image) shadowed(p string, hidden, opaque map[string]bool) bool {
	if hidden[p] {
		return true
	}
	for a := path.Dir(p); ; a = path.Dir(a) {
		if hidden[a] || opaque[a] {
			return true
		}
		if e, ok := img.files[a]; ok && e.typ != tar.TypeDir {
			return true
		}
		if a == "/" {
			return false
		}
	}
}

func pickPlatform(desc *remote.Descriptor) (v1.Image, error) {
	idx, err := desc.ImageIndex()
	if err != nil {
		return nil, err
	}
	im, err := idx.IndexManifest()
	if err != nil {
		return nil, err
	}
	var pick *v1.Descriptor
	for i, m := range im.Manifests {
		p := m.Platform
		if p == nil || p.OS == "unknown" { // attestation manifests
			continue
		}
		if p.OS == "linux" && p.Architecture == "amd64" {
			pick = &im.Manifests[i]
			break
		}
		if pick == nil {
			pick = &im.Manifests[i]
		}
	}
	if pick == nil {
		return nil, fmt.Errorf("%w: image index has no usable platform", ErrInvalid)
	}
	return idx.Image(pick.Digest)
}

// openBlob returns the cached compressed layer, downloading it first if needed.
func (b *Browser) openBlob(ctx context.Context, repo name.Repository, d v1.Hash, size int64) (*os.File, error) {
	for range 2 { // the file can be evicted between caching and opening
		if p, ok := b.blobs.get(d.String()); ok {
			if f, err := os.Open(p); err == nil { // #nosec G304 -- path built from a digest
				return f, nil
			}
		}
		_, err, _ := b.sf.Do("blob:"+d.String(), func() (any, error) {
			ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), BuildTimeout)
			defer cancel()
			return nil, b.download(ctx, repo, d, size)
		})
		if err != nil {
			return nil, err
		}
	}
	return nil, fmt.Errorf("%w: layer %s evicted from cache", ErrUpstream, d)
}

// download caches a layer blob. The registry chooses what it streams, so the copy is capped at
// the size the manifest declared (which IMAGE_MAX_SIZE was checked against).
func (b *Browser) download(ctx context.Context, repo name.Repository, d v1.Hash, size int64) error {
	if _, ok := b.blobs.get(d.String()); ok {
		return nil
	}
	if d.Algorithm != "sha256" || len(d.Hex) != 64 {
		return fmt.Errorf("%w: unsupported digest %s", ErrUpstream, d)
	}
	start := time.Now()
	l, err := remote.Layer(repo.Digest(d.String()), append(b.remote, remote.WithContext(ctx))...)
	if err != nil {
		return upstreamErr(err)
	}
	rc, err := l.Compressed() // verifies the digest while reading
	if err != nil {
		return upstreamErr(err)
	}
	defer func() { _ = rc.Close() }()
	tmp, err := os.CreateTemp(b.opts.CacheDir, ".blob-*")
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	// stop copying when the build is cancelled or times out
	stop := context.AfterFunc(ctx, func() { _ = rc.Close() })
	defer stop()
	n, err := io.Copy(tmp, io.LimitReader(rc, size+1))
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err == nil && n != size {
		err = fmt.Errorf("layer %s is %d bytes but the manifest declares %d", d, n, size)
	}
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return upstreamErr(err)
	}
	p := filepath.Join(b.opts.CacheDir, d.Hex)
	if err := os.Rename(tmp.Name(), p); err != nil {
		return err
	}
	b.blobs.add(d.String(), p, n)
	slog.Info("layer cached", "digest", d.String(), "bytes", n, "duration_ms", time.Since(start).Milliseconds())
	return nil
}

// walkLayer decompresses blob f (gzip, zstd or plain tar) and calls fn per entry with
// its normalized absolute path. When fn returns true, walking stops and the entry's
// content is returned as a ReadCloser that owns f; otherwise f is closed.
func walkLayer(f *os.File, fn func(p string, h *tar.Header, r io.Reader) (bool, error)) (io.ReadCloser, error) {
	closeAll := []func() error{f.Close}
	cleanup := func() {
		for _, c := range closeAll {
			_ = c()
		}
	}
	br := bufio.NewReaderSize(f, 1<<16)
	magic, _ := br.Peek(4)
	var r io.Reader = br
	switch {
	case len(magic) >= 2 && magic[0] == 0x1f && magic[1] == 0x8b:
		gz, err := gzip.NewReader(br)
		if err != nil {
			cleanup()
			return nil, fmt.Errorf("%w: %w", ErrUpstream, err)
		}
		closeAll = append(closeAll, gz.Close)
		r = gz
	case len(magic) == 4 && string(magic) == "\x28\xb5\x2f\xfd":
		zr, err := zstd.NewReader(br)
		if err != nil {
			cleanup()
			return nil, fmt.Errorf("%w: %w", ErrUpstream, err)
		}
		closeAll = append(closeAll, func() error { zr.Close(); return nil })
		r = zr
	}
	tr := tar.NewReader(r)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			cleanup()
			return nil, nil
		}
		if err != nil {
			cleanup()
			return nil, fmt.Errorf("%w: corrupt layer: %w", ErrUpstream, err)
		}
		p := cleanPath(h.Name)
		if p == "/" {
			continue
		}
		stop, err := fn(p, h, tr)
		if err != nil {
			cleanup()
			return nil, err
		}
		if stop {
			return struct {
				io.Reader
				io.Closer
			}{tr, closerFunc(func() error { cleanup(); return nil })}, nil
		}
	}
}

type closerFunc func() error

func (c closerFunc) Close() error { return c() }

func cleanPath(p string) string { return path.Clean("/" + strings.TrimPrefix(p, "./")) }

func mimeType(name string, head []byte) string {
	if t := mime.TypeByExtension(path.Ext(name)); t != "" {
		return t
	}
	if head == nil {
		return ""
	}
	return http.DetectContentType(head)
}

func human(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(n)/float64(div), "KMGTPE"[exp])
}
