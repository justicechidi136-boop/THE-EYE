#!/usr/bin/env bash
# CI/VPS staging deploy invoked over SSH from .github/workflows/deploy.yml.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose -f infra/docker/docker-compose.yml --env-file .env)

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/prepare-livekit-deploy.sh"
# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/staging-release-validation.sh"

echo "STEP env-check-start"
if [[ ! -f .env ]]; then
  if [[ -f ../.env ]]; then
    echo "STEP env-using-parent"
    ln -sf ../.env .env
  else
    echo "STEP env-check-fail"
    exit 1
  fi
fi
echo "STEP env-check-ok"

PROOF_ONLY="${PROOF_ONLY:-false}"
RUN_LOCATION_PROOF="${RUN_LOCATION_PROOF:-false}"
INSPECT_FAILED_LOCATION_RETRIES="${INSPECT_FAILED_LOCATION_RETRIES:-false}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
RUN_STORAGE_PROOF="${RUN_STORAGE_PROOF:-false}"
LIVEKIT_ICE_CAPTURE_SECONDS="${LIVEKIT_ICE_CAPTURE_SECONDS:-0}"
echo "STEP deploy-start proof_only=${PROOF_ONLY}"
echo "STEP location-retry-diagnostics=${INSPECT_FAILED_LOCATION_RETRIES}"
echo "STEP migration-mode run_migrations=${RUN_MIGRATIONS}"
echo "STEP storage-proof-mode run_storage_proof=${RUN_STORAGE_PROOF}"
echo "STEP livekit-ice-capture-seconds=${LIVEKIT_ICE_CAPTURE_SECONDS}"

if [[ "$PROOF_ONLY" == "true" ]]; then
  echo "=== Proof-only mode (skip full redeploy) ==="
  if [[ "$INSPECT_FAILED_LOCATION_RETRIES" == "true" ]]; then
    echo "Skipping tools image build for read-only queue diagnostics"
  else
    "${COMPOSE[@]}" build api-tools --no-cache api-tools
  fi
else
  echo "STEP compose-ps-start"
  "${COMPOSE[@]}" ps || true
  echo "STEP docker-disk-before"
  docker system df || true
  echo "STEP build-cache-prune-start"
  docker builder prune --all --force --filter "until=1h"
  docker image prune --force --filter "until=24h"
  echo "STEP build-cache-prune-complete"
  df -h / || true
  "${COMPOSE[@]}" pull api admin-web notification-worker || true
  echo "STEP compose-build-start"
  "${COMPOSE[@]}" build api admin-web api-tools --no-cache api-tools
  if [[ "$RUN_MIGRATIONS" == "true" ]]; then
    echo "STEP migrations-start"
    "${COMPOSE[@]}" --profile tools run --rm api-migrate
    echo "STEP migrations-complete"
  else
    echo "Skipping staging migrations (RUN_MIGRATIONS=${RUN_MIGRATIONS})"
  fi
  echo "=== Rendered LiveKit service (compose config) ==="
  "${COMPOSE[@]}" config 2>/dev/null | grep -A 20 '^  livekit:' || true
fi

# Patch rtc.node_ip first; LiveKit recreate with dual-network publish runs after api/admin
# (and before nginx) so both compose networks exist on the host.
prepare_livekit_node_ip_only

if [[ "$PROOF_ONLY" == "true" ]]; then
  ensure_livekit_single_network_publish
  verify_livekit_runtime_config
  echo "=== Admin container logs (proof-only SSR forensics) ==="
  docker ps --filter "name=the-eye-admin-web" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  docker exec the-eye-admin-web sh -c 'printenv | sort | grep -E "^(NODE_ENV|API_ORIGIN|NEXT_PUBLIC_|JWT_ACCESS_SECRET=)" | sed "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=<set>/"' || true
  curl -fsS --max-time 10 -H "Host: ${THE_EYE_ADMIN_SERVER_NAME:-staging-dashboard8jps.theeye.com.ng}" "http://127.0.0.1/api/auth/login" || true
  echo ""
  docker logs the-eye-admin-web --tail 500 2>&1 || true
