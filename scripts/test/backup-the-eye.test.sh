#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOCK_DOCKER="$ROOT/scripts/test/fixtures/mock-docker"
BACKUP_SCRIPT="$ROOT/scripts/backup-the-eye.sh"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/the-eye-backup-test.XXXXXX")"
COMPOSE_FILE="$TEST_DIR/docker-compose.yml"
ENV_FILE="$TEST_DIR/.env"
BACKUP_DIR="$TEST_DIR/backups"
LOG="$TEST_DIR/mock.log"

pass=0
fail=0

teardown() {
  rm -rf "$TEST_DIR"
}
trap teardown EXIT

setup_base() {
  mkdir -p "$BACKUP_DIR"
  cat >"$COMPOSE_FILE" <<'EOF'
name: the-eye
services:
  postgres-postgis:
    image: postgis/postgis:16-3.4
EOF
  cat >"$ENV_FILE" <<'EOF'
POSTGRES_DB=the_eye
POSTGRES_USER=the_eye
POSTGRES_PASSWORD=change_me_postgres
THE_EYE_APP_ENV=staging
EOF
  export MOCK_DOCKER_LOG="$LOG"
  : >"$LOG"
  export THE_EYE_BACKUP_MOCK_DOCKER="$MOCK_DOCKER"
  unset THE_EYE_BACKUP_COMPOSE_BIN THE_EYE_BACKUP_DOCKER_BIN || true
  unset MOCK_DB_STOPPED MOCK_COMPOSE_MISSING_DB MOCK_PG_DUMP_FAIL MOCK_ARCHIVE_INVALID MOCK_DB_UNHEALTHY || true
  export MOCK_DB_STOPPED=0
  export MOCK_COMPOSE_MISSING_DB=0
  export MOCK_PG_DUMP_FAIL=0
  export MOCK_ARCHIVE_INVALID=0
  export MOCK_DB_UNHEALTHY=0
  unset BACKUP_RETENTION_COUNT BACKUP_RETENTION_DAYS || true
}

run_backup() {
  # shellcheck disable=SC2086
  bash "$BACKUP_SCRIPT" \
    --compose-file "$COMPOSE_FILE" \
    --env-file "$ENV_FILE" \
    --output-dir "$BACKUP_DIR" \
    "$@" 2>"$TEST_DIR/stderr.txt" >"$TEST_DIR/stdout.txt" || return $?
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq -- "$needle" "$haystack" 2>/dev/null; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label (missing: $needle)" >&2
    echo "  stdout: $(tr '\n' ' ' <"${haystack%/stderr.txt}/stdout.txt" 2>/dev/null || true)" >&2
    echo "  stderr: $(tr '\n' ' ' <"$haystack" 2>/dev/null || true)" >&2
    fail=$((fail + 1))
  fi
}

assert_error_code() {
  local code="$1"
  local label="$2"
  if grep -Fq -- "$code" "$TEST_DIR/stderr.txt" "$TEST_DIR/stdout.txt" 2>/dev/null; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label (missing: $code)" >&2
    echo "  stdout: $(tr '\n' ' ' <"$TEST_DIR/stdout.txt" 2>/dev/null || true)" >&2
    echo "  stderr: $(tr '\n' ' ' <"$TEST_DIR/stderr.txt" 2>/dev/null || true)" >&2
    fail=$((fail + 1))
  fi
}

assert_exit_code() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" -eq "$expected" ]]; then
    echo "PASS: $label"
    pass=$((pass + 1))
  else
    echo "FAIL: $label (expected exit $expected, got $actual)" >&2
    fail=$((fail + 1))
  fi
}

test_compose_file_missing() {
  setup_base
  local rc=0
  bash "$BACKUP_SCRIPT" --compose-file "$TEST_DIR/missing.yml" --env-file "$ENV_FILE" --output-dir "$BACKUP_DIR" \
    >"$TEST_DIR/stdout.txt" 2>"$TEST_DIR/stderr.txt" || rc=$?
  assert_exit_code 1 "$rc" "compose file missing exits 1"
  assert_contains "$TEST_DIR/stderr.txt" "BACKUP-003" "compose file missing error code"
}

