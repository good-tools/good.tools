package server

import (
	"compress/gzip"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"runtime/debug"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// recorder captures the status for logging. Unwrap keeps http.ResponseController working.
type recorder struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (r *recorder) WriteHeader(code int) {
	if r.status == 0 {
		r.status = code
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += int64(n)
	return n, err
}

func (r *recorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// logRequests writes one JSON line per request. Only the path is logged, never the
// query string, which carries user input (domains, IPs, image refs).
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &recorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)
		if rec.status == 0 {
			rec.status = http.StatusOK
		}
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status,
			"bytes", rec.bytes, "duration_ms", time.Since(start).Milliseconds())
	})
}

func recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler { // re-panic so net/http aborts the response quietly
					panic(v)
				}
				slog.Error("panic", "path", r.URL.Path, "panic", fmt.Sprint(v), "stack", string(debug.Stack()))
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		// cross-origin isolation: the web app needs SharedArrayBuffer (wasm threads)
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Cross-Origin-Embedder-Policy", "require-corp")
		next.ServeHTTP(w, r)
	})
}

// cors allows the configured origins (or "*"); with none configured, no CORS headers
// are sent and browsers only allow same-origin calls.
func cors(origins []string, next http.Handler) http.Handler {
	wildcard := slices.Contains(origins, "*")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := origin != "" && (wildcard || slices.Contains(origins, origin))
		if allowed {
			h := w.Header()
			if wildcard {
				h.Set("Access-Control-Allow-Origin", "*")
			} else {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Add("Vary", "Origin")
			}
			h.Set("Access-Control-Expose-Headers", "Content-Disposition, Retry-After")
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
				h.Set("Access-Control-Allow-Headers", r.Header.Get("Access-Control-Request-Headers"))
				h.Set("Access-Control-Max-Age", "86400")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		} else if origin != "" {
			w.Header().Add("Vary", "Origin")
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP returns the caller's address according to TRUST_PROXY.
func clientIP(r *http.Request, trust string) string {
	var v string
	switch trust {
	case "fly":
		v = r.Header.Get("Fly-Client-IP")
	case "xff":
		// the rightmost entry is the one our proxy appended; anything left of it is client-supplied
		xff := r.Header.Get("X-Forwarded-For")
		v = xff[strings.LastIndex(xff, ",")+1:]
	}
	if ip, err := netip.ParseAddr(strings.TrimSpace(v)); err == nil {
		return ip.Unmap().String()
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// limiter is a per-IP token bucket; idle entries are swept on access.
type limiter struct {
	mu        sync.Mutex
	perMinute int
	trust     string
	visitors  map[string]*visitor
	lastSweep time.Time
}

type visitor struct {
	lim  *rate.Limiter
	seen time.Time
}

func newLimiter(perMinute int, trust string) *limiter {
	return &limiter{perMinute: perMinute, trust: trust, visitors: map[string]*visitor{}, lastSweep: time.Now()}
}

func (l *limiter) allow(ip string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	if now.Sub(l.lastSweep) > time.Minute {
		for k, v := range l.visitors {
			if now.Sub(v.seen) > 10*time.Minute {
				delete(l.visitors, k)
			}
		}
		l.lastSweep = now
	}
	v, ok := l.visitors[ip]
	if !ok {
		v = &visitor{lim: rate.NewLimiter(rate.Every(time.Minute/time.Duration(l.perMinute)), l.perMinute)}
		l.visitors[ip] = v
	}
	v.seen = now
	return v.lim.AllowN(now, 1)
}

func (l *limiter) wrap(next http.Handler) http.Handler {
	if l.perMinute <= 0 {
		return next
	}
	retry := strconv.Itoa(max(1, 60/l.perMinute))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(clientIP(r, l.trust)) {
			w.Header().Set("Retry-After", retry)
			writeError(w, http.StatusTooManyRequests, "rate limit exceeded, try again later")
			return
		}
		next.ServeHTTP(w, r)
	})
}

var gzipPool = sync.Pool{New: func() any { return gzip.NewWriter(nil) }}

func compressible(ct string) bool {
	ct, _, _ = strings.Cut(ct, ";")
	return strings.HasPrefix(ct, "text/") || slices.Contains([]string{
		"application/json", "application/javascript", "application/xml", "image/svg+xml",
		"application/wasm", "application/manifest+json",
	}, ct)
}

// gzipWriter compresses 200 responses with a text-like Content-Type.
type gzipWriter struct {
	http.ResponseWriter
	gz      *gzip.Writer
	decided bool
}

func (g *gzipWriter) WriteHeader(code int) {
	if !g.decided {
		g.decided = true
		h := g.Header()
		if compressible(h.Get("Content-Type")) {
			h.Add("Vary", "Accept-Encoding")
			if code == http.StatusOK && h.Get("Content-Encoding") == "" {
				h.Del("Content-Length")
				h.Set("Content-Encoding", "gzip")
				g.gz = gzipPool.Get().(*gzip.Writer)
				g.gz.Reset(g.ResponseWriter)
			}
		}
	}
	g.ResponseWriter.WriteHeader(code)
}

func (g *gzipWriter) Write(b []byte) (int, error) {
	if !g.decided {
		if g.Header().Get("Content-Type") == "" {
			g.Header().Set("Content-Type", http.DetectContentType(b))
		}
		g.WriteHeader(http.StatusOK)
	}
	if g.gz != nil {
		return g.gz.Write(b)
	}
	return g.ResponseWriter.Write(b)
}

func (g *gzipWriter) Unwrap() http.ResponseWriter { return g.ResponseWriter }

func gzipResponses(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead || !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		g := &gzipWriter{ResponseWriter: w}
		defer func() {
			if g.gz != nil {
				_ = g.gz.Close()
				g.gz.Reset(nil)
				gzipPool.Put(g.gz)
			}
		}()
		next.ServeHTTP(g, r)
	})
}
