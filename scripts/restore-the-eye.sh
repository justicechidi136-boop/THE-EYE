#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file> [--confirm]" >&2
  echo "Restore is destructive. Pass --confirm to proceed." >&2
  exit 1
fi

BACKUP_FILE="$1"
CONFIRM="${2:-}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
POSTGRES_USER="${POSTGRES_USER:-the_eye}"
POSTGRES_DB="${POSTGRES_DB:-the_eye}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ "$CONFIRM" != "--confirm" ]]; then
  echo "Restore will overwrite data in database '$POSTGRES_DB'. Re-run with --confirm to proceed."
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" ps postgres-postgis --status running -q >/dev/null 2>&1; then
  echo "postgres-postgis is not running. Start the stack before restoring." >&2
  exit 1
fi

echo "Restoring PostgreSQL from $BACKUP_FILE"
docker compose -f "$COMPOSE_FILE" cp "$BACKUP_FILE" "postgres-postgis:/tmp/the_eye_restore.dump"
docker compose -f "$COMPOSE_FILE" exec -T postgres-postgis \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/the_eye_restore.dump

echo "Restore complete."
echo "Next steps:"
echo "  1. docker compose -f $COMPOSE_FILE --profile tools run api-migrate"
echo "  2. curl -k https://localhost/v1/health/ready"
