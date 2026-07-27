#!/usr/bin/env bash
# Isolated restore drill — never modifies the live staging/production database.
set -Eeuo pipefail

BACKUP_FILE=""
METADATA_PATH=""
COMPOSE_FILE=""
ENV_FILE=""
STAGING_CONTAINER_ID=""
STAGING_DB_NAME="${STAGING_DB_NAME:-the_eye}"

DRILL_IMAGE="${DRILL_IMAGE:-postgis/postgis:16-3.4}"
DRILL_ID="${DRILL_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
DRILL_CONTAINER="the-eye-backup-drill-${DRILL_ID}"
DRILL_NETWORK="the-eye-backup-drill-net-${DRILL_ID}"
DRILL_VOLUME="the-eye-backup-drill-vol-${DRILL_ID}"
DRILL_DB="${DRILL_DB:-the_eye_drill}"
DRILL_USER="${DRILL_USER:-the_eye_drill}"
DRILL_PASSWORD="${DRILL_PASSWORD:-drill_restore_only}"
MAINT_DB="postgres"
RESTORE_MOUNT="/restore/backup.dump"

STARTUP_TIMEOUT_SEC="${STARTUP_TIMEOUT_SEC:-120}"
RESTORE_TIMEOUT_SEC="${RESTORE_TIMEOUT_SEC:-600}"

STATE="CREATED"
CLEANUP_ON_EXIT=true
RESTORE_EXIT_CODE=0
RESTORE_STARTED_AT=""
RESTORE_FINISHED_AT=""

COMPOSE_CMD=()
declare -A SOURCE_COUNTS=()

log_state() {
  echo "Restore drill state: $1"
  STATE="$1"
}

die() {
  echo "$1" >&2
  exit "${2:-1}"
}

usage() {
  cat <<'EOF'
Usage: backup-restore-drill.sh --backup-file PATH [options]

Options:
  --backup-file PATH           Custom-format pg_dump archive (required)
  --metadata-path PATH         Backup metadata JSON for checksum comparison
  --compose-file PATH          Live stack compose file (safety checks + source counts)
  --env-file PATH              Live stack env file (safety checks + source counts)
  --staging-container-id ID    Running postgres-postgis container ID to reject as target
  --staging-db-name NAME       Live database name to reject as restore target
  -h, --help                   Show this help
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --backup-file)
        BACKUP_FILE="$2"
        shift 2
        ;;
      --metadata-path)
        METADATA_PATH="$2"
        shift 2
        ;;
      --compose-file)
        COMPOSE_FILE="$2"
        shift 2
        ;;
      --env-file)
        ENV_FILE="$2"
        shift 2
        ;;
      --staging-container-id)
        STAGING_CONTAINER_ID="$2"
        shift 2
        ;;
      --staging-db-name)
        STAGING_DB_NAME="$2"
        shift 2
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
  [[ -z "$COMPOSE_FILE" || -z "$ENV_FILE" ]] && return 0
  COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
}

