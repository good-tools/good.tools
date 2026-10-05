# @good-tools/api

The good.tools backend: DNS, WHOIS, IP geolocation and a container image browser, in one Go binary.
It can also serve the built web app, so a single process (or container) runs all of good.tools.

## Endpoints

All endpoints are `GET` and return JSON. Errors are `{"message": "..."}` with a matching status code.

| Path | Legacy alias | Parameters | Returns |
| --- | --- | --- | --- |
| `/v1/dns` | `/dns` | `domain`, `resolver` (IP, default 8.8.8.8), `udp` (`1` = UDP, default TCP) | `{"A": [{"ttl": "5m0s", "content": "…", "priority": 0}], …}` for A, AAAA, NS, MX, TXT, SOA, CNAME. SOA content is `mname rname serial refresh retry expire minttl`. |
| `/v1/whois` | `/whois` | `domain` | `{"data": "…"}`. Subdomains are reduced to the registrable domain. If IANA publishes no server for the TLD, `whois.nic.<tld>` is tried. |
| `/v1/ip` | `/ip` | `ip`, `lang` (default `en`) | location, ASN and database build dates, plus `source: {name, url, license}` |
| `/v1/my-ip` | `/my-ip` | – | `{"ip", "user_agent"}` (see `TRUST_PROXY`) |
| `/v1/image` | `/image` | `ref` (e.g. `docker.io/library/nginx:latest`) | `{"metadata": {name, digest, size}, "image": <OCI image config>}` |
| `/v1/image/list` | `/list` | `ref`, `path` (`""` = root) | `[{name, directory, mode, size, symlink?, uid, gid, creation_time, modify_time, mime_type?}]` |
| `/v1/image/file` | `/download` | `ref`, `path` | the file, as an attachment |
| `/healthz` | – | – | `{"status": "ok"}` |

Status codes: 400 bad input, 404 not found, 413 image too large, 429 rate limited (with `Retry-After`),
502 upstream failure, 503 geolocation database still loading, 504 upstream timeout.

When `STATIC_DIR` is set, the API is also mounted under `/api` (`/api/v1/dns`, `/api/dns`, …), and the
unversioned root paths (`/dns`, `/whois`, …) belong to the web app's routes instead.

## Configuration

Environment variables only.

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `8080` | |
| `DATA_DIR` | `/data` | geolocation databases (`geo/`) and cached image layers (`layers/`). Falls back to a temporary directory, with a warning, if it isn't writable. |
| `STATIC_DIR` | empty | directory of the built web app (`apps/web/dist`). Empty = API only. |
| `CORS_ORIGINS` | empty | comma-separated allowed origins, or `*`. Empty = no CORS headers (same-origin only). |
| `TRUST_PROXY` | `none` | where the client IP comes from: `none` (socket address), `fly` (`Fly-Client-IP`), `xff` (first `X-Forwarded-For` entry). Only enable behind a proxy that sets the header. |
| `RATE_LIMIT` | `60` | API requests per minute per client IP (token bucket, burst of the same size). `0` disables. Static files aren't limited. |
| `MAXMIND_LICENSE_KEY` | empty | use MaxMind GeoLite2 instead of DB-IP Lite |
| `IMAGE_MAX_SIZE` | `0` | maximum compressed image size in bytes; `0` = unlimited |
| `IMAGE_CACHE_SIZE` | `5368709120` (5 GiB) | disk cap for cached layer blobs (LRU) |
| `IMAGE_ALLOW_PRIVATE_REGISTRIES` | `false` | allow image refs that resolve to loopback, private or link-local addresses (a self-hosted registry on your LAN). Off by default so the image browser can't be used to probe internal networks. |

Web app runtime config, served as `/config.js` when `STATIC_DIR` is set:

| Variable | Default | |
| --- | --- | --- |
| `API_URL` | `/api` | where the web app calls the API |
| `DISABLE_ONLINE_TOOLS` | `false` | hide the server-backed tools. With `STATIC_DIR` set this also turns the API off and skips the geolocation download (air-gapped installs). |
| `ENABLE_TELEMETRY` | `false` | |
| `GA_TRACKING_ID` | empty | |

The web app gets `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, `no-cache` for HTML,
SPA fallback to `index.html`, and COOP/COEP plus the usual security headers. Text responses are gzipped.

## Running locally

```sh
cd services/api
DATA_DIR=./.data go run ./cmd/api                                # API on :8080
DATA_DIR=./.data STATIC_DIR=../../apps/web/dist go run ./cmd/api  # API + web app
curl 'localhost:8080/v1/dns?domain=example.com'
```

Or with Docker:

```sh
docker build -t good-tools-api services/api
docker run -p 8080:8080 -v good-tools-api:/data good-tools-api
```

Checks (also run by `bun run check` / CI): `go test -race ./...`, `go vet ./...`, `golangci-lint run`, `govulncheck ./...`.

## IP geolocation data

Neither database is bundled. They are downloaded at runtime into `DATA_DIR/geo` (atomically: temp file,
verify, rename, swap), never blocking startup; `/v1/ip` answers 503 until both are ready.

- **Default: [DB-IP](https://db-ip.com) IP to City Lite + ASN Lite**, refreshed monthly (falling back to the
  previous month's file early in a month). Licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  which requires attribution: responses carry `source: {"name": "IP geolocation by DB-IP", …}` and the UI must
  show it. The Lite databases don't include time zones, postal codes or accuracy radius.
- **With `MAXMIND_LICENSE_KEY`: MaxMind GeoLite2 City + ASN**, refreshed weekly. The GeoLite2 EULA forbids
  redistributing the databases and requires using data no older than 30 days, which is why they are fetched by
  each deployment with its own key and never baked into an image.

## Image browser

Images are read straight from the registry with [go-containerregistry](https://github.com/google/go-containerregistry):
no daemon, no root, no mounts, and nothing from the image ever touches the host filesystem by path.

- Only public images. For multi-platform images, `linux/amd64` is used, or the first platform if there is none.
- The compressed size from the manifest is checked against `IMAGE_MAX_SIZE` before anything is downloaded (413).
- Layers are downloaded once (digest-verified) into `DATA_DIR/layers`, an LRU capped at `IMAGE_CACHE_SIZE`.
- Listing a filesystem means reading every layer (gzip has no random access and whiteouts need all layers), so
  the first request for an image costs its full compressed size in bandwidth, CPU and cache disk. The flattened
  file index (whiteouts and opaque directories applied) is then kept in memory for the 16 most recent images,
  and concurrent requests for the same image share one build.
- File downloads stream the bytes out of the cached layer tar. Symlinks are listed with their target and never
  followed (downloading one returns 400); hard links serve their target's content.
- Image refs that resolve to private or loopback addresses are refused unless `IMAGE_ALLOW_PRIVATE_REGISTRIES=true`.

## Deploying to Fly.io

`fly.toml` describes the `good-tools-api` app (volume `api_data` on `/data`). Fly volumes are mounted root-owned
while the image runs as `nonroot`, so the volume may need its ownership changed (uid 65532) once for the caches to
persist; until then the service runs with a temporary data directory.
