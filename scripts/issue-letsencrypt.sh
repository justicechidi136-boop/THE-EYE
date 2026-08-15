#!/usr/bin/env bash
set -euo pipefail

# Issue or renew Let's Encrypt certificates for THE EYE nginx hostnames.
# Phase 1: nginx in HTTP bootstrap mode (THE_EYE_TLS_BOOTSTRAP=auto, THE_EYE_SSL_REDIRECT=false)
# Phase 2: run this script, then set THE_EYE_SSL_REDIRECT=true and restart nginx.
#
# Supports:
#   - Single SAN certificate covering all hostnames (default, stored at certs/live/fullchain.pem)
#   - Per-hostname certificates at certs/live/<hostname>/ (set THE_EYE_TLS_PER_HOST=true)

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"
PER_HOST="${THE_EYE_TLS_PER_HOST:-false}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

read_dotenv_value() {
  local key="$1"
  local file="$2"
  local line value found=""

  [[ -f "$file" ]] || return 1

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" == "$key="* ]]; then
      value="${line#"$key="}"
      if [[ ${#value} -ge 2 ]]; then
        if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
          value="${value:1:${#value}-2}"
        elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
          value="${value:1:${#value}-2}"
        fi
      fi
      found="true"
    fi
  done < "$file"

  [[ "$found" == "true" ]] || return 1
  printf '%s' "$value"
}

config_value() {
  local key="$1"
  local fallback="${2:-}"

  if [[ -v "$key" ]]; then
    printf '%s' "${!key}"
    return 0
  fi

  if read_dotenv_value "$key" "$ENV_FILE"; then
    return 0
  fi

  printf '%s' "$fallback"
}

EMAIL="$(config_value CERTBOT_EMAIL)"
LEGACY_ADMIN_NAME="$(config_value THE_EYE_SERVER_NAME)"

ADMIN_NAME="$(config_value THE_EYE_ADMIN_SERVER_NAME "$LEGACY_ADMIN_NAME")"
API_NAME="$(config_value THE_EYE_API_SERVER_NAME)"
LIVEKIT_NAME="$(config_value THE_EYE_LIVEKIT_SERVER_NAME)"
STORAGE_NAME="$(config_value THE_EYE_STORAGE_SERVER_NAME)"

if [[ -z "$ADMIN_NAME" || -z "$API_NAME" || -z "$LIVEKIT_NAME" ]]; then
  echo "Set THE_EYE_ADMIN_SERVER_NAME, THE_EYE_API_SERVER_NAME, and THE_EYE_LIVEKIT_SERVER_NAME" >&2
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  echo "Set CERTBOT_EMAIL for Let's Encrypt registration" >&2
  exit 1
fi

if [[ "${THE_EYE_LETSENCRYPT_VALIDATE_ENV_ONLY:-false}" == "true" ]]; then
  echo "TLS environment validated."
  exit 0
fi

DOMAINS=("$ADMIN_NAME" "$API_NAME" "$LIVEKIT_NAME")
if [[ -n "$STORAGE_NAME" ]]; then
  DOMAINS+=("$STORAGE_NAME")
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

"${COMPOSE[@]}" up -d --no-deps nginx

issue_domain() {
  local domain="$1"
  echo "Requesting certificate for $domain ..."
  "${COMPOSE[@]}" --profile certbot run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$domain"
}

copy_shared_cert() {
  local primary="$1"
  local le_path="$CERT_LIVE/$primary"
  if [[ -f "$le_path/fullchain.pem" && -f "$le_path/privkey.pem" ]]; then
    cp -f "$le_path/fullchain.pem" "$CERT_LIVE/fullchain.pem"
    cp -f "$le_path/privkey.pem" "$CERT_LIVE/privkey.pem"
    chmod 600 "$CERT_LIVE/privkey.pem"
    echo "Certificates copied to $CERT_LIVE (shared path, primary CN=$primary)"
    return 0
  fi
  return 1
}

copy_host_cert() {
  local domain="$1"
  local le_path="$CERT_LIVE/$domain"
  if [[ -f "$le_path/fullchain.pem" && -f "$le_path/privkey.pem" ]]; then
    mkdir -p "$CERT_LIVE/$domain"
    cp -f "$le_path/fullchain.pem" "$CERT_LIVE/$domain/fullchain.pem"
    cp -f "$le_path/privkey.pem" "$CERT_LIVE/$domain/privkey.pem"
    chmod 600 "$CERT_LIVE/$domain/privkey.pem"
    echo "Certificates copied to $CERT_LIVE/$domain"
    return 0
  fi
  return 1
}

if [[ "$PER_HOST" == "true" ]]; then
  for domain in "${DOMAINS[@]}"; do
    issue_domain "$domain"
    copy_host_cert "$domain" || {
      echo "Expected certs at $CERT_LIVE/$domain — check certbot output" >&2
      exit 1
    }
  done
else
  echo "Requesting SAN certificate for ${DOMAINS[*]} ..."
  certbot_args=(
    certonly
    --webroot
    --webroot-path=/var/www/certbot
    --email "$EMAIL"
    --agree-tos
    --no-eff-email
  )
  for domain in "${DOMAINS[@]}"; do
    certbot_args+=(-d "$domain")
  done
  "${COMPOSE[@]}" --profile certbot run --rm certbot "${certbot_args[@]}"
  copy_shared_cert "$ADMIN_NAME" || {
    echo "Expected certs at $CERT_LIVE/$ADMIN_NAME — check certbot output" >&2
    exit 1
  }
fi

echo ""
echo "Phase 2 — enable HTTPS:"
echo "  1. Set THE_EYE_SSL_REDIRECT=true in ${ENV_FILE}"
echo "  2. Restart nginx:"
echo "     ${COMPOSE[*]} restart nginx"
