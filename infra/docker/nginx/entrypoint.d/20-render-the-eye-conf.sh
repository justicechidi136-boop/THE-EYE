#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs/live"
TEMPLATE="/etc/nginx/render/the-eye.conf.template"
OUTPUT="/etc/nginx/conf.d/the-eye.conf"

: "${THE_EYE_SERVER_NAME:=localhost}"
: "${THE_EYE_SSL_REDIRECT:=false}"
: "${THE_EYE_GENERATE_DEV_SSL:=false}"

if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  if [ "$THE_EYE_GENERATE_DEV_SSL" = "true" ]; then
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$CERT_DIR/privkey.pem" \
      -out "$CERT_DIR/fullchain.pem" \
      -subj "/CN=${THE_EYE_SERVER_NAME}/O=THE EYE Dev/C=NG"
    echo "Generated self-signed TLS certificate for ${THE_EYE_SERVER_NAME}"
  else
    echo "ERROR: TLS certificates missing in ${CERT_DIR}."
    echo "Install Let's Encrypt certs or set THE_EYE_GENERATE_DEV_SSL=true for local HTTPS."
    exit 1
  fi
fi

if [ "$THE_EYE_SSL_REDIRECT" = "true" ]; then
  export THE_EYE_HTTP_BLOCK='location / {
    return 301 https://$host$request_uri;
  }'
else
  export THE_EYE_HTTP_BLOCK='include /etc/nginx/snippets/the-eye-locations.conf;'
fi

envsubst '${THE_EYE_SERVER_NAME} ${THE_EYE_HTTP_BLOCK}' < "$TEMPLATE" > "$OUTPUT"
echo "Rendered nginx config (server_name=${THE_EYE_SERVER_NAME}, ssl_redirect=${THE_EYE_SSL_REDIRECT})"
