#!/usr/bin/env bash
# Staging-only external ICE packet-path diagnostic. Captures headers only.
set -euo pipefail

DURATION="${LIVEKIT_ICE_CAPTURE_SECONDS:-0}"
PUBLIC_IP="${LIVEKIT_NODE_IP:-}"

fail() {
  echo "FAIL LIVEKIT-ICE-EXT-001: $1"
  exit 1
}

if [[ ! "$DURATION" =~ ^[0-9]+$ ]] || (( DURATION < 1 || DURATION > 180 )); then
  fail "capture duration must be an integer from 1 to 180 seconds"
fi
if [[ ! "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  fail "LIVEKIT_NODE_IP must be a public IPv4 address"
fi
if ! command -v tcpdump >/dev/null 2>&1; then
  fail "tcpdump is not installed on the staging host"
fi

run_privileged() {
  if [[ "$(id -u)" == "0" ]]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

echo "=== LIVEKIT-ICE-EXT-001 host firewall evidence ==="
if command -v ufw >/dev/null 2>&1; then
  UFW_STATUS="$(run_privileged ufw status verbose 2>/dev/null || true)"
  echo "$UFW_STATUS" | grep -E '^(Status:|Default:|.*(7881|7882).*)' || true
else
  echo "INFO ufw=not-installed"
fi
if command -v nft >/dev/null 2>&1; then
  run_privileged nft list ruleset 2>/dev/null | grep -E '7881|7882' || true
elif command -v iptables >/dev/null 2>&1; then
  run_privileged iptables -S INPUT 2>/dev/null | grep -E '7881|7882' || true
fi

CAPTURE_FILE="$(mktemp)"
trap 'rm -f "$CAPTURE_FILE"' EXIT

echo "CAPTURE_READY LIVEKIT-ICE-EXT-001 durationSeconds=${DURATION} ports=7882/udp,7881/tcp"
CAPTURE_CMD=(tcpdump -nn -q -l -i any -s 64 '(udp port 7882 or tcp port 7881)')
if [[ "$(id -u)" != "0" ]]; then
  CAPTURE_CMD=(sudo -n "${CAPTURE_CMD[@]}")
fi
set +e
timeout "$DURATION" "${CAPTURE_CMD[@]}" >"$CAPTURE_FILE" 2>&1
CAPTURE_STATUS=$?
set -e
if [[ "$CAPTURE_STATUS" -ne 0 && "$CAPTURE_STATUS" -ne 124 ]]; then
  sed -n '1,20p' "$CAPTURE_FILE"
  fail "tcpdump exited with status ${CAPTURE_STATUS}"
fi

echo "=== LIVEKIT-ICE-EXT-001 packet headers (LiveKit RTC ports only) ==="
sed -n '1,200p' "$CAPTURE_FILE"
UDP_IN="$(grep -Ec "> ${PUBLIC_IP}\.7882:" "$CAPTURE_FILE" || true)"
UDP_OUT="$(grep -Ec "${PUBLIC_IP}\.7882 >" "$CAPTURE_FILE" || true)"
TCP_IN="$(grep -Ec "> ${PUBLIC_IP}\.7881:" "$CAPTURE_FILE" || true)"
TCP_OUT="$(grep -Ec "${PUBLIC_IP}\.7881 >" "$CAPTURE_FILE" || true)"
echo "ICE_PACKET_COUNTS udpIn=${UDP_IN} udpOut=${UDP_OUT} tcpIn=${TCP_IN} tcpOut=${TCP_OUT}"

if (( UDP_IN == 0 && TCP_IN == 0 )); then
  fail "no external ICE packet reached the staging host during the capture window"
fi
if (( UDP_IN > 0 && UDP_OUT == 0 )); then
  fail "UDP 7882 reached the host but no return packet left the host"
fi
echo "PASS LIVEKIT-ICE-EXT-001 external ICE packets reached the staging host"
