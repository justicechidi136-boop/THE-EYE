#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs/live"
HTTP_TEMPLATE="/etc/nginx/render/http.conf.template"
HTTPS_TEMPLATE="/etc/nginx/render/https.conf.template"
UPSTREAMS_SRC="/etc/nginx/snippets/upstreams.conf"
CONF_D="/etc/nginx/conf.d"

# Legacy single-hostname fallback for admin only.
: "${THE_EYE_SERVER_NAME:=}"
: "${THE_EYE_ADMIN_SERVER_NAME:=${THE_EYE_SERVER_NAME:-localhost}}"
: "${THE_EYE_API_SERVER_NAME:=localhost}"
: "${THE_EYE_LIVEKIT_SERVER_NAME:=localhost}"
: "${THE_EYE_SSL_REDIRECT:=false}"
: "${THE_EYE_GENERATE_DEV_SSL:=false}"
: "${THE_EYE_TLS_BOOTSTRAP:=auto}"

mkdir -p "$CONF_D"
rm -f "$CONF_D"/the-eye-*.conf "$CONF_D"/10-*.conf "$CONF_D"/20-*.conf

cp "$UPSTREAMS_SRC" "$CONF_D/00-upstreams.conf"

has_certs() {
  [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]
}

has_hostname_certs() {
  hostname="$1"
  [ -f "$CERT_DIR/$hostname/fullchain.pem" ] && [ -f "$CERT_DIR/$hostname/privkey.pem" ]
}

resolve_ssl_paths() {
  hostname="$1"
  if has_hostname_certs "$hostname"; then
    export THE_EYE_SSL_CERT="$CERT_DIR/$hostname/fullchain.pem"
    export THE_EYE_SSL_KEY="$CERT_DIR/$hostname/privkey.pem"
    return 0
  fi
  if has_certs; then
    export THE_EYE_SSL_CERT="$CERT_DIR/fullchain.pem"
    export THE_EYE_SSL_KEY="$CERT_DIR/privkey.pem"
    return 0
  fi
  return 1
}

ensure_certs() {
  if has_certs; then
    return 0
  fi

  if [ "$THE_EYE_GENERATE_DEV_SSL" = "true" ]; then
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$CERT_DIR/privkey.pem" \
      -out "$CERT_DIR/fullchain.pem" \
      -subj "/CN=${THE_EYE_ADMIN_SERVER_NAME}/O=THE EYE Dev/C=NG"
    echo "Generated self-signed TLS certificate for ${THE_EYE_ADMIN_SERVER_NAME} (shared path)"
    return 0
  fi

  return 1
}

bootstrap_mode="false"
if ensure_certs; then
  bootstrap_mode="false"
elif [ "$THE_EYE_TLS_BOOTSTRAP" = "true" ] || [ "$THE_EYE_TLS_BOOTSTRAP" = "auto" ]; then
  bootstrap_mode="true"
  echo "TLS certificates missing — HTTP-only bootstrap mode (ACME / certbot)."
  echo "After issuing certs, set THE_EYE_SSL_REDIRECT=true and restart nginx."
elif [ "$THE_EYE_SSL_REDIRECT" = "true" ]; then
  echo "ERROR: TLS certificates missing in ${CERT_DIR} and THE_EYE_TLS_BOOTSTRAP is disabled."
  echo "Install Let's Encrypt certs (scripts/issue-letsencrypt.sh) or set THE_EYE_GENERATE_DEV_SSL=true for local HTTPS."
  exit 1
else
  bootstrap_mode="true"
  echo "TLS certificates missing — serving HTTP only until certs are installed."
fi

render_http_block() {
  locations_snippet="$1"

  if [ "$THE_EYE_SSL_REDIRECT" = "true" ] && [ "$bootstrap_mode" = "true" ]; then
    cat <<EOF
location / {
  return 503 "TLS bootstrap in progress — retry after certificate issuance\n";
  add_header Content-Type text/plain;
}
EOF
    return
  fi

  if [ "$THE_EYE_SSL_REDIRECT" = "true" ]; then
    cat <<'EOF'
location / {
  return 301 https://$host$request_uri;
}
EOF
    return
  fi

  printf 'include /etc/nginx/snippets/%s;\n' "$locations_snippet"
}

render_service_http() {
  prefix="$1"
  label="$2"
  server_name="$3"
  locations_snippet="$4"

  export THE_EYE_SERVICE_LABEL="$label"
  export THE_EYE_SERVER_NAME="$server_name"
  export THE_EYE_HTTP_BLOCK
  THE_EYE_HTTP_BLOCK="$(render_http_block "$locations_snippet")"

  envsubst '${THE_EYE_SERVICE_LABEL} ${THE_EYE_SERVER_NAME} ${THE_EYE_HTTP_BLOCK}' \
    < "$HTTP_TEMPLATE" > "$CONF_D/${prefix}-http.conf"
}

render_service_https() {
  prefix="$1"
  label="$2"
  server_name="$3"
  locations_snippet="$4"

  if ! resolve_ssl_paths "$server_name"; then
    echo "WARNING: skipping HTTPS for ${server_name} — no TLS material found"
    return 0
  fi

  export THE_EYE_SERVICE_LABEL="$label"
  export THE_EYE_SERVER_NAME="$server_name"
  export THE_EYE_LOCATIONS_SNIPPET="$locations_snippet"

  envsubst '${THE_EYE_SERVICE_LABEL} ${THE_EYE_SERVER_NAME} ${THE_EYE_SSL_CERT} ${THE_EYE_SSL_KEY} ${THE_EYE_LOCATIONS_SNIPPET}' \
    < "$HTTPS_TEMPLATE" > "$CONF_D/${prefix}-https.conf"
}

render_service_http "10-admin" "Admin dashboard" "$THE_EYE_ADMIN_SERVER_NAME" "admin-locations.conf"
render_service_http "11-api" "NestJS API" "$THE_EYE_API_SERVER_NAME" "api-locations.conf"
render_service_http "12-livekit" "LiveKit" "$THE_EYE_LIVEKIT_SERVER_NAME" "livekit-locations.conf"

if [ "$bootstrap_mode" = "false" ]; then
  render_service_https "20-admin" "Admin dashboard" "$THE_EYE_ADMIN_SERVER_NAME" "admin-locations.conf"
  render_service_https "21-api" "NestJS API" "$THE_EYE_API_SERVER_NAME" "api-locations.conf"
  render_service_https "22-livekit" "LiveKit" "$THE_EYE_LIVEKIT_SERVER_NAME" "livekit-locations.conf"
  echo "Rendered nginx config (admin=${THE_EYE_ADMIN_SERVER_NAME}, api=${THE_EYE_API_SERVER_NAME}, livekit=${THE_EYE_LIVEKIT_SERVER_NAME}, ssl_redirect=${THE_EYE_SSL_REDIRECT}, https=enabled)"
else
  echo "Rendered nginx config (admin=${THE_EYE_ADMIN_SERVER_NAME}, api=${THE_EYE_API_SERVER_NAME}, livekit=${THE_EYE_LIVEKIT_SERVER_NAME}, ssl_redirect=${THE_EYE_SSL_REDIRECT}, https=disabled)"
fi

if [ "$THE_EYE_SSL_REDIRECT" = "true" ] && [ "$bootstrap_mode" = "true" ]; then
  echo "WARNING: THE_EYE_SSL_REDIRECT=true but HTTPS is unavailable — serving HTTP-only until certificates exist."
fi