test_env_file_missing() {
  setup_base
  local rc=0
  bash "$BACKUP_SCRIPT" --compose-file "$COMPOSE_FILE" --env-file "$TEST_DIR/missing.env" --output-dir "$BACKUP_DIR" \
    >"$TEST_DIR/stdout.txt" 2>"$TEST_DIR/stderr.txt" || rc=$?
  assert_exit_code 1 "$rc" "env file missing exits 1"
  assert_contains "$TEST_DIR/stderr.txt" "BACKUP-004" "env file missing error code"
}

test_db_service_missing() {
  setup_base
  export MOCK_COMPOSE_MISSING_DB=1
  local rc=0
  run_backup || rc=$?
  assert_exit_code 1 "$rc" "db service missing exits 1"
  assert_error_code "BACKUP-005" "db service missing error code"
}

test_db_stopped() {
  setup_base
  export MOCK_DB_STOPPED=1
  local rc=0
  run_backup || rc=$?
  assert_exit_code 1 "$rc" "db stopped exits 1"
  assert_error_code "BACKUP-006" "db stopped error code"
}

test_successful_backup() {
  setup_base
  local rc=0
  run_backup || rc=$?
  assert_exit_code 0 "$rc" "successful backup exits 0"
  assert_contains "$LOG" "--env-file $ENV_FILE" "compose uses env file in ps"
  assert_contains "$LOG" "--env-file $ENV_FILE" "compose uses env file in exec"
  local dump_count
  dump_count="$(find "$BACKUP_DIR" -maxdepth 1 -name 'the-eye-staging-*.dump' | wc -l | tr -d ' ')"
  if [[ "$dump_count" -ge 1 ]]; then
    echo "PASS: backup file created"
    pass=$((pass + 1))
  else
    echo "FAIL: backup file not created" >&2
    fail=$((fail + 1))
  fi
}

test_paths_with_spaces() {
  setup_base
  local spaced_dir="$TEST_DIR/with spaces/backups"
  mkdir -p "$spaced_dir"
  local rc=0
  bash "$BACKUP_SCRIPT" --compose-file "$COMPOSE_FILE" --env-file "$ENV_FILE" --output-dir "$spaced_dir" \
    >"$TEST_DIR/stdout.txt" 2>"$TEST_DIR/stderr.txt" || rc=$?
  assert_exit_code 0 "$rc" "paths with spaces succeed"
}

test_pg_dump_failure() {
  setup_base
  export MOCK_PG_DUMP_FAIL=1
  local rc=0
  run_backup || rc=$?
  assert_exit_code 1 "$rc" "pg_dump failure exits 1"
  assert_error_code "BACKUP-008" "pg_dump failure error code"
}

test_archive_validation_failure() {
  setup_base
  export MOCK_ARCHIVE_INVALID=1
  local rc=0
  run_backup || rc=$?
  assert_exit_code 1 "$rc" "archive validation failure exits 1"
  assert_error_code "BACKUP-010" "archive validation error code"
}

test_no_secret_output() {
  setup_base
  run_backup || true
  if grep -Fq -- "change_me_postgres" "$TEST_DIR/stdout.txt" "$TEST_DIR/stderr.txt" "$LOG" 2>/dev/null; then
    echo "FAIL: secret leaked to output/logs" >&2
    fail=$((fail + 1))
  else
    echo "PASS: no secret output"
    pass=$((pass + 1))
  fi
}

test_checksum_and_metadata() {
  setup_base
  run_backup || true
  if grep -Eq 'SHA-256: [a-f0-9]{64}' "$TEST_DIR/stdout.txt"; then
    echo "PASS: checksum printed"
    pass=$((pass + 1))
  else
    echo "FAIL: checksum missing from output" >&2
    fail=$((fail + 1))
  fi
  local meta_count
  meta_count="$(find "$BACKUP_DIR" -maxdepth 1 -name 'the-eye-staging-*.json' | wc -l | tr -d ' ')"
  if [[ "$meta_count" -ge 1 ]]; then
    echo "PASS: metadata manifest created"
    pass=$((pass + 1))
  else
    echo "FAIL: metadata manifest missing" >&2
    fail=$((fail + 1))
  fi
}

