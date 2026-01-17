# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script for runtime config injection
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default environment variables (privacy-focused for self-hosting)
ENV PORT=80
ENV ENABLE_TELEMETRY=false
ENV GA_TRACKING_ID=""
ENV DISABLE_ONLINE_TOOLS=true
ENV INTERNET_TOOLS_URL=""
ENV IMAGE_BROWSER_URL=""

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
