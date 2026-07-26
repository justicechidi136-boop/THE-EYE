#!/usr/bin/env bash
set -euo pipefail

# Staging deploy helper for the VPS. Recreates application containers, waits for
# health, reloads nginx upstreams, and runs Host-aware smoke checks.

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

if [[ ! -f ".env" ]]; then
  echo "Missing .env — configure staging secrets before deploy." >&2
  exit 1
fi

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/safe-env.sh"

THE_EYE_APP_ENV="$(read_env_var THE_EYE_APP_ENV "")"
IMAGE_TAG="${THE_EYE_IMAGE_TAG:-$(read_env_var THE_EYE_IMAGE_TAG local)}"

if [[ "${THE_EYE_APP_ENV}" != "staging" && "${THE_EYE_APP_ENV}" != "stg" ]]; then
  echo "THE_EYE_APP_ENV must be staging (got '${THE_EYE_APP_ENV:-unset}')." >&2
  exit 1
fi

rollback_note() {
  echo "Deploy failed — inspect: docker compose -f ${COMPOSE_FILE} --env-file .env ps" >&2
  echo "Previous containers may still be running; review logs before retrying." >&2
}

trap rollback_note ERR

echo "=== THE EYE staging deploy (tag=${IMAGE_TAG}) ==="

echo "[1/8] Validating compose configuration ..."
docker compose -f "$COMPOSE_FILE" --env-file .env config >/dev/null

echo "[2/8] Building application images ..."
docker compose -f "$COMPOSE_FILE" --env-file .env build api admin-web api-migrate api-tools 2>/dev/null || \
  docker compose -f "$COMPOSE_FILE" --env-file .env build api admin-web

echo "[3/8] Ensuring data plane is healthy ..."
docker compose -f "$COMPOSE_FILE" --env-file .env up -d postgres-postgis redis minio livekit
docker compose -f "$COMPOSE_FILE" --env-file .env up -d --wait postgres-postgis redis minio livekit

if [[ "${RUN_MIGRATIONS}" == "true" ]]; then
  echo "[4/8] Running database migrations ..."
  docker compose -f "$COMPOSE_FILE" --env-file .env --profile tools run --rm api-migrate
else
  echo "[4/8] Skipping migrations (RUN_MIGRATIONS=${RUN_MIGRATIONS})"
fi

echo "[5/8] Recreating application tier ..."
docker compose -f "$COMPOSE_FILE" --env-file .env up -d --force-recreate api notification-worker admin-web
docker compose -f "$COMPOSE_FILE" --env-file .env up -d --wait api admin-web livekit

echo "[6/8] Reloading nginx upstreams ..."
bash scripts/reload-nginx-upstreams.sh

echo "[7/8] Running Host-aware smoke checks ..."
bash scripts/staging-smoke-check.sh

echo "[8/8] Compose status:"
docker compose -f "$COMPOSE_FILE" --env-file .env ps

echo "Staging deploy complete."
