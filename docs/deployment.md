# Deployment Notes

> **Production runbooks:** [Production Deployment Guide](./production-deployment-guide.md) ù [Rollback Guide](./rollback-guide.md) ù [Maintenance Guide](./maintenance-guide.md)  
> **Staging runbooks:** [STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md) ù [STAGING_TROUBLESHOOTING.md](./STAGING_TROUBLESHOOTING.md)  
> **CI/CD & GitHub Environments:** [GitHub Workflows](./github-workflows.md)

Production deployment uses `infra/docker/docker-compose.yml` with nginx TLS termination on port 443.


## Git branch model

| Branch | Role |
|--------|------|
| `main` | Production-ready default; push runs **Validate Production** (`validate-production.yml`). |
| `staging` | Staging integration; push runs **Validate Staging** (`validate-staging.yml`). |
| `feature/*` | Cursor and feature work; open PRs into `staging` (usual) or `main` (hotfix/release). Do not deploy from feature branches. |

**CI:** pull requests targeting `staging` or `main` run `ci.yml` (no GitHub environment secrets).

**Deploy:** `deploy.yml` is manual (`workflow_dispatch`) only. Check out `staging` and choose environment **staging**, or check out `main` and choose **production**. Server secrets live in each GitHub Environment (`staging` / `production`).

## Quick start (production compose)

```bash
cp .env.example .env
# Edit .env ù replace every change_me* placeholder with production secrets.

# TLS: install certificates OR generate dev self-signed for staging
powershell -File scripts/generate-dev-ssl.ps1 -ServerName admin.example.com

docker compose -f infra/docker/docker-compose.yml --env-file .env config
docker compose -f infra/docker/docker-compose.yml --env-file .env build
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d

docker compose -f infra/docker/docker-compose.yml --profile tools run api-migrate
docker compose -f infra/docker/docker-compose.yml --profile tools run api-seed   # optional non-prod only
```

## Public endpoints (via nginx)

Each service has a dedicated hostname. Staging examples:

| Hostname | Backend |
|----------|---------|
| `staging-dashboard8jps.theeye.com.ng` | Admin web |
| `staging-api.theeye.com.ng/v1/` | API |
| `staging-livekit.theeye.com.ng` | LiveKit WebSocket |
| `*/healthz` | Nginx liveness (one per hostname) |

API readiness: `GET https://staging-api.theeye.com.ng/v1/health/ready`

Configure hostnames with `THE_EYE_ADMIN_SERVER_NAME`, `THE_EYE_API_SERVER_NAME`, and `THE_EYE_LIVEKIT_SERVER_NAME`.

## TLS / HTTPS

nginx renders config at container start from `infra/docker/nginx/render/*.conf.template` via the entrypoint script.

1. Place certificates in `infra/docker/nginx/certs/live/`:
   - Shared SAN cert: `fullchain.pem` + `privkey.pem`
   - Or per-hostname: `<hostname>/fullchain.pem` + `<hostname>/privkey.pem`
2. Set in `.env`:
   ```env
   THE_EYE_ADMIN_SERVER_NAME=admin.example.com
   THE_EYE_API_SERVER_NAME=api.example.com
   THE_EYE_LIVEKIT_SERVER_NAME=livekit.example.com
   THE_EYE_SSL_REDIRECT=true
   THE_EYE_GENERATE_DEV_SSL=false
   CORS_ORIGINS=https://admin.example.com
   NEXT_PUBLIC_API_BASE_URL=https://api.example.com/v1
   NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.example.com
   ```
3. Restart nginx: `docker compose -f infra/docker/docker-compose.yml restart nginx`

### Self-signed (staging only)

```powershell
powershell -File scripts/generate-dev-ssl.ps1 -ServerName localhost
```

Or set `THE_EYE_GENERATE_DEV_SSL=true` (never in production).

### Let's Encrypt

```bash
export THE_EYE_SERVER_NAME=admin.example.com
export CERTBOT_EMAIL=ops@example.com
bash scripts/issue-letsencrypt.sh
```

Set `THE_EYE_SSL_REDIRECT=true` after issuance. Schedule `scripts/renew-letsencrypt.sh` via cron. See `infra/docker/nginx/certs/live/README.md`.

## Health checks

