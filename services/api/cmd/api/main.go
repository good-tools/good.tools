// Command api serves the good.tools API (and optionally the web app).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/good-tools/good.tools/services/api/internal/geo"
	"github.com/good-tools/good.tools/services/api/internal/registry"
	"github.com/good-tools/good.tools/services/api/internal/server"
	"github.com/good-tools/good.tools/services/api/internal/whois"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func writable(dir string) bool {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return false
	}
	f, err := os.CreateTemp(dir, ".probe-*")
	if err != nil {
		return false
	}
	_ = f.Close()
	return os.Remove(f.Name()) == nil
}

func run() error {
	cfg, err := server.FromEnv(os.Getenv)
	if err != nil {
		return err
	}
	if !writable(cfg.DataDir) {
		// e.g. a root-owned volume while running as nonroot: keep serving, lose persistence
		fallback := filepath.Join(os.TempDir(), "good-tools-api")
		slog.Warn("DATA_DIR is not writable, using a temporary directory", "data_dir", cfg.DataDir, "fallback", fallback)
		cfg.DataDir = fallback
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	geoDB := geo.New(geo.Config{Dir: filepath.Join(cfg.DataDir, "geo"), LicenseKey: cfg.MaxMindLicenseKey})
	images, err := registry.New(registry.Options{
		CacheDir:     filepath.Join(cfg.DataDir, "layers"),
		CacheSize:    cfg.ImageCacheSize,
		MaxSize:      cfg.ImageMaxSize,
		AllowPrivate: cfg.ImageAllowPrivate,
	})
	if err != nil {
		return err
	}
	if cfg.OnlineTools() {
		go geoDB.Run(ctx) // downloads in the background; /ip answers 503 until ready
	}

	s := &server.Server{Config: cfg, Geo: geoDB, Images: images, Whois: whois.NewClient(), Resolver: "8.8.8.8:53"}
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second, // image handlers extend their own deadline
		IdleTimeout:       120 * time.Second,
	}
	errc := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr, "static", cfg.StaticDir != "", "geo", geoDB.Source().Name)
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
