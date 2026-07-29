#!/usr/bin/env bash
# CI/VPS staging deploy invoked over SSH from .github/workflows/deploy.yml.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose -f infra/docker/docker-compose.yml --env-file .env)

patch_livekit_node_ip() {
  local cfg="${REPO_ROOT}/infra/docker/livekit/livekit.yaml"
  local ip="${LIVEKIT_NODE_IP:-}"
  if [[ -z "$ip" ]]; then
    ip="$(curl -sf --max-time 8 https://api.ipify.org 2>/dev/null || curl -sf --max-time 8 https://ifconfig.me/ip 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    echo "WARN: could not resolve LiveKit node_ip — set LIVEKIT_NODE_IP in .env or mobile RTC may fail (LIVE-VIDEO-015)"
    return 0
  fi
  if grep -q '^  node_ip:' "$cfg"; then
    sed -i "s/^  node_ip:.*/  node_ip: ${ip}/" "$cfg"
  else
    sed -i "/^  use_external_ip:/a\\  node_ip: ${ip}" "$cfg"
  fi
  echo "LiveKit rtc.node_ip=${ip}"
}

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
echo "STEP deploy-start proof_only=${PROOF_ONLY}"

if [[ "$PROOF_ONLY" == "true" ]]; then
  echo "=== Proof-only mode (skip redeploy) ==="
  "${COMPOSE[@]}" build api-tools --no-cache api-tools
  bash scripts/staging-livekit-network-guard.sh
  echo "=== Admin container logs (proof-only SSR forensics) ==="
  docker ps --filter "name=the-eye-admin-web" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  docker exec the-eye-admin-web sh -c 'printenv | sort | grep -E "^(NODE_ENV|API_ORIGIN|NEXT_PUBLIC_|JWT_ACCESS_SECRET=)" | sed "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=<set>/"' || true
  curl -fsS --max-time 10 -H "Host: ${THE_EYE_ADMIN_SERVER_NAME:-staging-dashboard8jps.theeye.com.ng}" "http://127.0.0.1/api/auth/login" || true
  echo ""
  docker logs the-eye-admin-web --tail 500 2>&1 || true
else
  echo "STEP compose-ps-start"
  "${COMPOSE[@]}" ps || true
  "${COMPOSE[@]}" pull api admin-web notification-worker || true
  echo "STEP compose-build-start"
  "${COMPOSE[@]}" build api admin-web api-tools --no-cache api-tools
  "${COMPOSE[@]}" --profile tools run --rm api-migrate
  patch_livekit_node_ip
  echo "=== Rendered LiveKit service (compose config) ==="
  "${COMPOSE[@]}" config 2>/dev/null | grep -A 20 '^  livekit:' || true
  echo "=== Recreate LiveKit (host network — restart insufficient) ==="
  "${COMPOSE[@]}" rm -sf livekit
  "${COMPOSE[@]}" up -d --force-recreate livekit
  "${COMPOSE[@]}" up -d --wait livekit
  bash scripts/staging-livekit-network-guard.sh
  "${COMPOSE[@]}" up -d --force-recreate api notification-worker admin-web nginx
  "${COMPOSE[@]}" up -d --wait api admin-web livekit
  bash scripts/reload-nginx-upstreams.sh
  bash scripts/staging-smoke-check.sh
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

echo "=== Staging live video public proof (mobile parity) ==="
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
    echo "FAIL public live-video start ${attempt}/5 gateway http=${HTTP_CODE} clientTraceId=${TRACE_ID}"
    cat "${RESPONSE_FILE}"
    rm -f "${RESPONSE_FILE}"
    exit 1
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

if [[ "$PROOF_ONLY" == "true" || "$RUN_LOCATION_PROOF" == "true" ]]; then
  echo "=== SRB-039 location persistence proof ==="
  "${COMPOSE[@]}" --profile tools run --rm \
    -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:?}" \
    -e STAGING_API_PROBE_BASE_URL=http://api:4000 \
    -e STAGING_LOGIN_PROBE_BASE_URL=http://api:4000 \
    api-tools scripts/staging-location-persistence-proof.ts
fi

"${COMPOSE[@]}" ps
echo "STEP deploy-complete"