test_retention_after_success() {
  setup_base
  touch "$BACKUP_DIR/the-eye-staging-19990101T000000Z.dump"
  touch "$BACKUP_DIR/the-eye-staging-19990101T000000Z.json"
  export BACKUP_RETENTION_COUNT=1
  run_backup || true
  if [[ ! -f "$BACKUP_DIR/the-eye-staging-19990101T000000Z.dump" ]]; then
    echo "PASS: retention removed older backup after success"
    pass=$((pass + 1))
  else
    echo "FAIL: retention did not remove older backup" >&2
    fail=$((fail + 1))
  fi
}

test_partial_cleanup_on_failure() {
  setup_base
  export MOCK_PG_DUMP_FAIL=1
  run_backup || true
  local partial_count
  partial_count="$(find "$BACKUP_DIR" -maxdepth 1 -name '.the-eye-staging-*.dump' -o -name '.*.dump' 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$partial_count" == "0" ]]; then
    echo "PASS: partial backup cleaned up on failure"
    pass=$((pass + 1))
  else
    echo "FAIL: partial backup file left behind" >&2
    fail=$((fail + 1))
  fi
}

test_restore_drill_script_hardened() {
  local drill="$ROOT/scripts/backup-restore-drill.sh"
  local needle
  for needle in \
    "assert_restore_target_isolated" \
    "Restore drill refused" \
    'POSTGRES_DB="$MAINT_DB"' \
    "pg_isready" \
    "capture_diagnostics" \
    "CREATE EXTENSION IF NOT EXISTS" \
    "TEMPLATE template_postgis" \
    "wait_for_template_postgis"; do
    if grep -Fq "$needle" "$drill"; then
      echo "PASS: restore drill contains $needle"
      pass=$((pass + 1))
    else
      echo "FAIL: restore drill missing $needle" >&2
      fail=$((fail + 1))
    fi
  done
  if grep -F -- '--exit-on-error' "$drill" >/dev/null; then
    echo "PASS: restore drill contains --exit-on-error"
    pass=$((pass + 1))
  else
    echo "FAIL: restore drill missing --exit-on-error" >&2
    fail=$((fail + 1))
  fi
}

test_staging_runner_modes() {
  local runner="$ROOT/scripts/run-staging-backup.sh"
  if grep -Fq 'WITH_RESTORE_DRILL="${2:-false}"' "$runner"; then
    echo "PASS: staging runner parses restore drill boolean"
    pass=$((pass + 1))
  else
    echo "FAIL: staging runner missing restore drill argument parsing" >&2
    fail=$((fail + 1))
  fi
  if grep -Fq 'if [[ "$WITH_RESTORE_DRILL" == "true" ]]; then' "$runner"; then
    echo "PASS: staging runner gates restore drill flag"
    pass=$((pass + 1))
  else
    echo "FAIL: staging runner missing restore drill gate" >&2
    fail=$((fail + 1))
  fi
  if grep -Fq 'args+=(--with-restore-drill)' "$runner"; then
    echo "PASS: staging runner adds restore drill flag only in true branch"
    pass=$((pass + 1))
  else
    echo "FAIL: staging runner missing conditional restore drill flag" >&2
    fail=$((fail + 1))
  fi
  if grep -Fq 'restore_drill=$WITH_RESTORE_DRILL' "$runner"; then
    echo "PASS: staging runner logs restore drill mode"
    pass=$((pass + 1))
  else
    echo "FAIL: staging runner missing restore drill mode logging" >&2
    fail=$((fail + 1))
  fi
}

test_with_restore_drill_flag() {
  setup_base
  export THE_EYE_BACKUP_SKIP_DRILL_INVOKE=1
  local rc=0
  run_backup --with-restore-drill || rc=$?
  assert_exit_code 0 "$rc" "with-restore-drill flag accepted by backup script"
}

test_compose_file_missing
test_env_file_missing
test_db_service_missing
test_db_stopped
test_successful_backup
test_paths_with_spaces
test_pg_dump_failure
test_archive_validation_failure
test_no_secret_output
test_checksum_and_metadata
test_retention_after_success
test_partial_cleanup_on_failure
test_restore_drill_script_hardened
test_staging_runner_modes
test_with_restore_drill_flag

echo "Tests passed: $pass"
echo "Tests failed: $fail"
if [[ $fail -gt 0 ]]; then
  exit 1
fi
