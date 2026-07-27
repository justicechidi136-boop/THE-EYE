# Staging Deployment Guide

Deploy THE EYE to the Ubuntu 24.04 staging VPS using Docker Compose.

## Canonical staging URLs

| Service | URL |
|---------|-----|
| Admin Dashboard | `https://staging-dashboard8jps.theeye.com.ng` |
| NestJS API | `https://staging-api.theeye.com.ng` |
| API base URL | `https://staging-api.theeye.com.ng/v1` |
| LiveKit | `wss://staging-livekit.theeye.com.ng` |

Each service is served by a dedicated nginx `server_name`. The admin dashboard hostname must **not** be used as the canonical API URL in clients.

For the full **order-of-operations** rollout (DNS → HTTP bootstrap → ACME → HTTPS → migration gate → rollback), see [STAGING_SUBDOMAIN_DEPLOYMENT.md](./STAGING_SUBDOMAIN_DEPLOYMENT.md).

## Prerequisites

- Ubuntu 24.04 with Docker Engine and Compose v2
- DNS **A records** for all three hostnames pointing at the VPS:
  - `staging-dashboard8jps.theeye.com.ng`
  - `staging-api.theeye.com.ng`
  - `staging-livekit.theeye.com.ng`
- GitHub Environment `staging` secrets configured (see [GitHub Workflows](./github-workflows.md))
- `.env` on the server (never commit) with staging values

## Environment isolation

| Environment | Firebase project | Branch |
|-------------|------------------|--------|
| Development | `the-eye-29cff` | local |
| **Staging** | **`the-eye-2stg`** | **`staging`** |
| Production | `the-eye-2pd-d0217` | `main` |

Staging `.env` must set:

```env
THE_EYE_APP_ENV=staging
FCM_PROJECT_ID=the-eye-2stg
FIREBASE_PROJECT_ID=the-eye-2stg
THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
CORS_ORIGINS=https://staging-dashboard8jps.theeye.com.ng
NEXT_PUBLIC_API_BASE_URL=https://staging-api.theeye.com.ng/v1
NEXT_PUBLIC_LIVEKIT_URL=wss://staging-livekit.theeye.com.ng
```

## First-time deploy

```bash
git checkout staging
git pull
cp .env.example .env
# Edit .env — replace all change_me* placeholders with staging secrets

# Phase 1: HTTP bootstrap (no TLS yet)
export THE_EYE_TLS_BOOTSTRAP=auto
export THE_EYE_SSL_REDIRECT=false
export THE_EYE_GENERATE_DEV_SSL=false

docker compose -f infra/docker/docker-compose.yml --env-file .env config
docker compose -f infra/docker/docker-compose.yml --env-file .env build api
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d api notification-worker redis postgres-postgis minio livekit

# Optional: validate the API runtime image tag compose will use
export THE_EYE_IMAGE_TAG="${THE_EYE_IMAGE_TAG:-local}"
node scripts/validate-api-runtime-image.cjs "the-eye-api:${THE_EYE_IMAGE_TAG}"

# Migrations (tools image — includes prisma CLI)
docker compose -f infra/docker/docker-compose.yml --profile tools build api-migrate
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-migrate

# Bootstrap Super Admin (idempotent)
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-create-admin
```

The **API runtime** uses the `production` Docker target (`the-eye-api`). The **notification worker** uses the same image with `node dist/worker.js` and `THE_EYE_RUN_NOTIFICATION_WORKER=1`. One-shot **tools** services (migrate, seed, create-admin) use the `tools` target (`the-eye-api-tools`) built from the same Dockerfile with full deploy deps (`prisma`, `tsx`). See [DOCKER_BUILD.md](./DOCKER_BUILD.md).

### Notification worker

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d notification-worker
docker compose -f infra/docker/docker-compose.yml --env-file .env logs -f notification-worker
```

Rollback: stop `notification-worker`, redeploy prior image tag, then restart after `/v1/health/ready` shows `notificationQueue` ok.

## TLS (Let's Encrypt)

See [NGINX_TLS_BOOTSTRAP.md](./NGINX_TLS_BOOTSTRAP.md).

```bash
export THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
export THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
export THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
export CERTBOT_EMAIL=ops@example.com
bash scripts/issue-letsencrypt.sh
# Then set THE_EYE_SSL_REDIRECT=true in .env and restart nginx
```

## Verify (on VPS after deploy)

```bash
curl -sf https://staging-dashboard8jps.theeye.com.ng/healthz
curl -sf https://staging-api.theeye.com.ng/healthz
curl -sf https://staging-livekit.theeye.com.ng/healthz
curl -sf https://staging-api.theeye.com.ng/v1/health/ready
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml images api
docker images --filter reference='*the-eye-api*'
```

Confirm the running API image tag matches the deployed commit (`THE_EYE_IMAGE_TAG` or git SHA), not an unpinned `:latest` tag. See [DOCKER_BUILD.md](./DOCKER_BUILD.md#image-tagging-policy).

### Network egress (Firebase / Google OAuth)

The API container must reach the public internet over HTTPS to verify Firebase ID tokens. The Firebase Admin SDK fetches Google signing certificates from `https://www.googleapis.com/robot/v1/metadata/x509/...` at runtime.

Compose uses two Docker networks:

| Network | `internal` | Attached by | Purpose |
|---------|------------|-------------|---------|
| `the-eye-internal` | `true` | postgres, redis, minio, livekit, admin-web, api | Service-to-service traffic; **no outbound internet** |
| `the-eye-public` | `false` | nginx, certbot, **api** | Outbound HTTPS for Firebase cert fetch, ACME, TLS bootstrap |

