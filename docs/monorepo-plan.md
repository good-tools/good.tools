# good.tools monorepo plan

Status: proposal · 2026-10-05

## Goals

1. One repo for the good.tools app, the npm libraries it uses and its backend.
2. One modern Go service (replacing `internet-tools` + `image-browser`) that deploys to Fly **and** ships inside the self-hostable Docker image.
3. A reusable, Brave-style "pinned upstream + patches + overlays" tool for every good.tools WASM library.
4. `wiregasm` stays in its own repo (it can adopt the patch tool later).

## What exists today

| Repo | What | State | Decision |
| --- | --- | --- | --- |
| `good.tools` | Bun + Vite 8 + React 19 SPA | current | becomes the monorepo (`apps/web`) |
| `jdserialize` | `@goodtools/jdserialize@1.0.0`, MIT, 2 commits | 2023, Parcel/Jest/eslint 8, no CI, hand-published | import → `packages/jdserialize` |
| `protobuf-decoder` | `@goodtools/protobuf-decoder@1.0.0`, MIT, 2 commits | same as above | import → `packages/protobuf-decoder` |
| `meshrepair` | `@goodtools/meshrepair@0.1.1`, **GPL-3.0**, VCGlib → WASM | 2026, Vite/Vitest, changesets + npm OIDC; unverified upstream download; emsdk 4.0.23 pinned in 2 places | import → `packages/meshrepair`, first `wasmpatch` user |
| `internet-tools` | Go: `/dns` `/whois` `/ip` `/my-ip` | Go 1.17, 3-year-old deps (x/net CVEs), GeoLite DB 2.4 years stale (EULA requires ≤30 days), no tests/CI, SOA bug, WHOIS fails for some TLDs | rewrite into `services/api` |
| `image-browser` | Go: `/image` `/list` `/download` | runs a **containerd daemon** + overlay mounts (needs root/`CAP_SYS_ADMIN`; works only because Fly VMs are root), no limits, symlink escape | rewrite on go-containerregistry into `services/api` |
| `ip-to-location`, `whats-my-ip` | AWS Lambdas behind `api.good.tools` | superseded, unreferenced; `POST /ip` already 500s | archive + tear down |
| `iac` | Terraform: API Gateway + Lambdas **and the S3/CloudFront site** | site part likely still live | keep (or move to `infra/`) until hosting decision; destroy the API Gateway parts |
| `aegis` | unrelated Python pentest agent | — | out of scope (move/archive separately) |
| `wiregasm` | C++ → WASM, GPL-2.0+ | active | **stays out** |

## Tooling decision

**Bun workspaces + Turborepo + release-please (manifest mode).**

- **Turborepo** (v2.10): one `turbo.json`, stable Bun support, `--affected` CI, `turbo prune --docker`, free Vercel remote cache when we want it. Go runs as package scripts; Go's own build/test cache (via `actions/setup-go`) does the heavy lifting and turbo just skips the service on unrelated changes (`inputs: ["**/*.go", "go.mod", "go.sum"]`).
- Considered: **moon v2** (best polyglot support incl. first-class Go, but per-project config and no hosted cache since moonbase shut down) — the fallback if Go/C++ work grows. **Nx** — too heavy for this size, Go only via community plugins. **Plain `bun --filter`** — fine today but no caching/pruning. **Vite+** — promising, still beta, and pushes Oxc instead of Biome.
- **release-please manifest mode** keeps today's workflow (squash merge, Conventional-Commit PR titles): it routes commits to packages by changed paths. Components: `web` (simple), `jdserialize`, `protobuf-decoder`, `meshrepair`, `wasmpatch` (node), `api` (go); tags like `jdserialize-v1.1.0`. No `node-workspace` plugin, no linked versions. Changesets (what meshrepair uses) needs a file per PR — drop it.
- **npm publishing**: trusted publishing (OIDC, provenance) from one `release.yml`; `bun pm pack` (resolves `workspace:*`) + `npm publish <tgz>`. Classic tokens no longer exist.
- **Biome** at the root for everything TS; **golangci-lint v2** for Go.

## Target layout

