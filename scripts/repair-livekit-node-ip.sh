#!/usr/bin/env bash
# Patch rtc.node_ip into livekit.yaml and recreate LiveKit so the mount picks it up.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/prepare-livekit-deploy.sh"

COMPOSE=(docker compose -f infra/docker/docker-compose.yml --env-file .env)
CONTAINER="${LIVEKIT_CONTAINER_NAME:-the-eye-livekit}"

echo "=== LiveKit node_ip repair ==="
prepare_livekit_node_ip_only
ensure_livekit_node_ip_on_host
docker rm -f "$CONTAINER" 2>/dev/null || true
"${COMPOSE[@]}" rm -sf livekit 2>/dev/null || true
"${COMPOSE[@]}" up -d --force-recreate --no-deps livekit
"${COMPOSE[@]}" up -d --wait livekit
verify_livekit_runtime_config
bash "$REPO_ROOT/scripts/staging-livekit-network-guard.sh"
echo "=== LiveKit node_ip repair complete ==="
