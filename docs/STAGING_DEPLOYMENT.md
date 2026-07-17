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
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d

# Optional: validate the API runtime image tag compose will use
export THE_EYE_IMAGE_TAG="${THE_EYE_IMAGE_TAG:-local}"
node scripts/validate-api-runtime-image.cjs "the-eye-api:${THE_EYE_IMAGE_TAG}"

# Migrations (tools image — includes prisma CLI)
docker compose -f infra/docker/docker-compose.yml --profile tools build api-migrate
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-migrate

# Bootstrap Super Admin (idempotent)
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-create-admin
```

The **API runtime** uses the `production` Docker target (`the-eye-api`). One-shot **tools** services (migrate, seed, create-admin) use the `tools` target (`the-eye-api-tools`) built from the same Dockerfile with full deploy deps (`prisma`, `tsx`). See [DOCKER_BUILD.md](./DOCKER_BUILD.md).

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

## Related runbooks

- [DOCKER_BUILD.md](./DOCKER_BUILD.md) — image build details
- [LIVEKIT_DEPLOYMENT.md](./LIVEKIT_DEPLOYMENT.md) — LiveKit keys
- [FIREBASE_STAGING_AUTH.md](./FIREBASE_STAGING_AUTH.md) — mobile/API Firebase
- [ADMIN_BOOTSTRAP.md](./ADMIN_BOOTSTRAP.md) — admin account setup
- [STAGING_TROUBLESHOOTING.md](./STAGING_TROUBLESHOOTING.md) — common failures

## CI

Pushes to `staging` run `.github/workflows/validate-staging.yml` (API tests, mobile APK, Docker builds).

Manual deploy: `.github/workflows/deploy.yml` with environment **staging**.