resolve_staging_container_id() {
  if [[ -n "$STAGING_CONTAINER_ID" ]]; then
    return 0
  fi
  [[ ${#COMPOSE_CMD[@]} -eq 0 ]] && return 0
  STAGING_CONTAINER_ID="$(
    "${COMPOSE_CMD[@]}" ps --status running -q postgres-postgis 2>/dev/null | head -n1 | tr -d '\r'
  )"
}

assert_restore_target_isolated() {
  local drill_ref="${DRILL_CONTAINER}|${DRILL_DB}|${DRILL_NETWORK}|${DRILL_VOLUME}"

  if [[ -n "$STAGING_CONTAINER_ID" ]]; then
    if [[ "$DRILL_CONTAINER" == "$STAGING_CONTAINER_ID" ]]; then
      die "BACKUP-010: Restore drill refused — target container matches live staging postgres container." 1
    fi
    if docker inspect --format='{{.Name}}' "$STAGING_CONTAINER_ID" 2>/dev/null | grep -q 'postgres-postgis'; then
      :
    fi
  fi

  if [[ "$DRILL_DB" == "$STAGING_DB_NAME" && -z "$DRILL_CONTAINER" ]]; then
    die "BACKUP-010: Restore drill refused — drill database name matches live staging database." 1
  fi

  if [[ ${#COMPOSE_CMD[@]} -gt 0 ]]; then
    local live_db live_container
    live_db="$(
      "${COMPOSE_CMD[@]}" exec -T postgres-postgis printenv POSTGRES_DB 2>/dev/null | tr -d '\r' || true
    )"
    live_container="$(
      "${COMPOSE_CMD[@]}" ps --status running -q postgres-postgis 2>/dev/null | head -n1 | tr -d '\r' || true
    )"
    if [[ -n "$live_container" && "$live_container" == "$DRILL_CONTAINER" ]]; then
      die "BACKUP-010: Restore drill refused — drill container matches live postgres-postgis container." 1
    fi
    if [[ -n "$live_db" && "$live_db" == "$DRILL_DB" && "$DRILL_CONTAINER" == "$live_container" ]]; then
      die "BACKUP-010: Restore drill refused — restore target matches active staging database." 1
    fi
  fi

  echo "Restore drill safety: target isolated ($drill_ref)"
}

verify_backup_checksum() {
  [[ -z "$METADATA_PATH" || ! -f "$METADATA_PATH" ]] && return 0
  local expected actual
  expected="$(grep -Eo '"sha256"[[:space:]]*:[[:space:]]*"[a-f0-9]{64}"' "$METADATA_PATH" | head -n1 | grep -Eo '[a-f0-9]{64}' || true)"
  [[ -z "$expected" ]] && return 0
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$BACKUP_FILE" | awk '{print $1}')"
  else
    return 0
  fi
  if [[ "$actual" != "$expected" ]]; then
    die "BACKUP-010: Backup checksum mismatch before restore drill." 1
  fi
  echo "Restore drill: backup checksum verified against metadata."
}

collect_source_counts() {
  [[ ${#COMPOSE_CMD[@]} -eq 0 ]] && return 0
  local user db table count
  user="$(
    "${COMPOSE_CMD[@]}" exec -T postgres-postgis printenv POSTGRES_USER 2>/dev/null | tr -d '\r' || echo "the_eye"
  )"
  db="$(
    "${COMPOSE_CMD[@]}" exec -T postgres-postgis printenv POSTGRES_DB 2>/dev/null | tr -d '\r' || echo "$STAGING_DB_NAME"
  )"
  STAGING_DB_NAME="$db"
  for table in users incidents incident_location_updates notifications broadcasts audit_logs police_stations account_recovery_challenges; do
    count="$(
      "${COMPOSE_CMD[@]}" exec -T postgres-postgis psql -U "$user" -d "$db" -Atqc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}';" 2>/dev/null \
        | tr -d '\r' || echo "0"
    )"
    if [[ "$count" == "1" ]]; then
      SOURCE_COUNTS["$table"]="$(
        "${COMPOSE_CMD[@]}" exec -T postgres-postgis psql -U "$user" -d "$db" -Atqc \
          "SELECT count(*) FROM public.\"${table}\";" 2>/dev/null | tr -d '\r' || echo "0"
      )"
    else
      SOURCE_COUNTS["$table"]="n/a"
    fi
  done
}

print_count_comparison() {
  local table source restored match
  echo "Restore drill count comparison:"
  printf '%-32s %14s %16s %5s\n' "table" "source_count" "restored_count" "match"
  for table in users incidents incident_location_updates notifications broadcasts audit_logs police_stations account_recovery_challenges; do
    source="${SOURCE_COUNTS[$table]:-n/a}"
    restored="$(drill_table_row_count "$table")"
    if [[ "$source" == "n/a" ]]; then
      match="n/a"
    elif [[ "$source" == "$restored" ]]; then
      match="yes"
    else
      match="NO"
    fi
    printf '%-32s %14s %16s %5s\n' "$table" "$source" "$restored" "$match"
    if [[ "$match" == "NO" ]]; then
      die "BACKUP-010: Restore drill row count mismatch for table $table." 1
    fi
  done
}

capture_diagnostics() {
  echo "Restore drill diagnostics (state=$STATE, container=$DRILL_CONTAINER)"
  if docker inspect "$DRILL_CONTAINER" >/dev/null 2>&1; then
    echo "--- docker inspect (state) ---"
    docker inspect --format='ID={{.Id}} Name={{.Name}} Image={{.Config.Image}} ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}} Status={{.State.Status}} Error={{.State.Error}} StartedAt={{.State.StartedAt}} FinishedAt={{.State.FinishedAt}}' \
      "$DRILL_CONTAINER" 2>/dev/null || true
    echo "--- docker inspect (memory/cpu) ---"
    docker inspect --format='Memory={{.HostConfig.Memory}} NanoCpus={{.HostConfig.NanoCpus}}' \
      "$DRILL_CONTAINER" 2>/dev/null || true
    echo "--- docker inspect (env keys) ---"
    docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' "$DRILL_CONTAINER" 2>/dev/null \
      | cut -d= -f1 | sort || true
    echo "--- container logs (last 80 lines) ---"
    docker logs --tail 80 "$DRILL_CONTAINER" 2>&1 || true
  else
    echo "Container $DRILL_CONTAINER not present for inspection."
  fi
  echo "--- docker system df ---"
  docker system df 2>/dev/null || true
  echo "--- df -h ---"
  df -h 2>/dev/null || true
  echo "--- df -i ---"
  df -i 2>/dev/null || true
  if [[ -f /tmp/the-eye-restore-drill.log ]]; then
    echo "--- pg_restore log (last 40 lines, sanitized) ---"
    tail -n 40 /tmp/the-eye-restore-drill.log 2>/dev/null | sed -E 's/(password=)[^ ]+/\1***/Ig' || true
  fi
}

cleanup_resources() {
  [[ "$CLEANUP_ON_EXIT" != "true" ]] && return 0
  log_state "CLEANUP"
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
  docker volume rm -f "$DRILL_VOLUME" >/dev/null 2>&1 || true
  docker network rm -f "$DRILL_NETWORK" >/dev/null 2>&1 || true
}

on_exit() {
  local code=$?
  if [[ $code -ne 0 ]]; then
    CLEANUP_ON_EXIT=false
    capture_diagnostics
    CLEANUP_ON_EXIT=true
  fi
  cleanup_resources
  return "$code"
}
trap on_exit EXIT INT TERM

container_running() {
  docker inspect --format='{{.State.Running}}' "$DRILL_CONTAINER" 2>/dev/null | grep -qx 'true'
}

wait_for_pg_ready() {
  local db="$1"
  local attempts="$2"
  local i
  for ((i = 1; i <= attempts; i++)); do
    if container_running && docker exec "$DRILL_CONTAINER" pg_isready -U "$DRILL_USER" -d "$db" >/dev/null 2>&1; then
      return 0
    fi
    if ! container_running; then
      return 1
    fi
    sleep 2
  done
  return 1
}

wait_for_container_healthy() {
  local i status
  for ((i = 1; i <= 60; i++)); do
    status="$(
      docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
        "$DRILL_CONTAINER" 2>/dev/null || echo "unknown"
    )"
    if [[ "$status" == "healthy" ]]; then
      echo "Restore drill container health: healthy"
      return 0
    fi
    if ! container_running; then
      return 1
    fi
    sleep 2
  done
  return 1
}