else
  "${COMPOSE[@]}" up -d --force-recreate api notification-worker admin-web
  "${COMPOSE[@]}" up -d --wait api admin-web
  # LiveKit reads rtc.node_ip only at process start. A healthy old container can
  # otherwise keep stale ICE/NAT configuration after the mounted YAML is patched.
  force_recreate_livekit_container
  ensure_livekit_single_network_publish
  verify_livekit_runtime_config
  "${COMPOSE[@]}" up -d --force-recreate nginx
  "${COMPOSE[@]}" up -d --wait nginx livekit
  bash scripts/reload-nginx-upstreams.sh
  echo "=== Admin container logs (SSR forensics) ==="
  docker logs the-eye-admin-web --tail 300 2>&1 || true
  echo "=== Prisma runtime forensics (API container) ==="
  "${COMPOSE[@]}" exec -T api node scripts/prisma-runtime-forensics.cjs
  echo "=== Staging seed (first run) ==="
  "${COMPOSE[@]}" --profile tools run --rm api-tools prisma/seed-staging-test-accounts.ts
  echo "=== Staging certification data verify ==="
  "${COMPOSE[@]}" --profile tools run --rm api-tools scripts/verify-staging-certification-data.ts
  echo "=== Staging seed (idempotency second run) ==="
  "${COMPOSE[@]}" --profile tools run --rm api-tools prisma/seed-staging-test-accounts.ts
  echo "=== Staging login verification ==="
  "${COMPOSE[@]}" --profile tools run --rm \
    -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:?}" \
    -e STAGING_LOGIN_PROBE_BASE_URL=http://api:4000 \
    api-tools scripts/verify-staging-test-accounts.ts
fi

# Release gate: compose ps, runtime yaml, network guard, smoke, health — before proofs.
staging_release_validation

if [[ "$LIVEKIT_ICE_CAPTURE_SECONDS" != "0" ]]; then
  if [[ "$PROOF_ONLY" != "true" ]]; then
    echo "FAIL LIVEKIT-ICE-EXT-001: packet capture is permitted only in proof-only mode"
    exit 1
  fi
  LIVEKIT_ICE_CAPTURE_SECONDS="$LIVEKIT_ICE_CAPTURE_SECONDS" \
    bash scripts/staging-livekit-ice-capture.sh
fi

if [[ "$RUN_STORAGE_PROOF" == "true" ]]; then
  echo "=== Staging Firebase Storage runtime proof ==="
  "${COMPOSE[@]}" exec -T \
    -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:?}" \
    -e STORAGE_PROVIDER="${STORAGE_PROVIDER:?}" \
    -e FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:?}" \
    -e THE_EYE_APP_ENV="${THE_EYE_APP_ENV:?}" \
    -e FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:?}" \
    api \
    node scripts/staging-storage-smoke.cjs
else
  echo "SKIP storage proof (RUN_STORAGE_PROOF=${RUN_STORAGE_PROOF})"
fi

echo "=== Staging live video public proof (mobile parity) ==="
if [[ "${SKIP_LIVE_VIDEO_PROOF:-false}" == "true" ]]; then
  echo "SKIP live video proof (SKIP_LIVE_VIDEO_PROOF=true)"
else
curl -fsS "${NEXT_PUBLIC_API_BASE_URL:?}/health/ready" | head -c 4000 || true
echo ""
"${COMPOSE[@]}" exec -T api node scripts/diagnose-prisma-location-model.cjs
PROOF_EXPORT_LINES="$("${COMPOSE[@]}" --profile tools run --rm \
  -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:?}" \
  -e STAGING_API_PROBE_BASE_URL=http://api:4000 \
  -e STAGING_LIVE_VIDEO_PROOF_EXPORT=stdout \
  api-tools scripts/staging-live-video-public-proof.ts | awk '/^PROOF_/')"
