package server

import (
	"fmt"
	"strconv"
	"strings"
)

// Config is read from the environment only; see README.md.
type Config struct {
	Port               string
	DataDir            string
	StaticDir          string
	CORSOrigins        []string
	TrustProxy         string // none | fly | xff
	RateLimit          int    // requests per minute per IP; 0 disables
	MaxMindLicenseKey  string
	ImageMaxSize       int64
	ImageCacheSize     int64
	ImageAllowPrivate  bool
	EnableTelemetry    bool
	GATrackingID       string
	DisableOnlineTools bool
	APIURL             string
}

// OnlineTools reports whether the API is served. DISABLE_ONLINE_TOOLS only turns it
// off when the web app is served too (air-gapped self-hosting); an API-only process
// always serves it.
func (c Config) OnlineTools() bool { return c.StaticDir == "" || !c.DisableOnlineTools }

// FromEnv parses the configuration; getenv is os.Getenv in production.
func FromEnv(getenv func(string) string) (Config, error) {
	str := func(k, def string) string {
		if v := strings.TrimSpace(getenv(k)); v != "" {
			return v
		}
		return def
	}
	var errs []string
	num := func(k string, def int64) int64 {
		v := str(k, "")
		if v == "" {
			return def
		}
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n < 0 {
			errs = append(errs, fmt.Sprintf("%s: not a non-negative integer: %q", k, v))
		}
		return n
	}
	boolean := func(k string, def bool) bool {
		v := str(k, "")
		if v == "" {
			return def
		}
		b, err := strconv.ParseBool(v)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: not a boolean: %q", k, v))
		}
		return b
	}

	c := Config{
		Port:               str("PORT", "8080"),
		DataDir:            str("DATA_DIR", "/data"),
		StaticDir:          str("STATIC_DIR", ""),
		TrustProxy:         str("TRUST_PROXY", "none"),
		RateLimit:          int(num("RATE_LIMIT", 60)),
		MaxMindLicenseKey:  str("MAXMIND_LICENSE_KEY", ""),
		ImageMaxSize:       num("IMAGE_MAX_SIZE", 0),
		ImageCacheSize:     num("IMAGE_CACHE_SIZE", 5<<30),
		ImageAllowPrivate:  boolean("IMAGE_ALLOW_PRIVATE_REGISTRIES", false),
		EnableTelemetry:    boolean("ENABLE_TELEMETRY", false),
		GATrackingID:       str("GA_TRACKING_ID", ""),
		DisableOnlineTools: boolean("DISABLE_ONLINE_TOOLS", false),
		APIURL:             str("API_URL", "/api"),
	}
	for o := range strings.SplitSeq(getenv("CORS_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.CORSOrigins = append(c.CORSOrigins, strings.TrimSuffix(o, "/"))
		}
	}
	switch c.TrustProxy {
	case "none", "fly", "xff":
	default:
		errs = append(errs, fmt.Sprintf("TRUST_PROXY: must be none, fly or xff, got %q", c.TrustProxy))
	}
	if len(errs) > 0 {
		return c, fmt.Errorf("invalid configuration: %s", strings.Join(errs, "; "))
	}
	return c, nil
}
