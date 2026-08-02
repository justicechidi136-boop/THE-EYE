#!/usr/bin/env bash
# Shared LiveKit deploy prep — patch rtc.node_ip, verify, recreate container.
# Runs before network guard in both full deploy and PROOF_ONLY modes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/safe-env.sh"

COMPOSE=(docker compose -f infra/docker/docker-compose.yml --env-file .env)
LIVEKIT_CFG="${REPO_ROOT}/infra/docker/livekit/livekit.yaml"
CONTAINER="${LIVEKIT_CONTAINER_NAME:-the-eye-livekit}"

dep_fail() {
  echo "FAIL DEP-LIVEKIT-001: $1"
  exit 1
}

resolve_livekit_node_ip() {
  local ip
  ip="$(read_env_var LIVEKIT_NODE_IP)"
  if [[ -z "$ip" ]]; then
    ip="$(curl -sf --max-time 8 https://api.ipify.org 2>/dev/null || curl -sf --max-time 8 https://ifconfig.me/ip 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    dep_fail "LIVEKIT_NODE_IP is required (set in .env or ensure public IP auto-detect works)"
  fi
  printf '%s' "$ip"
}

prepare_livekit_deploy() {
  echo "STEP livekit-prepare-start"

  export LIVEKIT_NODE_IP
  LIVEKIT_NODE_IP="$(resolve_livekit_node_ip)"
  echo "INFO LIVEKIT_NODE_IP=${LIVEKIT_NODE_IP}"

  if [[ ! -f "$LIVEKIT_CFG" ]]; then
    dep_fail "livekit config not found: ${LIVEKIT_CFG}"
  fi

  echo "STEP livekit-patch-start"
  if ! node "$REPO_ROOT/scripts/lib/patch-livekit-node-ip.cjs"; then
    dep_fail "rtc.node_ip missing after patch"
  fi

  if ! grep -qE '^  node_ip:' "$LIVEKIT_CFG"; then
    dep_fail "rtc.node_ip missing after patch (grep host config)"
  fi

  PATCHED_IP="$(grep -E '^  node_ip:' "$LIVEKIT_CFG" | awk '{print $2}' | tail -n1)"
  if [[ -z "$PATCHED_IP" ]]; then
    dep_fail "rtc.node_ip empty after patch"
  fi
  if [[ "$PATCHED_IP" != "$LIVEKIT_NODE_IP" ]]; then
    dep_fail "patched node_ip ${PATCHED_IP} != LIVEKIT_NODE_IP ${LIVEKIT_NODE_IP}"
  fi
  echo "PASS DEP-LIVEKIT-001: host livekit.yaml node_ip=${PATCHED_IP}"

  echo "STEP livekit-recreate-start"
  "${COMPOSE[@]}" rm -sf livekit
  "${COMPOSE[@]}" up -d --force-recreate livekit
  "${COMPOSE[@]}" up -d --wait livekit

  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    dep_fail "LiveKit container ${CONTAINER} not running after recreate"
  fi

  if ! docker exec "$CONTAINER" grep -qE '^  node_ip:' /etc/livekit/livekit.yaml 2>/dev/null; then
    dep_fail "rtc.node_ip missing in runtime config /etc/livekit/livekit.yaml"
  fi

  RUNTIME_IP="$(docker exec "$CONTAINER" sh -c "grep -E '^  node_ip:' /etc/livekit/livekit.yaml | awk '{print \$2}' | tail -n1" 2>/dev/null || true)"
  if [[ -z "$RUNTIME_IP" ]]; then
    dep_fail "rtc.node_ip empty in runtime config"
  fi
  if [[ "$RUNTIME_IP" != "$LIVEKIT_NODE_IP" ]]; then
    dep_fail "runtime node_ip ${RUNTIME_IP} != LIVEKIT_NODE_IP ${LIVEKIT_NODE_IP}"
  fi
  echo "PASS DEP-LIVEKIT-001: runtime livekit.yaml node_ip=${RUNTIME_IP}"

  echo "STEP livekit-prepare-ok"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  prepare_livekit_deploy
fi