| Service | Probe |
|---------|-------|
| postgres-postgis | `pg_isready` |
| redis | `redis-cli ping` |
| minio | `/minio/health/live` |
| livekit | binary version (process up) |
| api | `GET /v1/health/ready` |
| admin-web | `GET /` (status < 500) |
| nginx | `GET /healthz` |

Services start in dependency order: data stores ? api ? admin-web ? nginx.

## Required environment variables

Validated by `pnpm run test:deploy:env`. Required secrets use `:?` syntax in compose so missing values fail fast.

| Variable | Purpose |
|----------|---------|
| `POSTGRES_PASSWORD` | Database auth |
| `DATABASE_URL` | API runtime DB |
| `DATABASE_DIRECT_URL` | Migrations / seed |
| `REDIS_PASSWORD` | Redis + BullMQ + rate limits |
| `MINIO_ROOT_PASSWORD` | Object storage |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Auth tokens |
| `LIVE_LOCATION_LINK_SECRET` | Signed location links |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Live video |
| `CORS_ORIGINS` | Trusted admin origins (HTTPS in prod) |
| `GOOGLE_OAUTH_CLIENT_ID` | Production auth validation |
| `THE_EYE_ADMIN_SERVER_NAME` | Admin dashboard nginx `server_name` |
| `THE_EYE_API_SERVER_NAME` | API nginx `server_name` |
| `THE_EYE_LIVEKIT_SERVER_NAME` | LiveKit nginx `server_name` |
| `THE_EYE_SERVER_NAME` | Legacy fallback for admin hostname |
| `THE_EYE_SSL_REDIRECT` | HTTP ? HTTPS redirect |

Never commit `.env` or TLS private keys.

## Backup and restore

### Backup PostgreSQL

```bash
bash scripts/backup-the-eye.sh
# or: powershell -File scripts/backup-the-eye.ps1
# writes backups/the_eye_<timestamp>.dump and backups/the_eye_latest.dump
```

Requires `postgres-postgis` running.

### Restore PostgreSQL

```bash
bash scripts/restore-the-eye.sh backups/the_eye_latest.dump --confirm
docker compose -f infra/docker/docker-compose.yml --profile tools run api-migrate
curl -k https://localhost/v1/health/ready
```

Restore is destructive (`--clean`). Stop write traffic during restore.

Object storage (MinIO/S3 evidence) requires separate bucket versioning/backup.

## Validation commands

```bash
pnpm run test:docker:smoke      # compose + nginx + backup script structure
pnpm run test:deploy:env        # .env.example vs compose variables
docker compose -f infra/docker/docker-compose.yml --env-file .env config
docker compose -f infra/docker/docker-compose.yml --env-file .env build
node scripts/validate-api-runtime-image.cjs   # API runtime deps (explicit tag or auto-resolve)
```

### Image tags (do not use `:latest` for deploy)

Compose tags images with `THE_EYE_IMAGE_TAG` (default `local`). Deploy and rollback pin by **commit SHA**. To see what is configured or present on a host:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env images
docker images --filter reference='*the-eye-api*'
```

See [DOCKER_BUILD.md](./DOCKER_BUILD.md#image-tagging-policy) for the full tagging matrix (local, staging, production, CI validate).

## Production topology

- **nginx** ù TLS, rate limits, reverse proxy (ports 80/443)
- **api** ù NestJS API (internal)
- **admin-web** ù Next.js command dashboard (internal)
- **postgres-postgis** ù primary datastore
- **redis** ù queues + rate limiting
- **minio** ù S3-compatible evidence storage
- **livekit** ù emergency live video

Optional profiles:

- `pooling` ù PgBouncer in front of Postgres
- `tools` ù `api-migrate`, `api-seed`
- `certbot` ù certificate issuance helper
- `proxy` (dev overlay) ù expose api/admin directly

## Kubernetes / managed cloud

For managed deployments, mirror the same health endpoints, secrets, and TLS policy. Use ingress TLS instead of compose nginx when running on K8s. See [grafana-dashboard.md](./grafana-dashboard.md) for observability.

**DigitalOcean App Platform (admin-web):** [digitalocean-admin-web.md](./digitalocean-admin-web.md) ù `NEXT_PUBLIC_*` must be supplied as Docker **build-time** variables (`build_env`), not runtime-only App vars.

## Local development overlay

```bash
docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.dev.yml up -d
```

Exposes API `:4000` and admin `:3000` directly; nginx optional via `proxy` profile.