```
good.tools/
├─ apps/
│  └─ web/                      # today's src/, index.html, vite config, public/
├─ packages/
│  ├─ jdserialize/              # MIT
│  ├─ protobuf-decoder/         # MIT
│  └─ meshrepair/               # GPL-3.0 · src/ (TS) + native/ (C++, upstream.toml, patches/, overlay/)
├─ services/
│  └─ api/                      # Go module: cmd/api, internal/{dns,whois,geo,registry,web}, fly.toml
├─ tools/
│  └─ wasmpatch/                # @goodtools/wasmpatch — pinned upstream + patches + overlays CLI
├─ docker/                      # shared emsdk builder image, runtime image bits
├─ Dockerfile                   # self-host image: web dist + api binary
├─ package.json (workspaces) · bun.lock · turbo.json · biome.json
├─ release-please-config.json · .release-please-manifest.json
└─ .github/workflows/ ci.yml · release.yml · deploy-api.yml · pr-title.yml
```

Licensing: per-package `LICENSE` files (meshrepair stays GPL-3.0). Open question: the web app bundles GPL code (wiregasm GPL-2.0+, meshrepair GPL-3.0); worth confirming the intended licence of the combined app.

## The Go service (`services/api`)

One binary, one Fly app (`good-tools-api`), same binary inside the self-host image.

**Modernization**
- Go 1.26, `net/http` method+path routing (`GET /v1/dns`), `log/slog` JSON request logs, server timeouts, graceful shutdown, `/healthz`, config from env (port, CORS origins, limits, MaxMind key).
- CORS from config (good.tools + localhost by default; `*` opt-in for self-hosters), per-IP rate limiting (`x/time/rate`), request size/time limits, consistent JSON errors (`{error:{code,message}}`).
- Tests: table tests per handler (DNS/WHOIS with fake resolvers), golden JSON, `httptest` integration; CI runs `go test -race`, `golangci-lint`, `govulncheck`.

**Endpoints** (versioned; old unversioned paths kept as aliases until the frontend switches)
- `/v1/dns`, `/v1/whois`, `/v1/ip`, `/v1/my-ip` — ported from internet-tools: current `miekg/dns` (v1 latest; evaluate v2), fix SOA, newer WHOIS lib + raw fallback for unsupported TLDs, `geoip2-golang` v2.
- `/v1/image`, `/v1/image/list`, `/v1/image/file` — **rewritten on go-containerregistry**: `remote.Image` for manifest/config (no daemon, no root, no mounts), stream layers newest-first applying whiteouts to build an in-memory file index, serve files by re-streaming the layer that holds them. Limits: max compressed image size, max layers, optional registry allowlist, per-IP rate limit, LRU on-disk cache of layer blobs with a size cap. Symlink escape disappears (nothing touches the host filesystem).

**GeoLite2** — the EULA forbids redistributing the databases, so the public image must not contain them. The service downloads/refreshes them at runtime when `MAXMIND_LICENSE_KEY` is set (stored on a Fly volume, refreshed weekly); without a key `/v1/ip` returns 501 and the frontend hides the IP-location tool.

**Deploy** — CI builds `ghcr.io/good-tools/api:<version>` once, then `flyctl deploy --config services/api/fly.toml --image …` (no Fly remote builder, no monorepo build-context problems). Fly config moves to the current `fly.toml` format (http_service, health checks, `auto_stop_machines`, a small volume for GeoLite + layer cache).

## The self-host Docker image

Replace nginx + shell entrypoint with the Go binary serving everything:
- static `apps/web/dist` (SPA fallback, immutable caching for `/assets`, COOP/COEP + security headers), generated `/config.js` from env (replaces `docker/entrypoint.sh`), and the API under `/api/v1/*` on the **same origin** (no CORS, `INTERNET_TOOLS_URL` etc. default to `/api`).
- One process, distroless/static base, non-root, read-only rootfs + `/data` volume — and online tools work out of the box (except IP location without a MaxMind key).
- Built with `turbo prune --docker` for the web stage and `COPY --from` the api build stage.
- The Fly app can run this same image later if we want to move the site off S3/CloudFront (decision deferred; nothing forces it).

## `@goodtools/wasmpatch`

Generalises wiregasm's `scripts/patches.mjs` (git-tagged `upstream` → `patched` trees, deterministic per-file patches with `Why:/Source:` headers, all-failures reporting, dirty-tree guard, rebase on bump).

