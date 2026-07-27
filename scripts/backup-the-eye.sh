#!/usr/bin/env bash
# THE EYE PostgreSQL backup — uses the same Compose file and env-file as the running stack.
set -Eeuo pipefail

readonly SCRIPT_VERSION="2.0.0"
readonly DB_SERVICE="postgres-postgis"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/infra/docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/.env}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-}"
ENVIRONMENT="${THE_EYE_APP_ENV:-${ENVIRONMENT:-staging}}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_RETENTION_COUNT="${BACKUP_RETENTION_COUNT:-0}"
DRY_RUN_RETENTION="${DRY_RUN_RETENTION:-false}"
WITH_RESTORE_DRILL="${WITH_RESTORE_DRILL:-false}"
SKIP_RETENTION="${SKIP_RETENTION:-false}"

TEMP_BACKUP_PATH=""
FINAL_BACKUP_PATH=""
METADATA_PATH=""
CONTAINER_BACKUP_PATH=""
COMPOSE_CMD=()
DOCKER_BIN=(docker)

cleanup() {
  local exit_code=$?
  if [[ -n "$CONTAINER_BACKUP_PATH" ]]; then
    "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" rm -f "$CONTAINER_BACKUP_PATH" >/dev/null 2>&1 || true
    CONTAINER_BACKUP_PATH=""
  fi
  if [[ -n "$TEMP_BACKUP_PATH" && -f "$TEMP_BACKUP_PATH" ]]; then
    rm -f "$TEMP_BACKUP_PATH"
  fi
  if [[ $exit_code -ne 0 ]]; then
    [[ -n "$FINAL_BACKUP_PATH" && -f "$FINAL_BACKUP_PATH" ]] && rm -f "$FINAL_BACKUP_PATH"
    [[ -n "$METADATA_PATH" && -f "$METADATA_PATH" ]] && rm -f "$METADATA_PATH"
  fi
}
trap cleanup EXIT INT TERM

die() {
  echo "$1" >&2
  exit "${2:-1}"
}

usage() {
  cat <<'EOF'
Usage: backup-the-eye.sh [options]

Options:
  --compose-file PATH   Docker Compose file (default: infra/docker/docker-compose.yml)
  --env-file PATH       Environment file (default: .env in repo root)
  --output-dir PATH     Backup destination (default: backups/)
  --environment NAME    Environment label for filenames/metadata (default: staging or THE_EYE_APP_ENV)
  --project-name NAME   Optional explicit Compose project name
  --with-restore-drill  Run isolated restore validation after backup (never touches live DB)
  --dry-run-retention   Print retention actions without deleting files
  --skip-retention      Skip retention cleanup after successful backup
  -h, --help            Show this help

Environment variables: COMPOSE_FILE, ENV_FILE, BACKUP_DIR, COMPOSE_PROJECT_NAME,
BACKUP_RETENTION_DAYS, BACKUP_RETENTION_COUNT, WITH_RESTORE_DRILL, DRY_RUN_RETENTION.
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --compose-file)
        COMPOSE_FILE="$2"
        shift 2
        ;;
      --env-file)
        ENV_FILE="$2"
        shift 2
        ;;
      --output-dir)
        BACKUP_DIR="$2"
        shift 2
        ;;
      --environment)
        ENVIRONMENT="$2"
        shift 2
        ;;
      --project-name)
        COMPOSE_PROJECT_NAME="$2"
        shift 2
        ;;
      --with-restore-drill)
        WITH_RESTORE_DRILL=true
        shift
        ;;
      --dry-run-retention)
        DRY_RUN_RETENTION=true
        shift
        ;;
      --skip-retention)
        SKIP_RETENTION=true
        shift
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "Unknown argument: $1" 1
        ;;
    esac
  done
}

