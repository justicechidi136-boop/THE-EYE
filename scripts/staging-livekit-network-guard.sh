#!/usr/bin/env bash
# Post-deploy guard: LiveKit bridge-network signaling, RTC port publication, and nginx upstream.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/safe-env.sh"

COMPOSE=(docker compose -f infra/docker/docker-compose.yml --env-file .env)
CONTAINER="${LIVEKIT_CONTAINER_NAME:-the-eye-livekit}"
NGINX_CONTAINER="${NGINX_CONTAINER_NAME:-the-eye-nginx}"
PUBLIC_LIVEKIT_URL="${NEXT_PUBLIC_LIVEKIT_URL:-$(read_env_var NEXT_PUBLIC_LIVEKIT_URL wss://staging-livekit.theeye.com.ng)}"
EXPECTED_NODE_IP="${LIVEKIT_NODE_IP:-}"
LIVEKIT_HOST="$(read_env_var THE_EYE_LIVEKIT_SERVER_NAME staging-livekit.theeye.com.ng)"

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

if [[ "$NETWORK_MODE" == "host" ]]; then
  fail "LiveKit must use the single the-eye-public bridge (got host). Recreate with updated compose (LIVEKIT-DOCKER-001)"
fi
pass "network_mode=${NETWORK_MODE} (bridge, not host)"

PORT_BINDINGS="$(docker inspect "$CONTAINER" --format '{{json .HostConfig.PortBindings}}' 2>/dev/null || echo '{}')"
PORTS_JSON="$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null || echo '{}')"

NETWORKS="$(docker inspect "$CONTAINER" --format '{{range $name, $cfg := .NetworkSettings.Networks}}{{$name}} {{end}}')"
echo "INFO attached_networks=${NETWORKS:-none}"
if [[ "$NETWORKS" != *the-eye-public* ]]; then
  echo "INFO HostConfig.PortBindings=${PORT_BINDINGS:-{}}"
  echo "INFO NetworkSettings.Ports=${PORTS_JSON:-{}}"
  fail "LiveKit must join the-eye-public so Docker can publish RTC ports to the host (got: ${NETWORKS:-none}). Run: bash scripts/repair-livekit-network-publish.sh"
fi
if [[ "$NETWORKS" == *the-eye-internal* ]]; then
  fail "LIVEKIT-DOCKER-NAT-001: dual internal/public attachment can bypass published-port SNAT; recreate LiveKit on the-eye-public only"
fi
NETWORK_COUNT="$(wc -w <<<"$NETWORKS" | tr -d ' ')"
if [[ "$NETWORK_COUNT" != "1" ]]; then
  fail "LIVEKIT-DOCKER-NAT-001: LiveKit must have exactly one Docker network (got ${NETWORK_COUNT}: ${NETWORKS:-none})"
fi
pass "LIVEKIT-DOCKER-NAT-001 attached only to the-eye-public"

port_publish_fail() {
  local port="$1"
  local proto="$2"
  echo "INFO HostConfig.PortBindings=${PORT_BINDINGS}"
  echo "INFO NetworkSettings.Ports=${PORTS_JSON}"
  if [[ "$NETWORKS" != *the-eye-public* ]]; then
    fail "host ${proto} ${port} not published — LiveKit is internal-network-only; attach the-eye-public so Docker can bind host ports (LIVEKIT-DOCKER-001)"
  fi
  fail "host ${proto} ${port} not published from LiveKit container — recreate with updated compose (LIVEKIT-DOCKER-001)"
}

for port in 7880 7881; do
  PUBLISHED="$(docker port "$CONTAINER" "${port}/tcp" 2>/dev/null || true)"
  if [[ -z "$PUBLISHED" ]]; then
    port_publish_fail "$port" "TCP"
  fi
  pass "docker port ${port}/tcp -> ${PUBLISHED}"
done

UDP_PUBLISHED="$(docker port "$CONTAINER" "7882/udp" 2>/dev/null || true)"
if [[ -z "$UDP_PUBLISHED" ]]; then
  port_publish_fail "7882" "UDP"
fi
pass "docker port 7882/udp -> ${UDP_PUBLISHED}"

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
    fail "host TCP ${port} not listening after port publish (LIVEKIT-CONFIG-001 or startup failure)"
  fi
  pass "host TCP ${port} listening"
done

if ! listen_udp 7882; then
  fail "host UDP 7882 not listening after port publish (LIVEKIT-CONFIG-001 or startup failure)"
fi
pass "host UDP 7882 listening"

if ! timeout 3 bash -c "echo >/dev/tcp/127.0.0.1/7881" 2>/dev/null; then
  fail "TCP connect to 127.0.0.1:7881 refused (LIVEKIT-DOCKER-001)"
fi
pass "TCP 127.0.0.1:7881 accepts connections"

if ! docker exec "$CONTAINER" wget -q --spider http://127.0.0.1:7880 2>/dev/null; then
  fail "LiveKit signaling http://127.0.0.1:7880 not healthy inside container"
fi
pass "LiveKit signaling healthy inside container"

YAML_PATH="/etc/livekit/livekit.yaml"
if ! docker exec "$CONTAINER" test -r "$YAML_PATH" 2>/dev/null; then
  fail "mounted config ${YAML_PATH} not readable inside container"
fi