- Single dependency-free `.mjs` (runs on emsdk's bundled Node), published to npm so wiregasm can adopt it from its own repo (or vendor it).
- `upstream.toml` per library: toolchain pins (`emsdk`, `meson`) + sources (`url`+`sha256/512` or `git`+40-char `rev`, `strip`, `patches`, `overlay`, `deps`).
- Commands: `fetch` (atomic, verified), `apply`, `export`, `bump <pkg> <version>` (rebase, stop on conflict with instructions), `check`, `status`, `cache-key`, `print <key>`.
- Ships a reference two-stage emsdk Dockerfile (pins read via `wasmpatch print`) and a reusable GH Actions workflow (tarball cache keyed on pins; deps image tagged with `cache-key`, pushed from master only), plus generic `size-check` and "test the packed tarball" e2e templates.
- First adopter: meshrepair (fixes its unverified VCGlib download and duplicated emsdk pin).

## Phases (one PR each, the site keeps working after every step)

**0 · Prep (no code)** — confirm decisions below; create the `good-tools-api` Fly app + volume; MaxMind key as a secret; note current npm trusted-publisher settings.

**1 · Skeleton** — move the app to `apps/web`, root Bun workspaces + `turbo.json`, root Biome, CI on `turbo run check --affected`, release-please manifest with the `web` component (version carried over), Dockerfile/Vercel paths updated. No behaviour change.

**2 · TS libraries** — import `jdserialize` and `protobuf-decoder` with history (`git filter-repo --to-subdirectory-filter packages/<name> --tag-rename '':'<name>-'` + `merge --allow-unrelated-histories`); move them to Vite library mode + Vitest + Biome, proper `exports` maps and types; the app depends on them via `workspace:*`; register npm trusted publishers for the monorepo `release.yml`; release a patch version from the monorepo to prove the pipeline.

**3 · wasmpatch + meshrepair** — build `tools/wasmpatch`; import meshrepair with history; adopt `upstream.toml` (VCGlib pinned to a git rev, verified), single emsdk pin, shared builder image, typed `./wasm` subpath (removes the `@ts-expect-error` in the app's worker), WASM build cached in CI by `wasmpatch cache-key`; switch its npm trusted publisher from changesets/`cd.yml` to `release.yml`.

**4 · Go API** — `services/api` with the internet-tools endpoints ported + tests; deploy to the new Fly app alongside the old ones; point the app at it (one `API_URL` replacing `INTERNET_TOOLS_URL` + `IMAGE_BROWSER_URL`, back-compat in `config.js`).

**5 · Image browser rewrite** — go-containerregistry implementation with limits and cache, behind `/v1/image*`; switch the app; load-test with a few large images.

**6 · One image** — Go serves `dist` + `/api`; drop nginx/entrypoint; publish `ghcr.io/good-tools/good.tools` with everything working out of the box; update README self-hosting.

**7 · Cleanup** — scale down and delete `internet-tools` / `image-browser` Fly apps; archive `internet-tools`, `image-browser`, `jdserialize`, `protobuf-decoder`, `meshrepair`, `ip-to-location`, `whats-my-ip` with README pointers; `terraform destroy` the API Gateway + Lambdas; decide `iac`'s fate (keep only the site, or move it to `infra/`).

Phases 2–3 and 4–5 are independent and can run in parallel after phase 1.

## Decisions (2026-10-05)

1. **iac / aegis**: out of scope.
2. **API at `api.good.tools`** (Fly), paths under `/v1/*`.
   - The app gets a single `API_URL` setting replacing `INTERNET_TOOLS_URL` + `IMAGE_BROWSER_URL`; it defaults to `/api` (same origin), so self-hosters need no URL config at all. The official build sets `https://api.good.tools`.
   - Self-hosted images ship the API in the box, so **online tools are on by default** there ("online" now means "your own server", not a third party). `DISABLE_ONLINE_TOOLS=true` remains for air-gapped/minimal installs.
   - The "Online" badge becomes "Server" with a tooltip naming the origin that receives the data.
   - Remaining env vars: `PORT`, `DISABLE_ONLINE_TOOLS`, `MAXMIND_LICENSE_KEY` (optional), `ENABLE_TELEMETRY` + `GA_TRACKING_ID` (official site only), `CORS_ORIGINS` (only needed when the API is on a different origin, i.e. api.good.tools), `IMAGE_MAX_SIZE` (see 4).
3. **IP geolocation**: `MAXMIND_LICENSE_KEY` set → MaxMind GeoLite2 City + ASN, refreshed weekly at runtime; not set → **DB-IP Lite** City + ASN (CC BY 4.0, redistributable, monthly, ~65 MB gz; downloaded at runtime to `/data`, and the UI shows the required "IP geolocation by DB-IP" attribution when it's the source). The response includes `source` so the UI can attribute correctly.
4. **Image size limit** isn't about privileges any more but about resources. Listing a filesystem means downloading and decompressing every layer (gzip has no random access, and whiteouts need all layers), so a 20 GB image costs 20 GB of egress, CPU and cache disk per cold request. Keep a configurable `IMAGE_MAX_SIZE` (compressed): 2 GB on api.good.tools, unlimited by default for self-hosters.
5. **Licensing** (not legal advice). See the "Licensing" section below.
6. **npm publishing** works from the monorepo with trusted publishing (OIDC + provenance):
   - meshrepair: its npm trusted-publisher entry currently names `good-tools/meshrepair` + `cd.yml`. Switch it on npmjs.com (package → Settings → Trusted publishing) to `good-tools/good.tools` + `release.yml` at cut-over; until then the old repo can still publish.
   - jdserialize and protobuf-decoder were hand-published and have no trusted publisher; add one each (allowed for existing packages before the next publish).
   - Each `package.json` needs `repository: { url: "git+https://github.com/good-tools/good.tools.git", directory: "packages/<name>" }`; provenance checks it against the publishing repo.
   - Publish with `bun pm pack` (resolves `workspace:*`) + `npm publish <tgz>` (npm ≥ 11.5.1).
   - Trusted-publisher permission for `good-tools/good.tools` / `release.yml`: **npm publish** (direct, fully automated) for now. Staged publishing (`npm stage publish` + 2FA approval, npm ≥ 11.15.0) can be switched on later by changing the permission and the one publish command.
7. **Turborepo**, **Go serves the self-host image** (no nginx), **site stays on S3/CloudFront** for now, **import history for the libraries only**.

## Licensing

| Component | Licence | Notes |
| --- | --- | --- |
| `apps/web` source | MIT | |
| `@goodtools/jdserialize` | MIT | port of jdeserialize (upstream licence not declared on GitHub; was "New BSD" on Google Code). Keep a BSD notice to be safe. |
| `@goodtools/protobuf-decoder` | MIT | |
| `@goodtools/meshrepair` | GPL-3.0 | forced by VCGlib (GPL-3.0). Declare `GPL-3.0-or-later` if VCGlib's headers allow it. |
| `@goodtools/wiregasm` | GPL-2.0-or-later | Wireshark |
| `wasm-vips` | MIT wrapper; bundles libvips, glib, libheif, … under LGPL-3.0 | |
| `node-forge` | BSD-3-Clause OR GPL-2.0 | we take BSD |
| everything else in the bundle | MIT / ISC / BSD / BlueOak | |
| `@goodtools/wasmpatch`, `services/api` | MIT | Go deps are BSD/ISC/Apache-2.0 |

What this means for the **built web app** (the site and the Docker image): it ships GPL-2.0-or-later (wiregasm) and GPL-3.0 (meshrepair) code together, so the combined bundle can only be distributed under **GPL-3.0(-or-later)** terms. Everything else is compatible with that (MIT, BSD, ISC, LGPL-3.0, Apache-2.0).

Recommendation: no relicensing needed.
- Keep each package's own licence (MIT stays MIT, since MIT code can be part of a GPL work).
- State in the README and on an in-app "Licenses" page that the built application is distributed under GPL-3.0-or-later because it includes GPL components, and link to the exact source (already public; the header links to the release tag).
- Generate a third-party licence file during the build (`dist/licenses.txt`) with every bundled package's notice, including wasm-vips' LGPL list. Self-hosted images carry it too.
- The Go API is a separate program; putting it in the same Docker image is mere aggregation and doesn't affect the web bundle.

## Open questions

- Do VCGlib's file headers allow GPL-3.0-or-later, so meshrepair can say so too?
- Confirm jdeserialize's original licence for the notice text.
