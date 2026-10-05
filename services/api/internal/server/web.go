package server

import (
	"encoding/json"
	"net/http"
	"path"
	"strings"
)

// configJS serves the web app's runtime config, generated once from the environment.
func (s *Server) configJS() http.Handler {
	c := s.Config
	b, _ := json.MarshalIndent(map[string]any{
		"ENABLE_TELEMETRY":     c.EnableTelemetry,
		"GA_TRACKING_ID":       c.GATrackingID,
		"DISABLE_ONLINE_TOOLS": c.DisableOnlineTools,
		"API_URL":              c.APIURL,
	}, "", "  ")
	body := []byte("window.__RUNTIME_CONFIG__ = " + string(b) + ";\n")
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(body)
	})
}

// static serves STATIC_DIR with SPA fallback: unknown paths get index.html, except
// under /assets (a missing hashed asset must 404, not return HTML) and /api.
func (s *Server) static() http.Handler {
	root := http.Dir(s.Config.StaticDir)
	files := http.FileServer(root)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		if p == "/api" || strings.HasPrefix(p, "/api/") {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		assets := strings.HasPrefix(p, "/assets/")
		if f, err := root.Open(p); err == nil {
			fi, err := f.Stat()
			_ = f.Close()
			if err == nil && !fi.IsDir() && p != "/index.html" {
				if assets {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				} else {
					w.Header().Set("Cache-Control", "no-cache")
				}
				files.ServeHTTP(w, r)
				return
			}
		}
		if assets {
			http.NotFound(w, r)
			return
		}
		f, err := root.Open("/index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer func() { _ = f.Close() }()
		fi, err := f.Stat()
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeContent(w, r, "index.html", fi.ModTime(), f)
	})
}
