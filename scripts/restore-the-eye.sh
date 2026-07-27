#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file> [--confirm]" >&2
  echo "Restore is destructive. Pass --confirm to proceed." >&2
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM="${2:-}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/infra/docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
DB_SERVICE="postgres-postgis"

COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
if [[ -n "$COMPOSE_PROJECT_NAME" ]]; then
  COMPOSE_CMD+=(--project-name "$COMPOSE_PROJECT_NAME")
fi

cd "$PROJECT_ROOT"

if [[ "$CONFIRM" != "--confirm" ]]; then
  echo "Restore will overwrite data in the target database. Re-run with --confirm to proceed."
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

container_id="$("${COMPOSE_CMD[@]}" ps --status running -q "$DB_SERVICE" 2>/dev/null || true)"
if [[ -z "$container_id" ]]; then
  echo "postgres-postgis is not running. Start the stack before restoring." >&2
  exit 1
fi

POSTGRES_USER="$(
  "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" printenv POSTGRES_USER 2>/dev/null | tr -d '\r'
)"
POSTGRES_DB="$(
  "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" printenv POSTGRES_DB 2>/dev/null | tr -d '\r'
)"
POSTGRES_USER="${POSTGRES_USER:-the_eye}"
POSTGRES_DB="${POSTGRES_DB:-the_eye}"

echo "Restoring PostgreSQL from $BACKUP_FILE"
cat "$BACKUP_FILE" | "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges

echo "Restore complete."
echo "Next steps:"
echo "  1. ${COMPOSE_CMD[*]} --profile tools run --rm api-migrate"
echo "  2. curl -sf https://staging-api.theeye.com.ng/v1/health/ready"
