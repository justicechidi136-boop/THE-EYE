#!/usr/bin/env bash
# Shared LiveKit deploy prep — patch rtc.node_ip, recreate with dual-network publish, verify.
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

livekit_attached_networks() {
  docker inspect "$CONTAINER" --format '{{range $name, $cfg := .NetworkSettings.Networks}}{{$name}} {{end}}' 2>/dev/null || true
}

livekit_port_published() {
  local port="$1"
  local proto="$2"
  docker port "$CONTAINER" "${port}/${proto}" 2>/dev/null || true
}

livekit_dual_network_publish_ok() {
  local networks
  networks="$(livekit_attached_networks)"
  if [[ "$networks" != *the-eye-public* ]]; then
    return 1
  fi
  if [[ "$networks" != *the-eye-internal* ]]; then
    return 1
  fi
  if [[ -z "$(livekit_port_published 7880 tcp)" ]]; then
    return 1
  fi
  if [[ -z "$(livekit_port_published 7881 tcp)" ]]; then
    return 1
  fi
  if [[ -z "$(livekit_port_published 7882 udp)" ]]; then
    return 1
  fi
  return 0
}

log_livekit_runtime_state() {
  echo "INFO livekit_networks=$(livekit_attached_networks)"
  echo "INFO livekit_network_mode=$(docker inspect "$CONTAINER" --format '{{.HostConfig.NetworkMode}}' 2>/dev/null || echo unknown)"
  echo "INFO livekit_port_bindings=$(docker inspect "$CONTAINER" --format '{{json .HostConfig.PortBindings}}' 2>/dev/null || echo '{}')"
  echo "INFO livekit_network_ports=$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null || echo '{}')"
  echo "INFO livekit_docker_port_7880=$(livekit_port_published 7880 tcp)"
  echo "INFO livekit_docker_port_7881=$(livekit_port_published 7881 tcp)"
  echo "INFO livekit_docker_port_7882=$(livekit_port_published 7882 udp)"
}

force_recreate_livekit_container() {
  echo "STEP livekit-force-recreate"
  ensure_livekit_node_ip_on_host
  docker rm -f "$CONTAINER" 2>/dev/null || true
  "${COMPOSE[@]}" rm -sf livekit 2>/dev/null || true
  # Ensure compose project networks exist before LiveKit create (both internal + public).
  "${COMPOSE[@]}" up -d --no-start nginx >/dev/null 2>&1 || true
  "${COMPOSE[@]}" up -d --force-recreate --no-deps livekit
  "${COMPOSE[@]}" up -d --wait livekit
}

patch_livekit_node_ip() {
  echo "STEP livekit-patch-start"
  export LIVEKIT_NODE_IP="${LIVEKIT_NODE_IP:-$(resolve_livekit_node_ip)}"
  echo "INFO patching livekit.yaml with LIVEKIT_NODE_IP=${LIVEKIT_NODE_IP}"
  if ! LIVEKIT_NODE_IP="$LIVEKIT_NODE_IP" node "$REPO_ROOT/scripts/lib/patch-livekit-node-ip.cjs"; then
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
}

ensure_livekit_node_ip_on_host() {
  export LIVEKIT_NODE_IP="${LIVEKIT_NODE_IP:-$(resolve_livekit_node_ip)}"
  if grep -qE '^  node_ip:' "$LIVEKIT_CFG" 2>/dev/null; then
    HOST_IP="$(grep -E '^  node_ip:' "$LIVEKIT_CFG" | awk '{print $2}' | tail -n1)"
    if [[ -n "$HOST_IP" && "$HOST_IP" == "$LIVEKIT_NODE_IP" ]]; then
      echo "PASS DEP-LIVEKIT-001: host livekit.yaml node_ip=${HOST_IP} (already patched)"
      return 0
    fi
    echo "WARN host livekit.yaml node_ip=${HOST_IP:-<empty>} != LIVEKIT_NODE_IP=${LIVEKIT_NODE_IP} — re-patching"
  else
    echo "WARN host livekit.yaml missing rtc.node_ip — patching before LiveKit recreate"
  fi
  patch_livekit_node_ip
}

verify_livekit_runtime_config() {
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
}

extract_rendered_livekit_networks() {
  "${COMPOSE[@]}" config 2>/dev/null | awk '
    /^  livekit:/ { in_livekit=1; in_networks=0; next }
    in_livekit && /^  [a-zA-Z0-9_-]+:/ { in_livekit=0; in_networks=0; next }
    in_livekit && /^    networks:/ { in_networks=1; next }
    in_livekit && in_networks && /^      - / {
      line=$0
      sub(/^      - /, "", line)
      print line
      next
    }
    in_livekit && in_networks && /^      [a-zA-Z0-9_-]+:/ {
      name=$1
      sub(/:$/, "", name)
      print name
      next
    }
  ' | tr '\n' ' '
}

ensure_livekit_dual_network_publish() {
  local attempt
  local rendered_networks
  echo "STEP livekit-dual-network-publish-start"

  if docker inspect "$CONTAINER" >/dev/null 2>&1 && livekit_dual_network_publish_ok; then
    log_livekit_runtime_state
    echo "PASS DEP-LIVEKIT-002: dual-network host port publish (runtime already healthy)"
    return 0
  fi

  rendered_networks="$(extract_rendered_livekit_networks)"
  echo "INFO rendered_livekit_networks=${rendered_networks:-unknown}"
  if [[ "$rendered_networks" != *the-eye-public* || "$rendered_networks" != *the-eye-internal* ]]; then
    echo "WARN rendered compose livekit networks missing public/internal — continuing because runtime recreate uses compose file on disk"
  fi

  for attempt in 1 2 3; do
    if docker inspect "$CONTAINER" >/dev/null 2>&1 && livekit_dual_network_publish_ok; then
      log_livekit_runtime_state
      echo "PASS DEP-LIVEKIT-002: dual-network host port publish attempt=${attempt}"
      return 0
    fi

    echo "WARN livekit dual-network publish incomplete attempt=${attempt}/3"
    if docker inspect "$CONTAINER" >/dev/null 2>&1; then
      log_livekit_runtime_state
    else
      echo "INFO livekit container missing before recreate attempt=${attempt}"
    fi
    force_recreate_livekit_container
    sleep 2
  done

  log_livekit_runtime_state
  dep_fail "LiveKit missing the-eye-public attachment or host ports after 3 recreates (LIVEKIT-DOCKER-001)"
}

prepare_livekit_node_ip_only() {
  echo "STEP livekit-node-ip-only-start"
  export LIVEKIT_NODE_IP
  LIVEKIT_NODE_IP="$(resolve_livekit_node_ip)"
  echo "INFO LIVEKIT_NODE_IP=${LIVEKIT_NODE_IP}"
  if [[ ! -f "$LIVEKIT_CFG" ]]; then
    dep_fail "livekit config not found: ${LIVEKIT_CFG}"
  fi
  patch_livekit_node_ip
  echo "STEP livekit-node-ip-only-ok"
}

prepare_livekit_deploy() {
  echo "STEP livekit-prepare-start"
  prepare_livekit_node_ip_only
  echo "STEP livekit-recreate-start"
  ensure_livekit_dual_network_publish
  verify_livekit_runtime_config
  echo "STEP livekit-prepare-ok"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  prepare_livekit_deploy
fi