wait_for_template_postgis() {
  local i postgis_ready
  for ((i = 1; i <= 60; i++)); do
    if ! container_running; then
      return 1
    fi
    postgis_ready="$(
      docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d template_postgis -Atqc \
        "SELECT PostGIS_Version();" 2>/dev/null | tr -d '\r' || true
    )"
    if [[ -n "$postgis_ready" ]]; then
      echo "Restore drill template_postgis ready: $postgis_ready"
      return 0
    fi
    sleep 2
  done
  return 1
}

archive_list_extensions() {
  docker run --rm \
    -v "$BACKUP_FILE:$RESTORE_MOUNT:ro" \
    "$DRILL_IMAGE" \
    pg_restore --list "$RESTORE_MOUNT" 2>/dev/null \
    | awk '$4 == "EXTENSION" && $5 == "-" { print $6 }' \
    | sort -u
}

create_isolated_stack() {
  log_state "CREATED"
  docker network create "$DRILL_NETWORK" >/dev/null
  docker volume create "$DRILL_VOLUME" >/dev/null

  local image_digest pg_version
  image_digest="$(docker image inspect --format='{{index .RepoDigests 0}}' "$DRILL_IMAGE" 2>/dev/null || echo "unknown")"
  echo "Restore drill image: $DRILL_IMAGE ($image_digest)"

  log_state "STARTING"
  docker run -d \
    --name "$DRILL_CONTAINER" \
    --network "$DRILL_NETWORK" \
    --memory="${DRILL_MEMORY:-768m}" \
    --memory-swap="${DRILL_MEMORY_SWAP:-768m}" \
    -v "$DRILL_VOLUME:/var/lib/postgresql/data" \
    -v "$BACKUP_FILE:$RESTORE_MOUNT:ro" \
    -e POSTGRES_USER="$DRILL_USER" \
    -e POSTGRES_PASSWORD="$DRILL_PASSWORD" \
    -e POSTGRES_DB="$MAINT_DB" \
    --health-cmd="pg_isready -U ${DRILL_USER} -d ${MAINT_DB} || exit 1" \
    --health-interval=5s \
    --health-retries=12 \
    --health-start-period=45s \
    --health-timeout=5s \
    "$DRILL_IMAGE" >/dev/null

  if ! wait_for_container_healthy; then
    die "BACKUP-010: Restore drill container did not become healthy." 1
  fi
  if ! wait_for_pg_ready "$MAINT_DB" 15; then
    die "BACKUP-010: Restore drill PostgreSQL did not accept connections on $MAINT_DB." 1
  fi
  log_state "ACCEPTING CONNECTIONS"

  pg_version="$(docker exec "$DRILL_CONTAINER" postgres --version 2>/dev/null | tr -d '\r' || echo "unknown")"
  echo "Restore drill PostgreSQL: $pg_version"
}

