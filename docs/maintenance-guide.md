# THE EYE Maintenance Guide

**Audience:** DevOps / SRE  
**Scope:** Ongoing operations for production Docker Compose deployment  
**Last updated:** 2026-07-10

---

## Maintenance schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| PostgreSQL logical backup | Daily | Automated (cron / GitHub Actions) |
| Backup off-site copy | Daily | Ops |
| TLS certificate renewal check | Automated (certbot cron) | Ops |
| Health endpoint monitoring | Continuous | Monitoring stack |
| Docker image security updates | Monthly | DevOps |
| OS security patches | Monthly | DevOps |
| DR restore drill | Quarterly | DevOps + DBA |
| k6 scale regression (staging) | Monthly | Performance |
| Secret rotation review | Quarterly | Security |
| Disk usage review | Weekly | Ops |

---

## Daily operations

### Health verification

```bash
curl -fsSk https://<domain>/v1/health/ready
docker compose -f infra/docker/docker-compose.yml ps
```

Expected: all core services `healthy`, readiness JSON shows `database: ok` and `redis: ok`.

### Log review

```bash
# API errors (last hour)
docker compose -f infra/docker/docker-compose.yml logs --since 1h api | grep '"level":"error"'

# nginx 5xx
docker compose -f infra/docker/docker-compose.yml logs --since 1h nginx | grep ' 50[0-9] '
```

### Notification queue

```promql
sum(the_eye_bullmq_queue_depth{queue="notifications", state="waiting"})
```

Alert if waiting depth > 100 for 10 minutes.

---

## Backup procedures

### PostgreSQL

```bash
# Linux
bash scripts/backup-the-eye.sh

# Windows
powershell -File scripts/backup-the-eye.ps1
```

Output:
- `backups/the_eye_<timestamp>.dump`
- `backups/the_eye_latest.dump`

### Automated schedule (cron)

```cron
0 3 * * * cd /opt/the-eye && bash scripts/backup-the-eye.sh >> /var/log/the-eye-backup.log 2>&1
0 4 * * * rsync -a /opt/the-eye/backups/ user@backup-host:/backups/the-eye/
```

### GitHub Actions backup

Workflow `.github/workflows/backup.yml` runs daily at 03:00 UTC when `DEPLOY_*` secrets are configured.

### Retention policy

| Tier | Retention |
|------|-----------|
| Daily dumps | 14 days on host |
| Off-site copies | 90 days |
| Monthly archive | 1 year |

Prune old backups:

```bash
find backups -name 'the_eye_*.dump' -mtime +14 -delete
```

### MinIO / S3 evidence

```bash
docker compose -f infra/docker/docker-compose.yml exec -T minio-init \
  mc mirror local/the-eye /backup/the-eye-evidence
```

Enable bucket versioning on cloud S3. Evidence is **not** included in PostgreSQL dumps.

### Redis

Redis holds BullMQ queue state only. No backup required. After Redis loss, replay failed notifications manually if needed.

---

## TLS certificate maintenance

### Renewal

```bash
bash scripts/renew-letsencrypt.sh
```

Certbot cron (recommended):

```cron
0 3,15 * * * cd /opt/the-eye && bash scripts/renew-letsencrypt.sh >> /var/log/the-eye-certbot.log 2>&1
```

### Expiry monitoring

Alert 14 days before certificate expiry. Manual check:

```bash
openssl x509 -in infra/docker/nginx/certs/live/fullchain.pem -noout -dates
```

---

## Monitoring maintenance

### Prometheus (observability profile)

```bash
echo -n "$METRICS_BEARER_TOKEN" > infra/docker/observability/metrics_token
docker compose -f infra/docker/docker-compose.yml --profile observability up -d prometheus
```

Reload config after changes:

```bash
curl -X POST http://127.0.0.1:9090/-/reload
```

### Key alerts

