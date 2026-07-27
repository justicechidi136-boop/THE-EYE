#!/usr/bin/env bash
# Isolated restore drill — never modifies the live staging/production database.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_FILE=""
DRILL_IMAGE="${DRILL_IMAGE:-postgis/postgis:16-3.4}"
DRILL_CONTAINER="the-eye-backup-drill-$$"
DRILL_DB="${DRILL_DB:-the_eye_drill}"
DRILL_USER="${DRILL_USER:-the_eye}"

cleanup() {
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

usage() {
  echo "Usage: $0 --backup-file PATH" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-file)
      BACKUP_FILE="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "BACKUP-010: Restore drill requires an existing backup file." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "BACKUP-001: Docker CLI is not available for restore drill." >&2
  exit 1
fi

echo "Starting isolated restore drill container: $DRILL_CONTAINER"
docker run -d --name "$DRILL_CONTAINER" \
  -e POSTGRES_PASSWORD=drill_restore_only \
  -e POSTGRES_USER="$DRILL_USER" \
  -e POSTGRES_DB="$DRILL_DB" \
  "$DRILL_IMAGE" >/dev/null

ready=0
for _ in $(seq 1 30); do
  if docker exec "$DRILL_CONTAINER" pg_isready -U "$DRILL_USER" -d "$DRILL_DB" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ $ready -ne 1 ]]; then
  echo "BACKUP-010: Restore drill database did not become ready in time." >&2
  exit 1
fi

echo "Restoring backup into isolated database $DRILL_DB"
if ! docker cp "$BACKUP_FILE" "$DRILL_CONTAINER:/tmp/the-eye-restore.dump" >/dev/null 2>&1; then
  echo "BACKUP-010: Restore drill could not copy backup into temporary container." >&2
  exit 1
fi

if ! docker exec "$DRILL_CONTAINER" pg_restore \
  -U "$DRILL_USER" \
  -d "$DRILL_DB" \
  --no-owner \
  --no-privileges \
  /tmp/the-eye-restore.dump >/dev/null 2>&1; then
  echo "Restore drill: pg_restore returned non-zero (continuing with table checks)." >&2
fi

if ! docker exec "$DRILL_CONTAINER" pg_isready -U "$DRILL_USER" -d "$DRILL_DB" >/dev/null 2>&1; then
  echo "BACKUP-010: Restore drill database is not running after restore." >&2
  exit 1
fi

docker exec "$DRILL_CONTAINER" rm -f /tmp/the-eye-restore.dump >/dev/null 2>&1 || true

check_table_count() {
  local table="$1"
  docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';" \
    | tr -d '\r'
}

for table in users incidents incident_location_updates notifications broadcasts audit_logs police_stations; do
  count="$(check_table_count "$table")"
  if [[ "$count" != "1" ]]; then
    echo "BACKUP-010: Restore drill missing table: $table" >&2
    exit 1
  fi
done

echo "Restore drill passed: critical tables present in isolated database."
exit 0
