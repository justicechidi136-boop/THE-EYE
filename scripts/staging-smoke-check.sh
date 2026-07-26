#!/usr/bin/env bash
set -euo pipefail

# Public-facing staging smoke checks with retries. Validates proxied API readiness,
# not nginx static /healthz alone.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/safe-env.sh"

API_HOST="$(read_env_var THE_EYE_API_SERVER_NAME staging-api.theeye.com.ng)"
ADMIN_HOST="$(read_env_var THE_EYE_ADMIN_SERVER_NAME staging-dashboard8jps.theeye.com.ng)"
LIVEKIT_HOST="$(read_env_var THE_EYE_LIVEKIT_SERVER_NAME staging-livekit.theeye.com.ng)"

MAX_ATTEMPTS="${STAGING_SMOKE_ATTEMPTS:-12}"
SLEEP_SECONDS="${STAGING_SMOKE_INTERVAL_SECONDS:-5}"

curl_retry() {
  local label="$1"
  shift
  local attempt=1
  while (( attempt <= MAX_ATTEMPTS )); do
    if "$@"; then
      echo "PASS ${label} (attempt ${attempt}/${MAX_ATTEMPTS})"
      return 0
    fi
    if (( attempt == MAX_ATTEMPTS )); then
      echo "FAIL ${label} after ${MAX_ATTEMPTS} attempts" >&2
      return 1
    fi
    echo "WAIT ${label} (attempt ${attempt}/${MAX_ATTEMPTS}) ..."
    sleep "$SLEEP_SECONDS"
    attempt=$((attempt + 1))
  done
}

check_local_api_ready() {
  curl -fsSk --max-time 10 \
    -H "Host: ${API_HOST}" \
    "https://127.0.0.1/v1/health/ready" >/dev/null 2>&1 || \
  curl -fsS --max-time 10 \
    -H "Host: ${API_HOST}" \
    "http://127.0.0.1/v1/health/ready" >/dev/null
}

check_local_admin() {
  curl -fsSk --max-time 10 \
    -H "Host: ${ADMIN_HOST}" \
    "https://127.0.0.1/" >/dev/null 2>&1 || \
  curl -fsS --max-time 10 \
    -H "Host: ${ADMIN_HOST}" \
    "http://127.0.0.1/" >/dev/null
}

check_local_livekit() {
  curl -fsSk --max-time 10 \
    -H "Host: ${LIVEKIT_HOST}" \
    "https://127.0.0.1/" >/dev/null 2>&1 || \
  curl -fsS --max-time 10 \
    -H "Host: ${LIVEKIT_HOST}" \
    "http://127.0.0.1/" >/dev/null
}

echo "=== Staging smoke checks (Host-aware via nginx) ==="
curl_retry "nginx static healthz" curl -fsS --max-time 5 "http://127.0.0.1/healthz" >/dev/null
curl_retry "proxied API /v1/health/ready" check_local_api_ready
curl_retry "proxied Admin dashboard" check_local_admin
curl_retry "proxied LiveKit endpoint" check_local_livekit
echo "=== Staging smoke checks passed ==="