eval "${PROOF_EXPORT_LINES}"
EXPECTED_LIVEKIT_URL="wss://staging-livekit.theeye.com.ng"
PUBLIC_OK=0
GATEWAY_RETRY_SLEEP="${STAGING_LIVE_VIDEO_GATEWAY_RETRY_SECONDS:-10}"
for attempt in 1 2 3 4 5; do
  TRACE_ID="live-video-proof-${attempt}-$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)"
  STARTED_AT="$(date +%s%3N)"
  RESPONSE_FILE="$(mktemp)"
  HTTP_CODE="$(
    curl -sS -o "${RESPONSE_FILE}" -w '%{http_code}' \
      -X POST "${PROOF_PUBLIC_BASE}/live-video/incidents/${PROOF_INCIDENT_ID}/start" \
      -H "Authorization: Bearer ${PROOF_TOKEN}" \
      -H "Content-Type: application/json" \
      -H "X-Client-Trace-ID: ${TRACE_ID}" \
      -H "X-Request-ID: $(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)" \
      --data '{"latitude":6.5244,"longitude":3.3792,"accuracy":12,"lowBandwidthMode":true,"sourceDeviceId":"mobile-primary"}'
  )"
  ENDED_AT="$(date +%s%3N)"
  DURATION_MS="$((ENDED_AT - STARTED_AT))"
  if [[ "${HTTP_CODE}" == "502" || "${HTTP_CODE}" == "503" ]]; then
    echo "WARN public live-video start ${attempt}/5 gateway http=${HTTP_CODE} clientTraceId=${TRACE_ID}"
    cat "${RESPONSE_FILE}" || true
    rm -f "${RESPONSE_FILE}"
    if (( attempt == 5 )); then
      echo "FAIL public live-video start gateway http=${HTTP_CODE} after 5 attempts"
      exit 1
    fi
    echo "WAIT public live-video gateway retry ${GATEWAY_RETRY_SLEEP}s ..."
    sleep "$GATEWAY_RETRY_SLEEP"
    continue
  fi
  if [[ "${HTTP_CODE}" != "201" ]]; then
    echo "FAIL public live-video start ${attempt}/5 http=${HTTP_CODE} clientTraceId=${TRACE_ID}"
    cat "${RESPONSE_FILE}"
    rm -f "${RESPONSE_FILE}"
    exit 1
  fi
  LIVEKIT_URL="$(node -e "const b=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));process.stdout.write(String((b.livekit&&b.livekit.url)||''));" "${RESPONSE_FILE}")"
  if [[ "${LIVEKIT_URL}" != "${EXPECTED_LIVEKIT_URL}" ]]; then
    echo "FAIL public live-video start ${attempt}/5 livekit.url=${LIVEKIT_URL} expected ${EXPECTED_LIVEKIT_URL}"
    rm -f "${RESPONSE_FILE}"
    exit 1
  fi
  echo "PASS public live-video start ${attempt}/5 http=${HTTP_CODE} livekitUrl=${LIVEKIT_URL} clientTraceId=${TRACE_ID} durationMs=${DURATION_MS}"
  PUBLIC_OK=$((PUBLIC_OK + 1))
  rm -f "${RESPONSE_FILE}"
done
echo "PASS public stage4 ${PUBLIC_OK}/5 livekitUrl=${EXPECTED_LIVEKIT_URL}"

echo "=== Staging live video room join proof (stage 5) ==="
API_TOOLS_IMAGE="the-eye-api-tools:${THE_EYE_IMAGE_TAG:-local}"
docker run --rm --network host --env-file .env \
  -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:?}" \
  -e PROOF_TOKEN="${PROOF_TOKEN}" \
  -e PROOF_INCIDENT_ID="${PROOF_INCIDENT_ID}" \
  -e LIVEKIT_NODE_IP="${LIVEKIT_NODE_IP:-}" \
  "${API_TOOLS_IMAGE}" \
  npx tsx scripts/staging-live-video-room-join-proof.ts
fi

if [[ "$RUN_LOCATION_PROOF" == "true" || ( "$PROOF_ONLY" == "true" && "$INSPECT_FAILED_LOCATION_RETRIES" != "true" ) ]]; then
  echo "=== SRB-039 location persistence proof ==="
  "${COMPOSE[@]}" --profile tools run --rm \
    -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:?}" \
    -e STAGING_API_PROBE_BASE_URL=http://api:4000 \
    -e STAGING_LOGIN_PROBE_BASE_URL=http://api:4000 \
    api-tools scripts/staging-location-persistence-proof.ts
fi

if [[ "$INSPECT_FAILED_LOCATION_RETRIES" == "true" ]]; then
  if [[ "$PROOF_ONLY" != "true" ]]; then
    echo "FAIL location retry diagnostics require PROOF_ONLY=true"
    exit 1
  fi
  echo "=== Read-only failed location retry diagnostics ==="
  RUNTIME_API_IMAGE="$(docker inspect the-eye-api --format '{{.Config.Image}}')"
  docker run --rm \
    --network container:the-eye-api \
    --env-file .env \
    -e THE_EYE_APP_ENV=staging \
    -e REDIS_HOST=redis \
    -e REDIS_PORT=6379 \
    -v "$REPO_ROOT/apps/api/scripts/staging-location-retry-diagnostics.cjs:/app/scripts/staging-location-retry-diagnostics.cjs:ro" \
    "$RUNTIME_API_IMAGE" node scripts/staging-location-retry-diagnostics.cjs
fi

"${COMPOSE[@]}" ps
echo "STEP deploy-complete"
