#!/usr/bin/env bash
# CI/VPS staging deploy invoked over SSH from .github/workflows/deploy.yml.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE=(docker compose -f infra/docker/docker-compose.yml --env-file .env)

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
else
  echo "STEP compose-ps-start"
  "${COMPOSE[@]}" ps || true
  "${COMPOSE[@]}" pull api admin-web notification-worker || true
  echo "STEP compose-build-start"
  "${COMPOSE[@]}" build api admin-web api-tools --no-cache api-tools
  "${COMPOSE[@]}" --profile tools run --rm api-migrate
  "${COMPOSE[@]}" up -d --force-recreate api notification-worker admin-web
  "${COMPOSE[@]}" up -d --wait api admin-web livekit
  bash scripts/reload-nginx-upstreams.sh
  bash scripts/staging-smoke-check.sh
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
"${COMPOSE[@]}" --profile tools run --rm --network host \
  -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:?}" \
  api-tools scripts/staging-live-video-public-proof.ts

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
