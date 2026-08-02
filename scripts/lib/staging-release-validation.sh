#!/usr/bin/env bash
# Pre-proof release gate — all health checks must pass before proof scripts run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/safe-env.sh"

COMPOSE=(docker compose -f infra/docker/docker-compose.yml --env-file .env)
CONTAINER="${LIVEKIT_CONTAINER_NAME:-the-eye-livekit}"
NGINX_CONTAINER="${NGINX_CONTAINER_NAME:-the-eye-nginx}"
API_CONTAINER="${API_CONTAINER_NAME:-the-eye-api}"
LIVEKIT_HOST="$(read_env_var THE_EYE_LIVEKIT_SERVER_NAME staging-livekit.theeye.com.ng)"
API_HOST="$(read_env_var THE_EYE_API_SERVER_NAME staging-api.theeye.com.ng)"
EXPECTED_NODE_IP="$(read_env_var LIVEKIT_NODE_IP)"

gate_fail() {
  echo "FAIL RELEASE-GATE: $1"
  exit 1
}

staging_release_validation() {
  echo "=== Staging release validation (pre-proof gate) ==="

  echo "--- docker compose ps ---"
  "${COMPOSE[@]}" ps || gate_fail "docker compose ps failed"

  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    gate_fail "LiveKit container ${CONTAINER} not found"
  fi

  echo "--- docker inspect livekit (network + image) ---"
  docker inspect "$CONTAINER" --format 'network={{.HostConfig.NetworkMode}} image={{.Config.Image}}' || gate_fail "docker inspect livekit failed"

  echo "--- runtime /etc/livekit/livekit.yaml rtc block ---"
  docker exec "$CONTAINER" sh -c "grep -E '^(port:|  tcp_port:|  udp_port:|  node_ip:|  use_external_ip:)' /etc/livekit/livekit.yaml" \
    || gate_fail "cannot read runtime livekit.yaml"

  RUNTIME_IP="$(docker exec "$CONTAINER" sh -c "grep -E '^  node_ip:' /etc/livekit/livekit.yaml | awk '{print \$2}' | tail -n1" 2>/dev/null || true)"
  if [[ -z "$RUNTIME_IP" ]]; then
    gate_fail "runtime rtc.node_ip missing"
  fi
  echo "INFO runtime node_ip=${RUNTIME_IP}"
  if [[ -n "$EXPECTED_NODE_IP" && "$RUNTIME_IP" != "$EXPECTED_NODE_IP" ]]; then
    gate_fail "runtime node_ip ${RUNTIME_IP} != LIVEKIT_NODE_IP ${EXPECTED_NODE_IP}"
  fi

  echo "--- LIVEKIT_NODE_IP from .env ---"
  echo "INFO LIVEKIT_NODE_IP=${EXPECTED_NODE_IP:-<unset>}"

  echo "--- network guard ---"
  bash "$REPO_ROOT/scripts/staging-livekit-network-guard.sh" || gate_fail "staging-livekit-network-guard.sh failed"

  echo "--- smoke checks ---"
  bash "$REPO_ROOT/scripts/staging-smoke-check.sh" || gate_fail "staging-smoke-check.sh failed"

  echo "--- LiveKit health ---"
  if ! docker exec "$CONTAINER" wget -q --spider http://127.0.0.1:7880 2>/dev/null; then
    gate_fail "LiveKit signaling http://127.0.0.1:7880 unhealthy"
  fi

  echo "--- API health ---"
  if docker inspect "$API_CONTAINER" >/dev/null 2>&1; then
    if ! docker exec "$API_CONTAINER" wget -q --spider http://127.0.0.1:4000/v1/health/ready 2>/dev/null; then
      gate_fail "API /v1/health/ready unhealthy inside container"
    fi
  else
    gate_fail "API container ${API_CONTAINER} not found"
  fi

  echo "--- Nginx health ---"
  if docker inspect "$NGINX_CONTAINER" >/dev/null 2>&1; then
    if ! docker exec "$NGINX_CONTAINER" wget -q --spider http://127.0.0.1/healthz 2>/dev/null; then
      gate_fail "nginx /healthz unhealthy"
    fi
  else
    gate_fail "nginx container ${NGINX_CONTAINER} not found"
  fi

  echo "--- WSS endpoint (nginx proxied LiveKit vhost) ---"
  if ! curl -fsSk --max-time 10 -H "Host: ${LIVEKIT_HOST}" "https://127.0.0.1/" >/dev/null 2>&1 \
    && ! curl -fsS --max-time 10 -H "Host: ${LIVEKIT_HOST}" "http://127.0.0.1/" >/dev/null 2>&1; then
    gate_fail "WSS/signaling vhost unreachable for Host=${LIVEKIT_HOST}"
  fi

  echo "--- API proxied health ---"
  if ! curl -fsSk --max-time 10 -H "Host: ${API_HOST}" "https://127.0.0.1/v1/health/ready" >/dev/null 2>&1 \
    && ! curl -fsS --max-time 10 -H "Host: ${API_HOST}" "http://127.0.0.1/v1/health/ready" >/dev/null 2>&1; then
    gate_fail "proxied API /v1/health/ready unreachable"
  fi

  echo "=== Staging release validation passed ==="
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  staging_release_validation
fi
