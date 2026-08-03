#!/usr/bin/env bash
# Repair LiveKit dual-network host port publish on a running VPS without full redeploy.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/prepare-livekit-deploy.sh"

echo "=== LiveKit network publish repair ==="
prepare_livekit_deploy
bash "$REPO_ROOT/scripts/staging-livekit-network-guard.sh"
echo "=== LiveKit network publish repair complete ==="