resolve_compose_cmd() {
  local -a base_cmd=()
  if [[ -n "${THE_EYE_BACKUP_MOCK_DOCKER:-}" ]]; then
    base_cmd=(bash "$THE_EYE_BACKUP_MOCK_DOCKER" compose)
  elif [[ -n "${THE_EYE_BACKUP_COMPOSE_BIN:-}" ]]; then
    # shellcheck disable=SC2086
    eval "base_cmd=($THE_EYE_BACKUP_COMPOSE_BIN)"
  else
    base_cmd=(docker compose)
  fi

  COMPOSE_CMD=(
    "${base_cmd[@]}"
    -f "$COMPOSE_FILE"
    --env-file "$ENV_FILE"
  )
  if [[ -n "$COMPOSE_PROJECT_NAME" ]]; then
    COMPOSE_CMD+=(--project-name "$COMPOSE_PROJECT_NAME")
  fi

  if [[ -n "${THE_EYE_BACKUP_MOCK_DOCKER:-}" ]]; then
    DOCKER_BIN=(bash "$THE_EYE_BACKUP_MOCK_DOCKER")
  elif [[ -n "${THE_EYE_BACKUP_DOCKER_BIN:-}" ]]; then
    # shellcheck disable=SC2086
    eval "DOCKER_BIN=($THE_EYE_BACKUP_DOCKER_BIN)"
  else
    DOCKER_BIN=(docker)
  fi
}

validate_prerequisites() {
  if ! command -v docker >/dev/null 2>&1; then
    die "BACKUP-001: Docker CLI is not available." 1
  fi

  if [[ -z "${THE_EYE_BACKUP_COMPOSE_BIN:-}" && -z "${THE_EYE_BACKUP_MOCK_DOCKER:-}" ]]; then
    if ! docker compose version >/dev/null 2>&1; then
      die "BACKUP-002: Docker Compose plugin is not available." 1
    fi
  fi

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    die "BACKUP-003: Compose file not found: $COMPOSE_FILE" 1
  fi

  if [[ ! -r "$COMPOSE_FILE" ]]; then
    die "BACKUP-003: Compose file is not readable: $COMPOSE_FILE" 1
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    die "BACKUP-004: Environment file not found: $ENV_FILE" 1
  fi

  if [[ ! -r "$ENV_FILE" ]]; then
    die "BACKUP-004: Environment file is not readable: $ENV_FILE" 1
  fi

  if ! mkdir -p "$BACKUP_DIR" 2>/dev/null; then
    die "BACKUP-007: Backup directory is not writable: $BACKUP_DIR" 1
  fi
  if [[ ! -w "$BACKUP_DIR" ]]; then
    die "BACKUP-007: Backup directory is not writable: $BACKUP_DIR" 1
  fi

  local services
  if ! services="$("${COMPOSE_CMD[@]}" config --services 2>/dev/null | tr -d '\r')"; then
    die "BACKUP-002: Unable to render Compose configuration." 1
  fi
  if ! grep -qx "$DB_SERVICE" <<<"$services"; then
    die "BACKUP-005: Service '$DB_SERVICE' is not defined in Compose configuration." 1
  fi
}

check_db_running_and_healthy() {
  local container_id health_status
  container_id="$(
    "${COMPOSE_CMD[@]}" ps --status running -q "$DB_SERVICE" 2>/dev/null || true
  )"
  if [[ -z "$container_id" ]]; then
    die "BACKUP-006: $DB_SERVICE is not running. Start the stack with the same Compose file and env-file before backing up." 1
  fi

  health_status="$("${DOCKER_BIN[@]}" inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || echo "unknown")"
  case "$health_status" in
    healthy | none)
      ;;
    starting)
      die "BACKUP-006: $DB_SERVICE is running but healthcheck is still starting." 1
      ;;
    unhealthy | unknown)
      die "BACKUP-006: $DB_SERVICE is running but not healthy (status: $health_status)." 1
      ;;
  esac

  echo "$container_id"
}

resolve_db_identity() {
  local user db
  user="$(
    "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" printenv POSTGRES_USER 2>/dev/null | tr -d '\r'
  )"
  db="$(
    "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" printenv POSTGRES_DB 2>/dev/null | tr -d '\r'
  )"
  POSTGRES_USER="${user:-the_eye}"
  POSTGRES_DB="${db:-the_eye}"
}

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$path" | awk '{print $NF}'
  else
    die "BACKUP-010: No SHA-256 utility available (sha256sum, shasum, or openssl)." 1
  fi
}