create_drill_database() {
  log_state "DATABASE CREATED"
  docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$MAINT_DB" -v ON_ERROR_STOP=1 -c \
    "CREATE DATABASE \"${DRILL_DB}\" OWNER \"${DRILL_USER}\";" >/dev/null
  if ! wait_for_pg_ready "$DRILL_DB" 15; then
    die "BACKUP-010: Restore drill database $DRILL_DB is not accepting connections." 1
  fi
}

prepare_extensions() {
  log_state "EXTENSIONS READY"
  local ext
  docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -v ON_ERROR_STOP=1 -c \
    "CREATE EXTENSION IF NOT EXISTS postgis CASCADE; CREATE EXTENSION IF NOT EXISTS postgis_topology;" >/dev/null
  while IFS= read -r ext; do
    [[ -z "$ext" ]] && continue
    case "$ext" in
      postgis | postgis_topology | postgis_tiger_geocoder)
        continue
        ;;
    esac
    echo "Restore drill: ensuring extension $ext"
    docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -v ON_ERROR_STOP=1 -c \
      "CREATE EXTENSION IF NOT EXISTS \"${ext}\";" >/dev/null
  done < <(archive_list_extensions)

  local postgis_check extension_check
  extension_check="$(
    docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc \
      "SELECT count(*) FROM pg_extension WHERE extname IN ('postgis', 'postgis_topology');" 2>/dev/null \
      | tr -d '\r' || echo "0"
  )"
  postgis_check="$(
    docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc \
      "SELECT PostGIS_Version();" 2>/dev/null | tr -d '\r' || true
  )"
  if [[ "$extension_check" -lt 1 && -z "$postgis_check" ]]; then
    die "BACKUP-010: PostGIS is not available in drill database after template_postgis creation." 1
  fi
  echo "Restore drill PostGIS (target db): ${postgis_check:-extensions=$extension_check}"
}

verify_archive_in_container() {
  log_state "DUMP COPIED"
  local size_host size_container
  size_host="$(wc -c <"$BACKUP_FILE" | tr -d ' \n\r')"
  size_container="$(docker exec "$DRILL_CONTAINER" stat -c '%s' "$RESTORE_MOUNT" 2>/dev/null | tr -d '\r' || echo 0)"
  if [[ "$size_host" != "$size_container" ]]; then
    die "BACKUP-010: Backup size mismatch inside drill container ($size_host vs $size_container)." 1
  fi
  echo "Restore drill: archive mounted read-only ($size_host bytes)."
}

build_filtered_restore_list() {
  local list_file="$1"
  local filtered_file="$2"
  docker exec "$DRILL_CONTAINER" pg_restore --list "$RESTORE_MOUNT" >"$list_file"
  # Extensions are pre-created; skip EXTENSION entries to avoid duplicate CREATE EXTENSION failures.
  grep -Ev '^;|^$|( EXTENSION - )|(COMMENT - EXTENSION )' "$list_file" >"$filtered_file" || true
  docker cp "$filtered_file" "$DRILL_CONTAINER:/tmp/restore.list" >/dev/null
}

