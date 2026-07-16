#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs/live"
HTTP_TEMPLATE="/etc/nginx/render/http.conf.template"
HTTPS_TEMPLATE="/etc/nginx/render/https.conf.template"
UPSTREAMS_SRC="/etc/nginx/snippets/upstreams.conf"
CONF_D="/etc/nginx/conf.d"

: "${THE_EYE_SERVER_NAME:=localhost}"
: "${THE_EYE_SSL_REDIRECT:=false}"
: "${THE_EYE_GENERATE_DEV_SSL:=false}"
: "${THE_EYE_TLS_BOOTSTRAP:=auto}"

mkdir -p "$CONF_D"
rm -f "$CONF_D"/the-eye-*.conf

cp "$UPSTREAMS_SRC" "$CONF_D/00-upstreams.conf"

has_certs() {
  [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]
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
      -subj "/CN=${THE_EYE_SERVER_NAME}/O=THE EYE Dev/C=NG"
    echo "Generated self-signed TLS certificate for ${THE_EYE_SERVER_NAME}"
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

if [ "$THE_EYE_SSL_REDIRECT" = "true" ] && [ "$bootstrap_mode" = "true" ]; then
  echo "WARNING: THE_EYE_SSL_REDIRECT=true but HTTPS is unavailable — serving HTTP-only until certificates exist."
  export THE_EYE_HTTP_BLOCK='location / {
    return 503 "TLS bootstrap in progress — retry after certificate issuance\n";
    add_header Content-Type text/plain;
  }'
elif [ "$THE_EYE_SSL_REDIRECT" = "true" ]; then
  export THE_EYE_HTTP_BLOCK='location / {
    return 301 https://$host$request_uri;
  }'
else
  export THE_EYE_HTTP_BLOCK='include /etc/nginx/snippets/the-eye-locations.conf;'
fi

envsubst '${THE_EYE_SERVER_NAME} ${THE_EYE_HTTP_BLOCK}' < "$HTTP_TEMPLATE" > "$CONF_D/10-http.conf"

if [ "$bootstrap_mode" = "false" ]; then
  envsubst '${THE_EYE_SERVER_NAME}' < "$HTTPS_TEMPLATE" > "$CONF_D/20-https.conf"
  echo "Rendered nginx config (server_name=${THE_EYE_SERVER_NAME}, ssl_redirect=${THE_EYE_SSL_REDIRECT}, https=enabled)"
else
  echo "Rendered nginx config (server_name=${THE_EYE_SERVER_NAME}, ssl_redirect=${THE_EYE_SSL_REDIRECT}, https=disabled)"
fi