validate_backup_archive() {
  local backup_path="$1"
  local list_output container_path="/tmp/the-eye-validate-$$.dump"
  if [[ ! -s "$backup_path" ]]; then
    die "BACKUP-010: Backup file is empty: $backup_path" 1
  fi

  if ! head -c 5 "$backup_path" | grep -q "PGDMP"; then
    die "BACKUP-010: Backup file is not a PostgreSQL custom-format archive." 1
  fi

  if ! "${COMPOSE_CMD[@]}" cp "$backup_path" "${DB_SERVICE}:${container_path}" >/dev/null 2>&1; then
    die "BACKUP-010: Unable to copy backup into database container for validation." 1
  fi

  if ! list_output="$(
    "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" pg_restore --list "$container_path" 2>&1
  )"; then
    "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" rm -f "$container_path" >/dev/null 2>&1 || true
    die "BACKUP-010: pg_restore --list failed for backup archive." 1
  fi
  "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" rm -f "$container_path" >/dev/null 2>&1 || true

  local -a required_tables=(
    "TABLE DATA public users"
    "TABLE DATA public incidents"
    "TABLE DATA public incident_location_updates"
    "TABLE DATA public notifications"
    "TABLE DATA public broadcasts"
    "TABLE DATA public audit_logs"
    "TABLE DATA public police_stations"
  )
  local missing=0
  local marker
  for marker in "${required_tables[@]}"; do
    if ! grep -Fq "$marker" <<<"$list_output"; then
      echo "BACKUP-010: Missing expected archive entry: $marker" >&2
      missing=1
    fi
  done
  if [[ $missing -ne 0 ]]; then
    die "BACKUP-010: Backup archive validation failed (missing critical tables)." 1
  fi
}

write_metadata() {
  local backup_path="$1"
  local checksum="$2"
  local validation_result="$3"
  local git_sha pg_version file_size created_at

  git_sha="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown")"
  pg_version="$(
    "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" postgres --version 2>/dev/null | tr -d '\r' || echo "unknown"
  )"
  file_size="$(wc -c <"$backup_path" | tr -d ' \n\r')"
  created_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  METADATA_PATH="${backup_path%.dump}.json"
  cat >"$METADATA_PATH" <<EOF
{
  "environment": "$ENVIRONMENT",
  "createdAt": "$created_at",
  "gitSha": "$git_sha",
  "databaseService": "$DB_SERVICE",
  "postgresVersion": "$pg_version",
  "databaseName": "$POSTGRES_DB",
  "fileSizeBytes": $file_size,
  "sha256": "$checksum",
  "backupFormat": "pg_dump-custom",
  "scriptVersion": "$SCRIPT_VERSION",
  "validationResult": "$validation_result"
}
EOF
}

