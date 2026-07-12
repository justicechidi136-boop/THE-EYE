# THE EYE Production Deployment Guide

**Audience:** DevOps / platform engineers  
**Stack:** Docker Compose on Ubuntu VPS (or equivalent Linux host)  
**Last updated:** 2026-07-10

This guide walks through a first-time production deployment of THE EYE — public safety platform with API, admin dashboard, Postgres/PostGIS, Redis, MinIO, LiveKit, and nginx TLS termination.

---

## Prerequisites

| Requirement | Minimum |
|-------------|---------|
| Host OS | Ubuntu 22.04+ LTS (or Debian 12+) |
| CPU / RAM | 4 vCPU, 8 GB RAM (16 GB recommended) |
| Disk | 100 GB SSD (evidence media grows quickly) |
| Docker | Engine 24+ and Compose v2 |
| DNS | `A` record → VPS public IP for `THE_EYE_SERVER_NAME` |
| Firewall | Ports 80, 443, 7881/tcp, 7882/udp open to internet |

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

---

## Architecture overview

```
Internet
   │
   ▼
nginx :443 (TLS, rate limits)
   ├── /          → admin-web :3000
   ├── /v1/       → api :4000
   └── /livekit/  → livekit :7880

Internal network (the-eye-internal)
   ├── postgres-postgis :5432
   ├── redis :6379
   ├── minio :9000
   └── livekit (RTC :7881/:7882 exposed for WebRTC)
```

Optional profiles:

| Profile | Services |
|---------|----------|
| `pooling` | PgBouncer |
| `observability` | Prometheus |
| `certbot` | Let's Encrypt helper |
| `tools` | `api-migrate`, `api-seed` (seed = non-prod only) |

---

## Step 1 — Clone and configure secrets

```bash
git clone <repository-url> /opt/the-eye
cd /opt/the-eye
cp .env.example .env
chmod 600 .env
```

Edit `.env` and replace **every** `change_me*` value. Required variables are validated by `pnpm run test:deploy:env` and enforced in `docker-compose.yml` via `${VAR:?}` syntax.

### Critical production values

| Variable | Guidance |
|----------|----------|
| `POSTGRES_PASSWORD` | ≥ 24 random characters |
| `REDIS_PASSWORD` | ≥ 24 random characters |
| `MINIO_ROOT_PASSWORD` | ≥ 24 random characters |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 random characters each |
| `LIVE_LOCATION_LINK_SECRET` | ≥ 32 random characters |
| `METRICS_BEARER_TOKEN` | ≥ 32 random characters |
| `CORS_ORIGINS` | `https://<your-domain>` only |
| `THE_EYE_SERVER_NAME` | Public hostname (e.g. `admin.theeye.ng`) |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://<your-domain>/livekit` |
| `ENABLE_SWAGGER` | `false` |
| `ALLOW_DEV_AUTH_CODES` | `false` |

Store secrets in a password manager or cloud secret manager. **Never commit `.env`.**

Validate configuration:

```bash
pnpm run test:deploy:env
docker compose -f infra/docker/docker-compose.yml --env-file .env config
```

---

## Step 2 — TLS / HTTPS

### Option A — Let's Encrypt (recommended)

1. Start nginx with HTTP only (certificates not required yet):

   ```env
   THE_EYE_SSL_REDIRECT=false
   THE_EYE_GENERATE_DEV_SSL=false
   ```

2. Start the stack (Step 3) so port 80 serves ACME challenges.

3. Issue certificates:

   ```bash
   export THE_EYE_SERVER_NAME=admin.theeye.ng
   export CERTBOT_EMAIL=ops@theeye.ng
   bash scripts/issue-letsencrypt.sh
   ```

4. Enable HTTPS redirect:

   ```env
   THE_EYE_SSL_REDIRECT=true
   ```

5. Restart nginx:

   ```bash
   docker compose -f infra/docker/docker-compose.yml --env-file .env restart nginx
   ```

6. Schedule renewal (cron, twice daily):

   ```cron
   0 3,15 * * * cd /opt/the-eye && bash scripts/renew-letsencrypt.sh >> /var/log/the-eye-certbot.log 2>&1
   ```

### Option B — Staging self-signed (not for production)

```bash
powershell -File scripts/generate-dev-ssl.ps1 -ServerName localhost
# or set THE_EYE_GENERATE_DEV_SSL=true (development only)
```

---

## Step 3 — Deploy the stack

### Automated (Linux)

```bash
bash scripts/deploy-production.sh
```

### Manual

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env build
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-migrate
```

**Do not run `api-seed` in production** unless you understand the idempotent seed data implications.

### Optional: connection pooling

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile pooling up -d
```

Point `DATABASE_URL` at PgBouncer (see `docs/postgres-scaling.md`). Keep `DATABASE_DIRECT_URL` on Postgres for migrations.

### Optional: Prometheus monitoring

