#!/usr/bin/env bash
set -euo pipefail

# Gracefully reload nginx after upstream containers are recreated so Docker DNS
# names resolve to fresh container IPs. Requires nginx container to be running.

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f ".env" ]]; then
  echo "Missing .env in ${REPO_ROOT}" >&2
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" --env-file .env ps --status running --services | grep -qx nginx; then
  echo "nginx service is not running — starting nginx ..."
  docker compose -f "$COMPOSE_FILE" --env-file .env up -d nginx
  docker compose -f "$COMPOSE_FILE" --env-file .env up -d --wait nginx
fi

echo "Testing nginx configuration ..."
docker compose -f "$COMPOSE_FILE" --env-file .env exec -T nginx nginx -t

echo "Reloading nginx (graceful) ..."
docker compose -f "$COMPOSE_FILE" --env-file .env exec -T nginx nginx -s reload

echo "nginx upstream reload complete."
