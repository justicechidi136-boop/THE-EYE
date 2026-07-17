#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"
PER_HOST="${THE_EYE_TLS_PER_HOST:-false}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

ADMIN_NAME="${THE_EYE_ADMIN_SERVER_NAME:-${THE_EYE_SERVER_NAME:-}}"
API_NAME="${THE_EYE_API_SERVER_NAME:-}"
LIVEKIT_NAME="${THE_EYE_LIVEKIT_SERVER_NAME:-}"

if [[ -z "$ADMIN_NAME" || -z "$API_NAME" || -z "$LIVEKIT_NAME" ]]; then
  echo "Set THE_EYE_ADMIN_SERVER_NAME, THE_EYE_API_SERVER_NAME, and THE_EYE_LIVEKIT_SERVER_NAME" >&2
  exit 1
fi

DOMAINS=("$ADMIN_NAME" "$API_NAME" "$LIVEKIT_NAME")
CERT_LIVE="$REPO_ROOT/infra/docker/nginx/certs/live"

echo "Renewing Let's Encrypt certificates ..."
docker compose -f "$COMPOSE_FILE" --profile certbot run --rm certbot renew --quiet

if [[ "$PER_HOST" == "true" ]]; then
  for domain in "${DOMAINS[@]}"; do
    le_path="$CERT_LIVE/$domain"
    if [[ -f "$le_path/fullchain.pem" && -f "$le_path/privkey.pem" ]]; then
      cp -f "$le_path/fullchain.pem" "$CERT_LIVE/$domain/fullchain.pem"
      cp -f "$le_path/privkey.pem" "$CERT_LIVE/$domain/privkey.pem"
      chmod 600 "$CERT_LIVE/$domain/privkey.pem"
    fi
  done
else
  le_path="$CERT_LIVE/$ADMIN_NAME"
  if [[ -f "$le_path/fullchain.pem" && -f "$le_path/privkey.pem" ]]; then
    cp -f "$le_path/fullchain.pem" "$CERT_LIVE/fullchain.pem"
    cp -f "$le_path/privkey.pem" "$CERT_LIVE/privkey.pem"
    chmod 600 "$CERT_LIVE/privkey.pem"
  fi
fi

docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload
echo "Certificate renewal complete and nginx reloaded."
