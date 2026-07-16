# Staging Deployment Guide

Deploy THE EYE to the Ubuntu 24.04 staging VPS using Docker Compose.

## Prerequisites

- Ubuntu 24.04 with Docker Engine and Compose v2
- DNS A record for `THE_EYE_SERVER_NAME` pointing at the VPS
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
docker compose -f infra/docker/docker-compose.yml --env-file .env build
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d

# Migrations
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-migrate

# Bootstrap Super Admin (idempotent)
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-create-admin
```

## TLS (Let's Encrypt)

See [NGINX_TLS_BOOTSTRAP.md](./NGINX_TLS_BOOTSTRAP.md).

```bash
export THE_EYE_SERVER_NAME=staging-admin.theeye.com.ng
export CERTBOT_EMAIL=ops@example.com
bash scripts/issue-letsencrypt.sh
# Then set THE_EYE_SSL_REDIRECT=true in .env and restart nginx
```

## Verify

```bash
curl -sf http://localhost/healthz
curl -sf http://localhost/v1/health/ready   # after TLS: https://...
docker compose -f infra/docker/docker-compose.yml ps
```

## Related runbooks

- [DOCKER_BUILD.md](./DOCKER_BUILD.md) — image build details
- [LIVEKIT_DEPLOYMENT.md](./LIVEKIT_DEPLOYMENT.md) — LiveKit keys
- [FIREBASE_STAGING_AUTH.md](./FIREBASE_STAGING_AUTH.md) — mobile/API Firebase
- [ADMIN_BOOTSTRAP.md](./ADMIN_BOOTSTRAP.md) — admin account setup
- [STAGING_TROUBLESHOOTING.md](./STAGING_TROUBLESHOOTING.md) — common failures

## CI

Pushes to `staging` run `.github/workflows/validate-staging.yml` (API tests, mobile APK, Docker builds).

Manual deploy: `.github/workflows/deploy.yml` with environment **staging**.
