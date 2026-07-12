#!/usr/bin/env bash
set -euo pipefail

# Issue or renew Let's Encrypt certificates for THE EYE nginx.
# Requires: nginx running on port 80, DNS pointing to this host, THE_EYE_SERVER_NAME set.

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
SERVER_NAME="${THE_EYE_SERVER_NAME:-}"
EMAIL="${CERTBOT_EMAIL:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "$SERVER_NAME" ]]; then
  echo "Set THE_EYE_SERVER_NAME (e.g. admin.example.com)" >&2
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  echo "Set CERTBOT_EMAIL for Let's Encrypt registration" >&2
  exit 1
fi

CERT_LIVE="$REPO_ROOT/infra/docker/nginx/certs/live"
mkdir -p "$CERT_LIVE"

echo "Requesting certificate for $SERVER_NAME ..."
docker compose -f "$COMPOSE_FILE" --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$SERVER_NAME"

LE_PATH="$REPO_ROOT/infra/docker/nginx/certs/live/$SERVER_NAME"
if [[ -f "$LE_PATH/fullchain.pem" && -f "$LE_PATH/privkey.pem" ]]; then
  cp -f "$LE_PATH/fullchain.pem" "$CERT_LIVE/fullchain.pem"
  cp -f "$LE_PATH/privkey.pem" "$CERT_LIVE/privkey.pem"
  chmod 600 "$CERT_LIVE/privkey.pem"
  echo "Certificates copied to $CERT_LIVE"
else
  echo "Expected certs at $LE_PATH — check certbot output" >&2
  exit 1
fi

echo "Set THE_EYE_SSL_REDIRECT=true in .env, then restart nginx:"
echo "  docker compose -f $COMPOSE_FILE restart nginx"
