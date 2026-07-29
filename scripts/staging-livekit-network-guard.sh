#!/usr/bin/env bash
# Post-deploy guard: LiveKit host-network RTC sockets and config (staging VPS).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/safe-env.sh"

CONTAINER="${LIVEKIT_CONTAINER_NAME:-the-eye-livekit}"
PUBLIC_LIVEKIT_URL="${NEXT_PUBLIC_LIVEKIT_URL:-$(read_env_var NEXT_PUBLIC_LIVEKIT_URL wss://staging-livekit.theeye.com.ng)}"
EXPECTED_NODE_IP="${LIVEKIT_NODE_IP:-}"

fail() {
  echo "FAIL LIVEKIT-NET: $1"
  exit 1
}

warn() {
  echo "WARN LIVEKIT-NET: $1"
}

pass() {
  echo "PASS LIVEKIT-NET: $1"
}

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  fail "container ${CONTAINER} not found"
fi

echo "=== LiveKit network guard ==="

NETWORK_MODE="$(docker inspect "$CONTAINER" --format '{{.HostConfig.NetworkMode}}')"
CONTAINER_ID="$(docker inspect "$CONTAINER" --format '{{.Id}}')"
CONTAINER_IMAGE="$(docker inspect "$CONTAINER" --format '{{.Config.Image}}')"
CREATED="$(docker inspect "$CONTAINER" --format '{{.Created}}')"
CONFIG_FILES="$(docker inspect "$CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}')"
WORKING_DIR="$(docker inspect "$CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')"
SERVICE_NAME="$(docker inspect "$CONTAINER" --format '{{index .Config.Labels "com.docker.compose.service"}}')"

echo "INFO container_id=${CONTAINER_ID}"
echo "INFO image=${CONTAINER_IMAGE}"
echo "INFO created=${CREATED}"
echo "INFO network_mode=${NETWORK_MODE}"
echo "INFO compose_config_files=${CONFIG_FILES:-unknown}"
echo "INFO compose_working_dir=${WORKING_DIR:-unknown}"
echo "INFO compose_service=${SERVICE_NAME:-unknown}"

if [[ "$NETWORK_MODE" != "host" ]]; then
  fail "expected network_mode=host for RTC publication, got ${NETWORK_MODE} (LIVEKIT-DOCKER-001)"
fi
pass "network_mode=host"

PORT_BINDINGS="$(docker inspect "$CONTAINER" --format '{{json .HostConfig.PortBindings}}')"
NETWORK_PORTS="$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}')"
echo "INFO HostConfig.PortBindings=${PORT_BINDINGS}"
echo "INFO NetworkSettings.Ports=${NETWORK_PORTS}"

PUBLISHED="$(docker port "$CONTAINER" 2>/dev/null || true)"
if [[ -n "$PUBLISHED" ]]; then
  warn "host-network LiveKit should not expose docker port mappings: ${PUBLISHED}"
else
  pass "docker port empty (expected for host networking)"
fi

listen_tcp() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :${port}" 2>/dev/null | grep -q LISTEN
    return
  fi
  netstat -ltn 2>/dev/null | grep -q ":${port} "
}

listen_udp() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -lun "sport = :${port}" 2>/dev/null | grep -q ":${port}"
    return
  fi
  netstat -lun 2>/dev/null | grep -q ":${port} "
}

for port in 7880 7881; do
  if ! listen_tcp "$port"; then
    fail "host TCP ${port} not listening (LIVEKIT-CONFIG-001 or startup failure)"
  fi
  pass "host TCP ${port} listening"
done

if ! listen_udp 7882; then
  fail "host UDP 7882 not listening (LIVEKIT-CONFIG-001 or startup failure)"
fi
pass "host UDP 7882 listening"

if ! timeout 3 bash -c "echo >/dev/tcp/127.0.0.1/7881" 2>/dev/null; then
  fail "TCP connect to 127.0.0.1:7881 refused (LIVEKIT-DOCKER-001)"
fi
pass "TCP 127.0.0.1:7881 accepts connections"

YAML_PATH="/etc/livekit/livekit.yaml"
if ! docker exec "$CONTAINER" test -r "$YAML_PATH" 2>/dev/null; then
  fail "mounted config ${YAML_PATH} not readable inside container"
fi

RTC_LINES="$(docker exec "$CONTAINER" sh -c "grep -E '^(port:|  tcp_port:|  udp_port:|  node_ip:|  use_external_ip:)' ${YAML_PATH} 2>/dev/null" || true)"
if [[ -z "$RTC_LINES" ]]; then
  fail "could not read rtc settings from ${YAML_PATH}"
fi
echo "INFO effective_livekit_yaml:"
echo "$RTC_LINES" | sed 's/^/  /'

NODE_IP="$(echo "$RTC_LINES" | awk '/node_ip:/ {print $2}' | tail -n1)"
if [[ -z "$NODE_IP" ]]; then
  fail "rtc.node_ip missing from effective livekit.yaml (LIVEKIT-ICE-001)"
fi
if [[ "$NODE_IP" =~ ^127\. ]] || [[ "$NODE_IP" =~ ^10\. ]] || [[ "$NODE_IP" =~ ^192\.168\. ]] || [[ "$NODE_IP" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
  fail "rtc.node_ip is private/unreachable for mobile clients: ${NODE_IP} (LIVEKIT-ICE-001)"
fi
pass "rtc.node_ip=${NODE_IP}"

if [[ -n "$EXPECTED_NODE_IP" && "$NODE_IP" != "$EXPECTED_NODE_IP" ]]; then
  fail "rtc.node_ip ${NODE_IP} != LIVEKIT_NODE_IP ${EXPECTED_NODE_IP}"
fi

if [[ "$PUBLIC_LIVEKIT_URL" != wss://* ]]; then
  fail "NEXT_PUBLIC_LIVEKIT_URL must be wss:// for staging clients"
fi
pass "public client URL ${PUBLIC_LIVEKIT_URL}"

if [[ -n "$EXPECTED_NODE_IP" ]]; then
  if ! timeout 3 bash -c "echo >/dev/tcp/${EXPECTED_NODE_IP}/7881" 2>/dev/null; then
    fail "TCP connect to ${EXPECTED_NODE_IP}:7881 refused from host (LIVEKIT-DOCKER-001)"
  fi
  pass "TCP ${EXPECTED_NODE_IP}:7881 accepts connections from host"
fi

NGINX_LIVEKIT_BACKEND="$(grep -E 'the_eye_livekit_backend' infra/docker/nginx/snippets/livekit-locations.conf | head -n1 || true)"
if [[ "$NGINX_LIVEKIT_BACKEND" != *host.docker.internal* ]]; then
  fail "nginx livekit upstream must target host.docker.internal after host-network migration"
fi
pass "nginx livekit upstream uses host.docker.internal"

if docker compose -f infra/docker/docker-compose.yml --env-file .env ps --status running --services 2>/dev/null | grep -qx nginx; then
  if ! docker compose -f infra/docker/docker-compose.yml --env-file .env exec -T nginx nginx -t >/dev/null 2>&1; then
    fail "nginx -t failed after LiveKit host-network change"
  fi
  pass "nginx -t"
fi

echo "=== LiveKit network guard complete ==="
