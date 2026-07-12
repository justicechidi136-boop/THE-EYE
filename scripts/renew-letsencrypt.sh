#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
SERVER_NAME="${THE_EYE_SERVER_NAME:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "$SERVER_NAME" ]]; then
  echo "Set THE_EYE_SERVER_NAME" >&2
  exit 1
fi

CERT_LIVE="$REPO_ROOT/infra/docker/nginx/certs/live"

echo "Renewing Let's Encrypt certificates ..."
docker compose -f "$COMPOSE_FILE" --profile certbot run --rm certbot renew --quiet

LE_PATH="$REPO_ROOT/infra/docker/nginx/certs/live/$SERVER_NAME"
if [[ -f "$LE_PATH/fullchain.pem" && -f "$LE_PATH/privkey.pem" ]]; then
  cp -f "$LE_PATH/fullchain.pem" "$CERT_LIVE/fullchain.pem"
  cp -f "$LE_PATH/privkey.pem" "$CERT_LIVE/privkey.pem"
  chmod 600 "$CERT_LIVE/privkey.pem"
fi

docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload
echo "Certificate renewal complete and nginx reloaded."
