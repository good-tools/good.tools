# Self-hostable good.tools image: the web app and the API (services/api) in one Go binary.
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t good-tools .

# WebAssembly built outside this build (CI passes
#   --build-context wasm-meshrepair=packages/meshrepair/wasm).
# Empty by default: the build then reuses the published binaries when the C++ inputs
# match a release (see packages/meshrepair/scripts/build-wasm.mjs).
FROM scratch AS wasm-meshrepair

# Static output, so build once on the native platform even for multi-arch images
FROM --platform=$BUILDPLATFORM oven/bun:1-alpine AS base
WORKDIR /app

# Reduce the monorepo to the web app and the workspace packages it depends on
FROM base AS prune
COPY . .
RUN bunx turbo@^2 prune @good-tools/web --docker

FROM base AS web
COPY --from=prune /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=prune /app/out/full/ .
COPY --from=wasm-meshrepair / packages/meshrepair/wasm/
RUN bunx turbo@^2 run build --filter=@good-tools/web

# Cross-compiled for the target platform
FROM --platform=$BUILDPLATFORM golang:1.26 AS api
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY services/api/go.mod services/api/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY services/api/ .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && mkdir /out/data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=api /out/api /api
COPY --from=api --chown=nonroot:nonroot /out/data /data
COPY --from=web /app/apps/web/dist /web
USER nonroot

# Privacy-focused defaults for self-hosting; see services/api/README.md for all variables.
# Port 80 binds as nonroot under Docker (unprivileged ports start at 0 there); elsewhere set PORT.
ENV PORT=80 \
    STATIC_DIR=/web \
    DATA_DIR=/data \
    ENABLE_TELEMETRY=false \
    GA_TRACKING_ID="" \
    DISABLE_ONLINE_TOOLS=false

EXPOSE 80
ENTRYPOINT ["/api"]
