#!/usr/bin/env bash
# VPS backup entrypoint used by GitHub Actions — avoids fragile inline SSH branching.
set -euo pipefail

DEPLOY_PATH="${1:-.}"
WITH_RESTORE_DRILL="${2:-false}"

if [[ "$WITH_RESTORE_DRILL" != "true" && "$WITH_RESTORE_DRILL" != "false" ]]; then
  echo "Invalid with_restore_drill value: $WITH_RESTORE_DRILL (expected true or false)" >&2
  exit 1
fi

cd "$DEPLOY_PATH"

COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_PATH}/infra/docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-${DEPLOY_PATH}/.env}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_PATH}/backups}"

echo "Staging backup runner: restore_drill=$WITH_RESTORE_DRILL"
echo "Compose file: $COMPOSE_FILE"
echo "Env file: $ENV_FILE"
echo "Backup dir: $BACKUP_DIR"

args=(
  --compose-file "$COMPOSE_FILE"
  --env-file "$ENV_FILE"
  --output-dir "$BACKUP_DIR"
  --environment staging
)

if [[ "$WITH_RESTORE_DRILL" == "true" ]]; then
  args+=(--with-restore-drill)
fi

bash scripts/backup-the-eye.sh "${args[@]}"

for link in \
  "$BACKUP_DIR/the-eye-staging-latest.dump" \
  "$BACKUP_DIR/the_eye_latest.dump"; do
  if [[ -f "$link" ]]; then
    ls -lh "$link"
  else
    echo "Warning: expected backup link missing: $link" >&2
  fi
done