The API joins **both** networks: internal for database/redis/S3/LiveKit, public for Google/Firebase egress. Data stores stay on the internal network only.

After deploy or network changes, recreate the API container and verify egress from inside it:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --force-recreate api

# DNS + HTTPS reachability (Alpine API image includes wget)
docker compose -f infra/docker/docker-compose.yml exec api wget -qO- https://www.googleapis.com 2>&1 | head

# Optional: confirm API is on both networks
docker inspect the-eye-api --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# Expected: the-eye-internal the-eye-public
```

If `wget` returns `SERVFAIL` or times out, Firebase token verification will fail with cert-fetch timeouts even when `FIREBASE_PROJECT_ID` is correct.

## Related runbooks

- [DOCKER_BUILD.md](./DOCKER_BUILD.md) — image build details
- [LIVEKIT_DEPLOYMENT.md](./LIVEKIT_DEPLOYMENT.md) — LiveKit keys
- [FIREBASE_STAGING_AUTH.md](./FIREBASE_STAGING_AUTH.md) — mobile/API Firebase
- [ADMIN_BOOTSTRAP.md](./ADMIN_BOOTSTRAP.md) — admin account setup
- [STAGING_TROUBLESHOOTING.md](./STAGING_TROUBLESHOOTING.md) — common failures

## CI

Pushes to `staging` run `.github/workflows/validate-staging.yml` (API tests, mobile APK, Docker builds).

Manual deploy: `.github/workflows/deploy.yml` with environment **staging**.

## Staging deploy helper (VPS)

After `.env` is configured, use the scripted deploy path so nginx upstreams refresh automatically after API/admin recreation (DEP-005):

```bash
export THE_EYE_IMAGE_TAG=<git-sha-or-tag>
export RUN_MIGRATIONS=true
bash scripts/deploy-staging.sh
```

This script:

1. Waits for postgres/redis/minio/livekit health
2. Runs `api-migrate` (unless `RUN_MIGRATIONS=false`)
3. Force-recreates `api`, `notification-worker`, and `admin-web`
4. Waits for API/admin/LiveKit health
5. Runs `nginx -t` and `nginx -s reload` via `scripts/reload-nginx-upstreams.sh`
6. Runs Host-aware smoke checks (`scripts/staging-smoke-check.sh`) including proxied `/v1/health/ready`

GitHub **Deploy** workflow (staging) invokes the same reload + smoke steps after container recreation.

## Staging certification seed (api-tools)

The Compose profile `tools` includes a generic **`api-tools`** runner (image `the-eye-api-tools`, same schema/client as migrate/seed).

**Canonical seed command:**

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-tools \
  prisma/seed-staging-test-accounts.ts
```

Equivalent dedicated service (same script):

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-seed-staging
```

**Verify dataset (no credentials printed):**

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-tools \
  scripts/verify-staging-certification-data.ts
```

Requirements:

- `THE_EYE_APP_ENV=staging`
- `STAGING_TEST_*_EMAIL` / `STAGING_TEST_*_PASSWORD` pairs in `.env` (see `apps/api/.env.staging.example`)
- Seed is idempotent — safe to run twice

See [staging-test-accounts.md](./staging-test-accounts.md) and [STAGING_CERTIFICATION.md](./STAGING_CERTIFICATION.md).

## PostgreSQL backup (staging)

The backup script must use the **same Compose file and env-file** as the running stack. Staging containers are started with `--env-file .env`; omitting it makes `docker compose ps` look at the wrong project and report `postgres-postgis` as stopped.

From the repository root on the VPS (`DEPLOY_PATH`, typically `/opt/the-eye`):

```bash
bash scripts/backup-the-eye.sh \
  --compose-file infra/docker/docker-compose.yml \
  --env-file .env \
  --output-dir backups \
  --environment staging
```

Equivalent environment variables:

```bash
export COMPOSE_FILE=/opt/the-eye/infra/docker/docker-compose.yml
export ENV_FILE=/opt/the-eye/.env
export BACKUP_DIR=/opt/the-eye/backups
bash scripts/backup-the-eye.sh
```

Outputs (no secrets logged):

- `backups/the-eye-staging-YYYYMMDDTHHMMSSZ.dump` — PostgreSQL custom-format archive
- `backups/the-eye-staging-YYYYMMDDTHHMMSSZ.json` — metadata (SHA-256, size, git SHA, validation result)
- `backups/the-eye-staging-latest.dump` — rolling latest copy
- `backups/the_eye_latest.dump` — legacy alias for older runbooks

Optional isolated restore drill (never touches the live staging database):

```bash
bash scripts/backup-the-eye.sh --with-restore-drill
# or validate an existing dump:
bash scripts/backup-restore-drill.sh --backup-file backups/the-eye-staging-latest.dump
```

Scheduled backup: GitHub Actions workflow [`.github/workflows/backup.yml`](../.github/workflows/backup.yml) (daily 03:00 UTC, manual `workflow_dispatch`).

Troubleshooting:

| Error | Cause | Fix |
|-------|-------|-----|
| `BACKUP-004` | Missing `.env` on VPS | Create `.env` from secret manager; never commit |
| `BACKUP-006` | Compose project mismatch | Pass `--env-file .env` and run from `DEPLOY_PATH` |
| `BACKUP-008` | `pg_dump` failed | Check DB health: `docker compose -f infra/docker/docker-compose.yml --env-file .env ps postgres-postgis` |
| `BACKUP-010` | Archive validation failed | Re-run backup; inspect disk space and DB connectivity |

See also [disaster-recovery.md](./disaster-recovery.md) and [maintenance-guide.md](./maintenance-guide.md).
