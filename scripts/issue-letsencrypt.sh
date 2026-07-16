#!/usr/bin/env bash
set -euo pipefail

# Issue or renew Let's Encrypt certificates for THE EYE nginx.
# Phase 1: nginx in HTTP bootstrap mode (THE_EYE_TLS_BOOTSTRAP=auto, THE_EYE_SSL_REDIRECT=false)
# Phase 2: run this script, then set THE_EYE_SSL_REDIRECT=true and restart nginx.

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"
SERVER_NAME="${THE_EYE_SERVER_NAME:-}"
EMAIL="${CERTBOT_EMAIL:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "$SERVER_NAME" ]]; then
  echo "Set THE_EYE_SERVER_NAME (e.g. staging-admin.theeye.com.ng)" >&2
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  echo "Set CERTBOT_EMAIL for Let's Encrypt registration" >&2
  exit 1
fi

CERT_LIVE="$REPO_ROOT/infra/docker/nginx/certs/live"
mkdir -p "$CERT_LIVE"

COMPOSE=(docker compose -f "$COMPOSE_FILE")
if [[ -f "$ENV_FILE" ]]; then
  COMPOSE+=(--env-file "$ENV_FILE")
fi

echo "Ensuring nginx is running in HTTP bootstrap mode for ACME ..."
export THE_EYE_TLS_BOOTSTRAP=auto
export THE_EYE_SSL_REDIRECT=false
export THE_EYE_GENERATE_DEV_SSL=false

"${COMPOSE[@]}" up -d nginx

echo "Requesting certificate for $SERVER_NAME ..."
"${COMPOSE[@]}" --profile certbot run --rm certbot certonly \
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

echo ""
echo "Phase 2 — enable HTTPS:"
echo "  1. Set THE_EYE_SSL_REDIRECT=true in ${ENV_FILE}"
echo "  2. Restart nginx:"
echo "     ${COMPOSE[*]} restart nginx"
