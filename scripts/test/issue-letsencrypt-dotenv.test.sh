#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_ENV="$(mktemp)"
TMP_CRLF_ENV="$(mktemp)"
TMP_MISSING_ENV="$(mktemp)"
TMP_QUOTED_ENV="$(mktemp)"
TMP_OUTPUT="$(mktemp)"
trap 'rm -f "$TMP_ENV" "$TMP_CRLF_ENV" "$TMP_MISSING_ENV" "$TMP_QUOTED_ENV" "$TMP_OUTPUT"' EXIT

cat > "$TMP_ENV" <<'ENV'
THE_EYE_APP_NAME=THE EYE
CERTBOT_EMAIL=tls@example.test
THE_EYE_ADMIN_SERVER_NAME=
THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
THE_EYE_STORAGE_SERVER_NAME=storage-staging.theeye.com.ng
ENV

output="$(
  ENV_FILE="$TMP_ENV" \
    THE_EYE_LETSENCRYPT_VALIDATE_ENV_ONLY=true \
    bash scripts/issue-letsencrypt.sh 2>&1
)"

if [[ "$output" != "TLS environment validated." ]]; then
  echo "Expected dotenv with spaces to validate without executing values." >&2
  exit 1
fi

if [[ "$output" == *"THE EYE"* || "$output" == *"tls@example.test"* ]]; then
  echo "Validation output exposed dotenv values." >&2
  exit 1
fi

ENV_FILE="$TMP_MISSING_ENV" \
  THE_EYE_LETSENCRYPT_VALIDATE_ENV_ONLY=true \
  CERTBOT_EMAIL=override@example.test \
  THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng \
  THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng \
  THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng \
  bash scripts/issue-letsencrypt.sh >/dev/null

cat > "$TMP_QUOTED_ENV" <<'ENV'
THE_EYE_APP_NAME="THE EYE"
CERTBOT_EMAIL='tls@example.test'
THE_EYE_ADMIN_SERVER_NAME='staging-dashboard8jps.theeye.com.ng'
THE_EYE_API_SERVER_NAME="staging-api.theeye.com.ng"
THE_EYE_LIVEKIT_SERVER_NAME='staging-livekit.theeye.com.ng'
THE_EYE_STORAGE_SERVER_NAME="storage-staging.theeye.com.ng"
ENV

ENV_FILE="$TMP_QUOTED_ENV" \
  THE_EYE_LETSENCRYPT_VALIDATE_ENV_ONLY=true \
  bash scripts/issue-letsencrypt.sh >/dev/null

printf '%s\r\n' \
  'THE_EYE_APP_NAME=THE EYE' \
  'CERTBOT_EMAIL=tls@example.test' \
  'THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng' \
  'THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng' \
  'THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng' \
  'THE_EYE_STORAGE_SERVER_NAME=storage-staging.theeye.com.ng' > "$TMP_CRLF_ENV"

ENV_FILE="$TMP_CRLF_ENV" \
  THE_EYE_LETSENCRYPT_VALIDATE_ENV_ONLY=true \
  bash scripts/issue-letsencrypt.sh >/dev/null

cat > "$TMP_MISSING_ENV" <<'ENV'
THE_EYE_APP_NAME=THE EYE
CERTBOT_EMAIL=tls@example.test
THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
ENV

if ENV_FILE="$TMP_MISSING_ENV" \
  THE_EYE_LETSENCRYPT_VALIDATE_ENV_ONLY=true \
  bash scripts/issue-letsencrypt.sh >"$TMP_OUTPUT" 2>&1; then
  echo "Expected missing required TLS key to fail closed." >&2
  exit 1
fi

if ! grep -Fq "THE_EYE_API_SERVER_NAME" "$TMP_OUTPUT"; then
  echo "Expected missing required key name in failure output." >&2
  exit 1
fi

if grep -Fq "THE EYE" "$TMP_OUTPUT" || grep -Fq "tls@example.test" "$TMP_OUTPUT"; then
  echo "Missing-key failure exposed dotenv values." >&2
  exit 1
fi

echo "issue-letsencrypt dotenv test passed."