apply_retention() {
  [[ "$SKIP_RETENTION" == "true" ]] && return 0
  local retention_days="$BACKUP_RETENTION_DAYS"
  local retention_count="$BACKUP_RETENTION_COUNT"
  local pattern="the-eye-${ENVIRONMENT}-*.dump"

  if [[ "$retention_days" =~ ^[0-9]+$ ]] && [[ "$retention_days" -gt 0 ]]; then
    while IFS= read -r old_file; do
      [[ -z "$old_file" ]] && continue
      if [[ "$DRY_RUN_RETENTION" == "true" ]]; then
        echo "Retention (dry-run): would delete $old_file"
      else
        rm -f "$old_file" "${old_file%.dump}.json"
        echo "Retention: removed $old_file"
      fi
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$pattern" -mtime "+$retention_days" | sort)
  fi

  if [[ "$retention_count" =~ ^[0-9]+$ ]] && [[ "$retention_count" -gt 0 ]]; then
    local -a files=()
    while IFS= read -r file; do
      [[ -n "$file" ]] && files+=("$file")
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$pattern" | sort -r)
    local i
    for ((i = retention_count; i < ${#files[@]}; i++)); do
      if [[ "$DRY_RUN_RETENTION" == "true" ]]; then
        echo "Retention (dry-run): would delete ${files[$i]}"
      else
        rm -f "${files[$i]}" "${files[$i]%.dump}.json"
        echo "Retention: removed ${files[$i]}"
      fi
    done
  fi
}

run_restore_drill() {
  local backup_path="$1"
  echo "Restore drill: validating backup in isolated temporary container (live database untouched)."
  if ! bash "$SCRIPT_DIR/backup-restore-drill.sh" --backup-file "$backup_path"; then
    die "BACKUP-010: Isolated restore drill failed." 1
  fi
}

create_backup() {
  local timestamp backup_basename
  timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
  backup_basename="the-eye-${ENVIRONMENT}-${timestamp}"
  TEMP_BACKUP_PATH="$(mktemp "${BACKUP_DIR}/.${backup_basename}.XXXXXX")"
  TEMP_BACKUP_PATH="${TEMP_BACKUP_PATH}.dump"
  FINAL_BACKUP_PATH="$BACKUP_DIR/${backup_basename}.dump"

  echo "Creating PostgreSQL backup (service: $DB_SERVICE, database: $POSTGRES_DB)"
  echo "Compose file: $COMPOSE_FILE"
  echo "Environment file: $ENV_FILE"
  echo "Temporary backup: $TEMP_BACKUP_PATH"

  CONTAINER_BACKUP_PATH="/tmp/${backup_basename}.dump"
  if ! "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" \
    pg_dump -U "$POSTGRES_USER" -Fc -f "$CONTAINER_BACKUP_PATH" "$POSTGRES_DB"; then
    die "BACKUP-008: pg_dump failed." 1
  fi

  if ! "${COMPOSE_CMD[@]}" cp "${DB_SERVICE}:${CONTAINER_BACKUP_PATH}" "$TEMP_BACKUP_PATH"; then
    die "BACKUP-009: Backup copy from container failed." 1
  fi
  "${COMPOSE_CMD[@]}" exec -T "$DB_SERVICE" rm -f "$CONTAINER_BACKUP_PATH" >/dev/null 2>&1 || true
  CONTAINER_BACKUP_PATH=""

  if [[ ! -s "$TEMP_BACKUP_PATH" ]]; then
    die "BACKUP-008: pg_dump produced an empty backup file." 1
  fi

  validate_backup_archive "$TEMP_BACKUP_PATH"

  local checksum
  checksum="$(sha256_file "$TEMP_BACKUP_PATH")"
  mv -f "$TEMP_BACKUP_PATH" "$FINAL_BACKUP_PATH"
  TEMP_BACKUP_PATH=""

  write_metadata "$FINAL_BACKUP_PATH" "$checksum" "passed"

  local latest_link="$BACKUP_DIR/the-eye-${ENVIRONMENT}-latest.dump"
  cp -f "$FINAL_BACKUP_PATH" "$latest_link"
  cp -f "$METADATA_PATH" "${latest_link%.dump}.json"

  # Backward-compatible alias used by older runbooks.
  cp -f "$FINAL_BACKUP_PATH" "$BACKUP_DIR/the_eye_latest.dump"

  echo "Backup complete: $FINAL_BACKUP_PATH"
  echo "Metadata: $METADATA_PATH"
  echo "SHA-256: $checksum"
  echo "Size bytes: $(wc -c <"$FINAL_BACKUP_PATH" | tr -d ' \n\r')"
  echo "Latest copy: $latest_link"

  if [[ "$WITH_RESTORE_DRILL" == "true" ]]; then
    run_restore_drill "$FINAL_BACKUP_PATH"
  fi

  apply_retention
}

main() {
  parse_args "$@"
  cd "$PROJECT_ROOT"
  resolve_compose_cmd
  validate_prerequisites
  check_db_running_and_healthy >/dev/null
  resolve_db_identity
  create_backup
}

main "$@"