run_pg_restore() {
  log_state "RESTORING"
  local list_file filtered_file
  list_file="$(mktemp "${TMPDIR:-/tmp}/the-eye-restore-list.XXXXXX")"
  filtered_file="$(mktemp "${TMPDIR:-/tmp}/the-eye-restore-filtered.XXXXXX")"
  build_filtered_restore_list "$list_file" "$filtered_file"

  RESTORE_STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  set +e
  timeout "$RESTORE_TIMEOUT_SEC" docker exec "$DRILL_CONTAINER" \
    pg_restore \
    --username="$DRILL_USER" \
    --dbname="$DRILL_DB" \
    --no-owner \
    --no-privileges \
    --exit-on-error \
    --verbose \
    --use-list=/tmp/restore.list \
    "$RESTORE_MOUNT" \
    > /tmp/the-eye-restore-drill.log 2>&1
  RESTORE_EXIT_CODE=$?
  set -e
  RESTORE_FINISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "Restore drill pg_restore exit=$RESTORE_EXIT_CODE started=$RESTORE_STARTED_AT finished=$RESTORE_FINISHED_AT"

  rm -f "$list_file" "$filtered_file"

  if ! container_running; then
    die "BACKUP-010: Restore drill container stopped during pg_restore (exit=$RESTORE_EXIT_CODE)." 1
  fi
  if [[ $RESTORE_EXIT_CODE -ne 0 ]]; then
    die "BACKUP-010: pg_restore failed with exit code $RESTORE_EXIT_CODE." 1
  fi
}

drill_table_exists() {
  local table="$1"
  docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}';" \
    2>/dev/null | tr -d '\r'
}

drill_table_row_count() {
  local table="$1"
  if [[ "$(drill_table_exists "$table")" != "1" ]]; then
    echo "n/a"
    return 0
  fi
  docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc \
    "SELECT count(*) FROM public.\"${table}\";" 2>/dev/null | tr -d '\r' || echo "0"
}

validate_restored_database() {
  log_state "VALIDATING"
  if ! wait_for_pg_ready "$DRILL_DB" 15; then
    die "BACKUP-010: Restore drill database is not accepting connections after restore." 1
  fi

  local postgis_version invalid_geom migration_count schema_count
  postgis_version="$(docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc "SELECT PostGIS_Version();" 2>/dev/null | tr -d '\r' || true)"
  echo "Restore drill PostGIS validation: ${postgis_version:-missing}"
  if [[ -z "$postgis_version" ]]; then
    die "BACKUP-010: PostGIS extension missing after restore." 1
  fi

  invalid_geom="$(
    docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc \
      "SELECT count(*) FROM geometry_columns gc LEFT JOIN spatial_ref_sys srs ON gc.srid = srs.srid WHERE srs.srid IS NULL;" 2>/dev/null \
      | tr -d '\r' || echo "0"
  )"
  echo "Restore drill invalid geometry references: $invalid_geom"

  for table in users incidents incident_location_updates notifications broadcasts audit_logs police_stations; do
    if [[ "$(drill_table_exists "$table")" != "1" ]]; then
      die "BACKUP-010: Restore drill missing critical table: $table" 1
    fi
    echo "Restore drill table present: $table (rows=$(drill_table_row_count "$table"))"
  done

  if [[ "$(drill_table_exists "account_recovery_challenges")" == "1" ]]; then
    echo "Restore drill table present: account_recovery_challenges (rows=$(drill_table_row_count account_recovery_challenges))"
  fi

  migration_count="0"
  if [[ "$(drill_table_exists "_prisma_migrations")" == "1" ]]; then
    migration_count="$(drill_table_row_count "_prisma_migrations")"
  fi
  schema_count="$(
    docker exec "$DRILL_CONTAINER" psql -U "$DRILL_USER" -d "$DRILL_DB" -Atqc \
      "SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name <> 'information_schema';" \
      2>/dev/null | tr -d '\r' || echo "0"
  )"
  echo "Restore drill migration rows: $migration_count"
  echo "Restore drill user schema count: $schema_count"

  print_count_comparison
}

main() {
  parse_args "$@"

  if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
    die "BACKUP-010: Restore drill requires an existing backup file." 1
  fi
  if ! command -v docker >/dev/null 2>&1; then
    die "BACKUP-001: Docker CLI is not available for restore drill." 1
  fi

  resolve_compose_cmd
  resolve_staging_container_id
  assert_restore_target_isolated
  verify_backup_checksum
  collect_source_counts

  echo "Starting isolated restore drill: container=$DRILL_CONTAINER network=$DRILL_NETWORK volume=$DRILL_VOLUME db=$DRILL_DB"
  create_isolated_stack
  create_drill_database
  prepare_extensions
  verify_archive_in_container
  run_pg_restore
  validate_restored_database

  log_state "CLEANUP"
  echo "Restore drill passed: isolated database validated (live database untouched)."
}

main "$@"
