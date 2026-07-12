#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
POSTGRES_USER="${POSTGRES_USER:-the_eye}"
POSTGRES_DB="${POSTGRES_DB:-the_eye}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" ps postgres-postgis --status running -q >/dev/null 2>&1; then
  echo "postgres-postgis is not running. Start the stack before backing up." >&2
  exit 1
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
backup_file="$BACKUP_DIR/the_eye_${timestamp}.dump"

echo "Creating PostgreSQL backup at $backup_file"
docker compose -f "$COMPOSE_FILE" exec -T postgres-postgis \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" -f /tmp/the_eye_backup.dump
docker compose -f "$COMPOSE_FILE" cp "postgres-postgis:/tmp/the_eye_backup.dump" "$backup_file"
cp -f "$backup_file" "$BACKUP_DIR/the_eye_latest.dump"

echo "Backup complete: $backup_file"
echo "Latest copy: $BACKUP_DIR/the_eye_latest.dump"
echo "Note: object storage (MinIO/S3) requires separate bucket backup/versioning."
