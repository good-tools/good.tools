// Package server wires the HTTP API, middleware and optional static web app.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/netip"
	"path"
	"strconv"
	"time"

	"github.com/good-tools/good.tools/services/api/internal/netx"

	libwhois "github.com/likexian/whois"

	"github.com/good-tools/good.tools/services/api/internal/dns"
	"github.com/good-tools/good.tools/services/api/internal/geo"
	"github.com/good-tools/good.tools/services/api/internal/registry"
	"github.com/good-tools/good.tools/services/api/internal/whois"
)

// Server holds the dependencies of the handlers.
type Server struct {
	Config   Config
	Geo      *geo.DB
	Images   *registry.Browser
	Whois    *libwhois.Client
	Resolver string // default DNS resolver, host:port
}

// Handler returns the full HTTP handler.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	web := s.Config.StaticDir != ""
	if s.Config.OnlineTools() {
		lim := newLimiter(s.Config.RateLimit, s.Config.TrustProxy)
		// v1 path → legacy unversioned alias
		routes := []struct {
			v1, legacy string
			h          http.HandlerFunc
		}{
			{"dns", "dns", s.dns},
			{"whois", "whois", s.whois},
			{"ip", "ip", s.ip},
			{"my-ip", "my-ip", s.myIP},
			{"image", "image", s.image},
			{"image/list", "list", s.list},
			{"image/file", "download", s.file},
		}
		for _, rt := range routes {
			h := lim.wrap(rt.h)
			mux.Handle("GET /v1/"+rt.v1, h)
			if web {
				// unversioned paths like /dns are SPA routes, so the aliases live under /api
				mux.Handle("GET /api/v1/"+rt.v1, h)
				mux.Handle("GET /api/"+rt.legacy, h)
			} else {
				mux.Handle("GET /"+rt.legacy, h)
			}
		}
	}

	if web {
		mux.Handle("GET /config.js", s.configJS())
		mux.Handle("GET /", s.static())
	} else {
		mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) { writeError(w, http.StatusNotFound, "not found") })
	}

	return logRequests(recoverPanics(securityHeaders(gzipResponses(cors(s.Config.CORSOrigins, mux)))))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json") // before WriteHeader, or it's lost
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Del("Content-Disposition")
	writeJSON(w, status, map[string]string{"message": msg})
}

// fail maps domain errors to status codes with the `{message}` body the frontend reads.
func fail(w http.ResponseWriter, r *http.Request, err error) {
	var ne net.Error
	status, msg := http.StatusInternalServerError, "internal error"
	switch {
	case errors.Is(err, dns.ErrInvalidDomain):
		status, msg = http.StatusBadRequest, "invalid domain"
	case errors.Is(err, registry.ErrInvalid), errors.Is(err, registry.ErrForbiddenHost):
		status, msg = http.StatusBadRequest, err.Error()
	case errors.Is(err, registry.ErrNotFound):
		status, msg = http.StatusNotFound, err.Error()
	case errors.Is(err, registry.ErrTooLarge):
		status, msg = http.StatusRequestEntityTooLarge, err.Error()
	case errors.Is(err, geo.ErrLoading):
		status, msg = http.StatusServiceUnavailable, err.Error()
		w.Header().Set("Retry-After", "30")
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &ne) && ne.Timeout():
		status, msg = http.StatusGatewayTimeout, "upstream timed out"
	case errors.Is(err, dns.ErrUnreachable), errors.Is(err, whois.ErrNoServer), errors.Is(err, registry.ErrUpstream):
		status, msg = http.StatusBadGateway, err.Error()
	case errors.As(err, &ne):
		status, msg = http.StatusBadGateway, "upstream request failed"
	}
	if status >= 500 {
		slog.Warn("request failed", "path", r.URL.Path, "status", status, "err", err)
	}
	writeError(w, status, msg)
}

func (s *Server) dns(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	server := s.Resolver
	if v := q.Get("resolver"); v != "" {
		ip, err := netip.ParseAddr(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid resolver: must be an IP address")
			return
		}
		// a private resolver would let callers query internal DNS (e.g. Fly's fdaa::3 for *.internal)
		if !netx.IsPublic(ip) {
			writeError(w, http.StatusBadRequest, "invalid resolver: must be a public IP address")
			return
		}
		server = netip.AddrPortFrom(ip, 53).String()
	}
	network := "tcp"
	if n, _ := strconv.Atoi(q.Get("udp")); n > 0 {
		network = "udp"
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	res, err := dns.Lookup(ctx, q.Get("domain"), server, network)
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) whois(w http.ResponseWriter, r *http.Request) {
	res, err := whois.Lookup(s.Whois, r.URL.Query().Get("domain"))
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"data": res})
}

func (s *Server) ip(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	ip, err := netip.ParseAddr(q.Get("ip"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid IP supplied")
		return
	}
	lang := q.Get("lang")
	if lang == "" {
		lang = "en"
	}
	res, err := s.Geo.Lookup(ip.Unmap(), lang)
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) myIP(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"ip": clientIP(r, s.Config.TrustProxy), "user_agent": r.Header.Get("User-Agent"),
	})
}

// imageRequest validates ref and lifts the server write timeout for slow pulls.
func imageRequest(w http.ResponseWriter, r *http.Request) (string, bool) {
	ref := r.URL.Query().Get("ref")
	if ref == "" {
		writeError(w, http.StatusBadRequest, "missing ref")
		return "", false
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(registry.BuildTimeout + time.Minute))
	return ref, true
}

func (s *Server) image(w http.ResponseWriter, r *http.Request) {
	ref, ok := imageRequest(w, r)
	if !ok {
		return
	}
	info, err := s.Images.Inspect(r.Context(), ref)
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	ref, ok := imageRequest(w, r)
	if !ok {
		return
	}
	files, err := s.Images.List(r.Context(), ref, r.URL.Query().Get("path"))
	if err != nil {
		fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, files)
}

func (s *Server) file(w http.ResponseWriter, r *http.Request) {
	ref, ok := imageRequest(w, r)
	if !ok {
		return
	}
	f, rc, err := s.Images.Open(r.Context(), ref, r.URL.Query().Get("path"))
	if err != nil {
		fail(w, r, err)
		return
	}
	defer func() { _ = rc.Close() }()
	h := w.Header()
	ct := f.MimeType
	if ct == "" {
		ct = "application/octet-stream"
	}
	h.Set("Content-Type", ct)
	h.Set("Content-Length", strconv.FormatInt(f.Size, 10))
	h.Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": path.Base(f.Name)}))
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = io.Copy(w, rc)
	}
}