RTC_LINES="$(docker exec "$CONTAINER" sh -c "grep -E '^(port:|  tcp_port:|  udp_port:|  port_range_start:|  port_range_end:|  node_ip:|  use_external_ip:)' ${YAML_PATH} 2>/dev/null" || true)"
if [[ -z "$RTC_LINES" ]]; then
  fail "could not read rtc settings from ${YAML_PATH}"
fi
echo "INFO effective_livekit_yaml:"
echo "$RTC_LINES" | sed 's/^/  /'

NODE_IP="$(echo "$RTC_LINES" | awk '/node_ip:/ {print $2}' | tail -n1)"
NODE_IP_COUNT="$(echo "$RTC_LINES" | grep -c 'node_ip:' || true)"
UDP_PORT="$(echo "$RTC_LINES" | awk '/udp_port:/ {print $2}' | tail -n1)"
RANGE_START="$(echo "$RTC_LINES" | awk '/port_range_start:/ {print $2}' | tail -n1)"
RANGE_END="$(echo "$RTC_LINES" | awk '/port_range_end:/ {print $2}' | tail -n1)"

if [[ -n "$UDP_PORT" && ( -n "$RANGE_START" || -n "$RANGE_END" ) ]]; then
  fail "LIVEKIT-RTC-MODE-001: configure UDP mux or an RTC port range, not both"
fi
if [[ -n "$UDP_PORT" ]]; then
  if [[ "$UDP_PORT" != "7882" ]]; then
    fail "LIVEKIT-RTC-MODE-001: UDP mux must use published port 7882 (got ${UDP_PORT})"
  fi
  pass "LIVEKIT-RTC-MODE-001 mode=udp-mux udp_port=7882"
elif [[ -z "$RANGE_START" || -z "$RANGE_END" ]]; then
  fail "LIVEKIT-RTC-MODE-001: rtc must define udp_port or both port_range_start/port_range_end"
else
  fail "LIVEKIT-RTC-MODE-001: staging compose publishes UDP mux 7882, not RTC range ${RANGE_START}-${RANGE_END}"
fi

if [[ -z "$NODE_IP" ]]; then
  fail "LIVEKIT-ICE-001: rtc.node_ip missing from effective livekit.yaml — run: bash scripts/repair-livekit-node-ip.sh"
fi
if [[ "$NODE_IP_COUNT" -gt 1 ]]; then
  fail "LIVEKIT-ICE-001: duplicate node_ip keys in effective livekit.yaml (count=${NODE_IP_COUNT})"
fi
if [[ ! "$NODE_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  fail "LIVEKIT-ICE-001: rtc.node_ip is not valid IPv4: ${NODE_IP}"
fi
if [[ "$NODE_IP" == "0.0.0.0" ]]; then
  fail "LIVEKIT-ICE-001: rtc.node_ip is empty/zero address"
fi
if [[ "$NODE_IP" =~ ^127\. ]]; then
  fail "LIVEKIT-ICE-001: rtc.node_ip is localhost (${NODE_IP})"
fi
if [[ "$NODE_IP" =~ ^10\. ]] || [[ "$NODE_IP" =~ ^192\.168\. ]] || [[ "$NODE_IP" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
  fail "LIVEKIT-ICE-001: rtc.node_ip is private Docker/RFC1918 (${NODE_IP})"
fi
if [[ "$NODE_IP" =~ ^169\.254\. ]]; then
  fail "LIVEKIT-ICE-001: rtc.node_ip is link-local (${NODE_IP})"
fi
if [[ -n "$EXPECTED_NODE_IP" && "$NODE_IP" != "$EXPECTED_NODE_IP" ]]; then
  fail "LIVEKIT-ICE-001: rtc.node_ip ${NODE_IP} != LIVEKIT_NODE_IP ${EXPECTED_NODE_IP}"
fi
pass "LIVEKIT-ICE-001 rtc.node_ip=${NODE_IP} (public IPv4, matches LIVEKIT_NODE_IP)"

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
if [[ "$NGINX_LIVEKIT_BACKEND" != *livekit:7880* ]]; then
  fail "nginx livekit upstream must target livekit:7880 on the shared Docker bridge"
fi
pass "nginx livekit upstream uses livekit:7880"

if docker inspect "$NGINX_CONTAINER" >/dev/null 2>&1; then
  if ! docker exec "$NGINX_CONTAINER" wget -q --spider http://livekit:7880 2>/dev/null; then
    fail "nginx container cannot reach http://livekit:7880 (Docker service discovery broken)"
  fi
  pass "nginx -> livekit:7880 direct upstream reachable"

  if ! "${COMPOSE[@]}" exec -T nginx nginx -t >/dev/null 2>&1; then
    fail "nginx -t failed after LiveKit bridge-network change"
  fi
  pass "nginx -t"

  if curl -fsS --max-time 10 -H "Host: ${LIVEKIT_HOST}" "http://127.0.0.1/" >/dev/null 2>&1 \
    || curl -fsSk --max-time 10 -H "Host: ${LIVEKIT_HOST}" "https://127.0.0.1/" >/dev/null 2>&1; then
    pass "nginx proxied LiveKit vhost responds for Host=${LIVEKIT_HOST}"
  else
    fail "nginx proxied LiveKit vhost unreachable for Host=${LIVEKIT_HOST}"
  fi
else
  warn "nginx container ${NGINX_CONTAINER} not running — skipped upstream connectivity checks"
fi

echo "=== LiveKit network guard complete ==="
