#!/usr/bin/env bash
set -euo pipefail

# Production deploy helper — build, migrate, and restart THE EYE stack.
# Run on the VPS from the repository root with .env configured.

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
IMAGE_TAG="${THE_EYE_IMAGE_TAG:-local}"
PROFILES="${THE_EYE_PROFILES:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f ".env" ]]; then
  echo "Missing .env — copy from .env.example and configure production secrets." >&2
  exit 1
fi

echo "=== THE EYE production deploy (tag=$IMAGE_TAG) ==="

echo "[1/6] Validating compose configuration ..."
docker compose -f "$COMPOSE_FILE" --env-file .env config >/dev/null

echo "[2/6] Building images ..."
docker compose -f "$COMPOSE_FILE" --env-file .env build api admin-web

echo "[3/6] Starting data services ..."
docker compose -f "$COMPOSE_FILE" --env-file .env up -d postgres-postgis redis minio livekit
docker compose -f "$COMPOSE_FILE" --env-file .env up -d --wait postgres-postgis redis minio

echo "[4/6] Running database migrations ..."
docker compose -f "$COMPOSE_FILE" --env-file .env --profile tools run --rm api-migrate

echo "[5/6] Starting application tier ..."
docker compose -f "$COMPOSE_FILE" --env-file .env up -d api admin-web nginx

if [[ -n "$PROFILES" ]]; then
  echo "[5b] Starting optional profiles: $PROFILES"
  docker compose -f "$COMPOSE_FILE" --env-file .env --profile "$PROFILES" up -d
fi

echo "[6/6] Waiting for health checks ..."
deadline=$((SECONDS + 180))
while (( SECONDS < deadline )); do
  if curl -fsS "http://127.0.0.1/healthz" >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1/v1/health/ready" >/dev/null 2>&1 || \
       curl -kfsS "https://127.0.0.1/v1/health/ready" >/dev/null 2>&1; then
      echo "Deploy healthy."
      exit 0
    fi
  fi
  sleep 5
done

echo "Health check timed out — inspect: docker compose -f $COMPOSE_FILE ps" >&2
exit 1
