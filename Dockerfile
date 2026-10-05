# Build stage
# Static output, so build once on the native platform even for multi-arch images
FROM --platform=$BUILDPLATFORM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Runtime stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
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
