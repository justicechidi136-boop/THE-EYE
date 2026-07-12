# THE EYE Rollback Guide

**Audience:** DevOps / on-call engineers  
**Scope:** Docker Compose production deployment  
**Last updated:** 2026-07-10

Use this guide when a deployment introduces regressions, failed migrations, or unacceptable error rates. Goal: restore the last known-good release with minimal data loss.

---

## When to rollback

| Signal | Action |
|--------|--------|
| API `/v1/health/ready` failing after deploy | Rollback application images immediately |
| 5xx rate > 5% for 5 minutes | Rollback application tier |
| Failed `prisma migrate deploy` | **Do not** leave partial migration — see [Migration rollback](#database-migration-rollback) |
| Admin login broken | Rollback `api` + `admin-web` |
| nginx config error (502/504) | Rollback nginx snippet or previous compose revision |
| Data corruption suspected | Stop writes, restore from backup — see [disaster-recovery.md](./disaster-recovery.md) |

---

## Rollback decision tree

```
Deploy failed?
├── Health checks fail → Roll back app images (Section 1)
├── Migration failed → Assess migration (Section 2)
├── nginx broken → Restore nginx config (Section 3)
└── Data issue → Stop traffic + DB restore (Section 4)
```

---

## Section 1 — Application image rollback (fastest)

**RTO target:** 5–15 minutes  
**Data impact:** None (schema unchanged)

### If using Git + local build

```bash
cd /opt/the-eye

# Identify last good commit
git log --oneline -10
export ROLLBACK_SHA=<last-good-commit>

git checkout "$ROLLBACK_SHA"
export THE_EYE_IMAGE_TAG="$ROLLBACK_SHA"

docker compose -f infra/docker/docker-compose.yml --env-file .env build api admin-web
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d api admin-web
docker compose -f infra/docker/docker-compose.yml --env-file .env restart nginx
```

### If using GHCR images

```bash
export THE_EYE_IMAGE_TAG=<previous-tag>
docker compose -f infra/docker/docker-compose.yml --env-file .env pull api admin-web
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d api admin-web
```

### Verify

```bash
curl -fsSk https://localhost/v1/health/ready
docker compose -f infra/docker/docker-compose.yml ps api admin-web
```

### GitHub Actions rollback

1. Actions → **Deploy** → Run workflow
2. Set `image_tag` to the previous known-good SHA
3. Set `run_migrations` to **false** (unless rolling forward a fix)
4. Monitor health endpoints after completion

---

## Section 2 — Database migration rollback

**Prisma migrations are forward-only.** There is no automatic `migrate down` in production.

### Failed migration mid-deploy

1. **Stop write traffic** — scale api to 0 or block at nginx:

   ```bash
   docker compose -f infra/docker/docker-compose.yml stop api admin-web
   ```

2. Inspect migration state:

   ```bash
   docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate \
     npx prisma migrate status
   ```

3. Options:

   | Situation | Action |
   |-----------|--------|
   | Migration never committed | Fix migration SQL, redeploy fixed version |
   | Migration partially applied | Manual SQL fix + mark migration resolved, **or** restore DB backup |
   | Breaking schema change | Restore DB from pre-deploy backup |

4. After resolution:

   ```bash
   docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
   docker compose -f infra/docker/docker-compose.yml --env-file .env up -d api admin-web
   ```

### Pre-deploy safety

Always take a backup before migrations:

```bash
bash scripts/backup-the-eye.sh
```

---

## Section 3 — nginx / TLS rollback

### Bad nginx snippet or template

```bash
cd /opt/the-eye
git checkout <last-good> -- infra/docker/nginx/
docker compose -f infra/docker/docker-compose.yml restart nginx
docker compose -f infra/docker/docker-compose.yml exec nginx nginx -t
```

### Certificate regression

Restore previous certs from backup:

```bash
cp /backup/certs/fullchain.pem infra/docker/nginx/certs/live/fullchain.pem
cp /backup/certs/privkey.pem infra/docker/nginx/certs/live/privkey.pem
chmod 600 infra/docker/nginx/certs/live/privkey.pem
docker compose -f infra/docker/docker-compose.yml restart nginx
```

---

## Section 4 — Full database restore rollback

**Use when:** data corruption, failed migration with no forward fix, or accidental destructive operation.

**RTO target:** 60 minutes (see disaster-recovery.md)

1. Stop application tier:

   ```bash
   docker compose -f infra/docker/docker-compose.yml stop api admin-web nginx
   ```

2. Restore from pre-deploy backup:

   ```bash
   bash scripts/restore-the-eye.sh backups/the_eye_latest.dump --confirm
   ```

3. Re-run migrations (if rolling back app to newer code on older DB):

   ```bash
   docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
   ```

4. Restart stack:

   ```bash
   docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
   ```

5. Verify audit chain and critical flows:

   ```bash
   curl -fsSk https://localhost/v1/health/ready
   # Admin login, incident list, evidence presign
   ```

**Data loss:** Any transactions after the backup timestamp are lost. Communicate RPO to stakeholders.

---

## Section 5 — Configuration rollback

If only `.env` changed:

```bash
cp .env.backup-<date> .env
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
```

Keep dated `.env` backups before every production change (never in git).

---

## Communication template

```
INCIDENT: THE EYE production rollback
TIME: <UTC timestamp>
REASON: <brief description>
ACTION: Rolled back api/admin-web to tag <SHA>
DATA IMPACT: <none | backup restore with RPO ~X minutes>
STATUS: Monitoring / resolved
NEXT: Root cause analysis within 24h
```

---

## Post-rollback checklist

- [ ] `/v1/health/ready` → 200
- [ ] Admin login works
- [ ] Error rate normalized (< 1% excluding 429)
- [ ] Notification queue draining
- [ ] Incident submission smoke-tested
- [ ] Stakeholders notified
- [ ] Post-mortem scheduled
- [ ] Forward fix planned on a branch (not hot-patched on prod)

---

## Related documents

- [Production Deployment Guide](./production-deployment-guide.md)
- [Maintenance Guide](./maintenance-guide.md)
- [Disaster Recovery](./disaster-recovery.md)
