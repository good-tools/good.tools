# Self-hostable good.tools image. Build from the repository root:
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

FROM base AS builder
COPY --from=prune /app/out/json/ .
RUN bun install --frozen-lockfile
COPY --from=prune /app/out/full/ .
COPY --from=wasm-meshrepair / packages/meshrepair/wasm/
RUN bunx turbo@^2 run build --filter=@good-tools/web

# Runtime stage
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/docker/nginx.conf /etc/nginx/nginx.conf
COPY apps/web/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Privacy-focused defaults for self-hosting
ENV PORT=80 \
    ENABLE_TELEMETRY=false \
    GA_TRACKING_ID="" \
    DISABLE_ONLINE_TOOLS=true \
    INTERNET_TOOLS_URL="" \
    IMAGE_BROWSER_URL=""

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