```bash
echo -n "$METRICS_BEARER_TOKEN" > infra/docker/observability/metrics_token
chmod 600 infra/docker/observability/metrics_token
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile observability up -d
```

Prometheus UI: `http://127.0.0.1:9090` (localhost only). See `docs/grafana-dashboard.md`.

---

## Step 4 — Verify deployment

| Check | Command | Expected |
|-------|---------|----------|
| Nginx liveness | `curl -fsS http://localhost/healthz` | `ok` |
| API liveness | `curl -fsSk https://localhost/v1/health` | `200` JSON |
| API readiness | `curl -fsSk https://localhost/v1/health/ready` | `200`, `database: ok`, `redis: ok` |
| Admin UI | Browser → `https://<domain>/` | Login page |
| TLS | `curl -vI https://<domain>/` | Valid certificate, HSTS header |
| Metrics (internal) | `curl -H "Authorization: Bearer $TOKEN" http://api:4000/metrics` | Prometheus text |

Container health:

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

All services should show `healthy` (LiveKit may show `started`).

---

## Step 5 — GitHub Actions CD (optional)

Configure GitHub repository secrets:

| Secret | Purpose |
|--------|---------|
| `DEPLOY_HOST` | VPS IP or hostname |
| `DEPLOY_USER` | SSH user (e.g. `deploy`) |
| `DEPLOY_SSH_KEY` | Private key for deploy user |
| `DEPLOY_PATH` | Repo path on server (e.g. `/opt/the-eye`) |
| `SMOKE_BASE_URL` | Public URL for post-deploy checks (optional) |

Create GitHub Environments `production` and `staging` with protection rules.

Deploy manually from Actions → **Deploy** workflow → `workflow_dispatch`.

CI pipeline (`.github/workflows/ci.yml`) runs on every push/PR: lint, test, build, Docker image build.

Scheduled backups: `.github/workflows/backup.yml` (daily 03:00 UTC).

---

## Step 6 — Firewall hardening

```bash
sudo ufw default deny incoming
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7881/tcp    # LiveKit RTC
sudo ufw allow 7882/udp    # LiveKit RTC
sudo ufw enable
```

Postgres, Redis, MinIO, and Prometheus bind to `127.0.0.1` only — not exposed publicly.

---

## Health checks reference

| Service | Probe | Interval |
|---------|-------|----------|
| postgres-postgis | `pg_isready` | 10s |
| redis | `redis-cli ping` | 10s |
| minio | `/minio/health/live` | 15s |
| api | `GET /v1/health/ready` | 30s |
| admin-web | `GET /` status < 500 | 30s |
| nginx | `GET /healthz` | 30s |

Services start in order: data stores → api → admin-web → nginx.

---

## Logging

| Component | Output | Format |
|-----------|--------|--------|
| API | Docker stdout | JSON (`requestId`, method, path, status, durationMs) |
| nginx | Container logs | Combined access + error |
| LiveKit | Container stdout | Text (`info` level) |

View logs:

```bash
docker compose -f infra/docker/docker-compose.yml logs -f api nginx
```

Forward to your log stack (Loki, CloudWatch, Datadog) via Docker logging driver or a log shipper sidecar.

---

## Monitoring

- **Prometheus metrics** at `GET /metrics` (bearer token required; nginx returns 403 publicly)
- **Grafana panels** — see `docs/grafana-dashboard.md`
- **Key alerts:** API p95 latency, 5xx rate, notification queue depth, `the_eye_dependency_up`

---

## Database backups

Before go-live, take a baseline backup:

```bash
bash scripts/backup-the-eye.sh
# → backups/the_eye_<timestamp>.dump
```

Schedule daily backups and off-site copy. See `docs/maintenance-guide.md`.

---

## Disaster recovery

See `docs/disaster-recovery.md` for RPO/RTO targets and restore procedures.

---

## Post-deployment checklist

- [ ] All `change_me*` values replaced
- [ ] `THE_EYE_SSL_REDIRECT=true` with valid TLS certs
- [ ] `ENABLE_SWAGGER=false`, `ALLOW_DEV_AUTH_CODES=false`
- [ ] `CORS_ORIGINS` matches production HTTPS origin
- [ ] `api-migrate` completed successfully
- [ ] `/v1/health/ready` returns 200
- [ ] Admin login works
- [ ] Incident report + evidence upload smoke-tested
- [ ] Backup script tested and scheduled
- [ ] Certbot renewal cron configured
- [ ] Firewall rules applied
- [ ] On-call contacts documented outside the repo

---

## Related documents

- [Rollback Guide](./rollback-guide.md)
- [Maintenance Guide](./maintenance-guide.md)
- [Disaster Recovery](./disaster-recovery.md)
- [Grafana Dashboard](./grafana-dashboard.md)
- [Load Testing](./load-testing.md)
- [Security Audit Report](./security-audit-report.md)
