#!/bin/sh
set -e

# Generate runtime config from environment variables
cat > /usr/share/nginx/html/config.js << EOF
window.__RUNTIME_CONFIG__ = {
  ENABLE_TELEMETRY: ${ENABLE_TELEMETRY:-false},
  GA_TRACKING_ID: "${GA_TRACKING_ID:-}",
  DISABLE_ONLINE_TOOLS: ${DISABLE_ONLINE_TOOLS:-true},
  INTERNET_TOOLS_URL: "${INTERNET_TOOLS_URL:-}",
  IMAGE_BROWSER_URL: "${IMAGE_BROWSER_URL:-}"
};
EOF

# Substitute PORT in nginx config
sed -i "s/\${PORT}/${PORT:-80}/g" /etc/nginx/nginx.conf

echo "Runtime config generated:"
cat /usr/share/nginx/html/config.js
echo ""
echo "Starting nginx on port ${PORT:-80}..."

exec "$@"