| Alert | Threshold | Runbook |
|-------|-----------|---------|
| API p95 latency | > 2s for 10m | Check DB pool, Redis, queue depth |
| HTTP 5xx rate | > 2% for 5m | Check API logs, rollback if deploy-related |
| `the_eye_dependency_up{dependency="postgres"}` | == 0 | Check Postgres container, disk space |
| Notification queue waiting | > 100 for 10m | Scale workers / check Redis |
| Disk usage | > 80% | Prune logs, expand volume, archive evidence |

See `docs/grafana-dashboard.md` for PromQL queries.

---

## Routine updates

### Application release

1. Take backup: `bash scripts/backup-the-eye.sh`
2. Deploy: `bash scripts/deploy-production.sh` or GitHub Actions Deploy workflow
3. Verify health endpoints
4. Monitor error rate for 30 minutes

See [production-deployment-guide.md](./production-deployment-guide.md).

### Dependency updates (Docker base images)

```bash
docker compose -f infra/docker/docker-compose.yml pull
docker compose -f infra/docker/docker-compose.yml --env-file .env build --no-cache api admin-web
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
```

Test in staging first. Schedule during low-traffic window.

### OS patches

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot   # if kernel updated — causes ~2 min downtime
```

Use maintenance window. Docker services restart via `restart: unless-stopped`.

---

## Database maintenance

### Connection pooling

For sustained load > 500 concurrent API connections, enable PgBouncer:

```bash
docker compose -f infra/docker/docker-compose.yml --profile pooling up -d
```

Update `DATABASE_URL` to point at `pgbouncer:6432`. See `docs/postgres-scaling.md`.

### Vacuum / analyze

Postgres autovacuum is enabled by default. Monitor bloat:

```sql
SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;
```

### Migration hygiene

Always run migrations before starting new API containers:

```bash
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
```

---

## Log rotation

Docker uses json-file driver by default. Configure in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

Restart Docker daemon after change.

---

## Secret rotation

| Secret | Rotation procedure |
|--------|-------------------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Issue new secrets, deploy API, force re-login (invalidates existing tokens) |
| `REDIS_PASSWORD` | Update `.env`, restart redis + api |
| `POSTGRES_PASSWORD` | Update Postgres user, `.env`, restart all dependent services |
| `METRICS_BEARER_TOKEN` | Update `.env`, `metrics_token` file, restart api + prometheus |
| TLS private key | Re-issue cert, restart nginx |

Always backup before secret rotation. Schedule during maintenance window.

---

## Disk management

Monitor volumes:

```bash
docker system df -v
du -sh /var/lib/docker/volumes/the-eye_*
```

| Volume | Grows with |
|--------|------------|
| `postgres_data` | Incidents, audit, users |
| `minio_data` | Evidence media |
| `redis_data` | Queue state (bounded) |
| `prometheus_data` | Metrics (15d retention) |

Expand disk or archive old evidence to cold storage when > 80% full.

---

## Quarterly DR drill

1. Provision isolated restore environment
2. Restore latest `the_eye_latest.dump`
3. Restore sample MinIO evidence
4. Run `pnpm run test:backend` and `pnpm run test:load:smoke`
5. Record actual RTO/RPO
6. Update `docs/disaster-recovery.md`

---

## Incident response quick reference

| Symptom | First action |
|---------|--------------|
| API 503 on `/health/ready` | `docker compose logs api postgres-postgis redis` |
| All requests 502 | `docker compose logs nginx api` — check nginx config |
| High 429 rate | Expected under load; check rate-limit policy or distribute clients |
| Evidence upload fails | Check MinIO health, S3 credentials, disk space |
| Live video won't connect | Verify UDP 7882 open, `NEXT_PUBLIC_LIVEKIT_URL` correct |
| DB disk full | Emergency backup, prune, expand volume |

Escalation contacts: document outside this repository.

---

## Related documents

- [Production Deployment Guide](./production-deployment-guide.md)
- [Rollback Guide](./rollback-guide.md)
- [Disaster Recovery](./disaster-recovery.md)
- [Grafana Dashboard](./grafana-dashboard.md)
- [Performance Benchmark Report](./performance-benchmark-report.md)
