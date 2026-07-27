# THE EYE Disaster Recovery

This runbook covers recovery for the Docker Compose deployment in `infra/docker/`. Adapt hostnames, credentials, and storage backends for managed cloud environments.

## Recovery Objectives

| Tier | RPO target | RTO target | Scope |
|------|------------|----------|-------|
| PostgreSQL | 15 minutes (with WAL/PITR) | 60 minutes | Incidents, users, audit chain, communities |
| Object storage (MinIO/S3) | 24 hours | 120 minutes | Evidence media, generated reports |
| Redis | Best effort | 30 minutes | Queue state only; not authoritative |

## Backup Procedures

### PostgreSQL

From the repository root:

```bash
bash scripts/backup-the-eye.sh \
  --compose-file infra/docker/docker-compose.yml \
  --env-file .env \
  --output-dir backups
```

The script streams `pg_dump --format=custom` to the host, validates the archive with `pg_restore --list`, writes a SHA-256 metadata manifest, and applies retention only after a successful validated backup. It never prints environment secrets.

Manual one-liner (must include `--env-file` when the stack was started with it):

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env exec -T postgres-postgis \
  pg_dump -U the_eye -Fc the_eye > backups/the_eye_$(date +%Y%m%d_%H%M%S).dump
```

Recommended production schedule:
- Full logical backup daily
- WAL archiving or managed point-in-time recovery enabled
- Off-site copy in a separate region/account (planned — not yet activated; see Off-site copy plan below)

### Isolated restore drill (staging)

The restore drill validates a backup in a **temporary PostGIS container** with its own network and volume. It never modifies the live staging or production database.

```bash
bash scripts/backup-the-eye.sh \
  --compose-file infra/docker/docker-compose.yml \
  --env-file .env \
  --output-dir backups \
  --with-restore-drill
```

Or run the drill against an existing archive:

```bash
bash scripts/backup-restore-drill.sh \
  --backup-file backups/the-eye-staging-latest.dump \
  --metadata-path backups/the-eye-staging-latest.json \
  --compose-file infra/docker/docker-compose.yml \
  --env-file .env
```

The drill creates `the_eye_drill`, pre-creates PostGIS extensions from the archive, runs `pg_restore` via `docker exec` (PostgreSQL remains PID 1), compares representative table counts against the live database (read-only), and captures diagnostics on failure.

## Off-site copy plan (not yet activated)

When approved credentials and bucket policy are available:

| Control | Requirement |
|---------|-------------|
| Destination | Private DigitalOcean Spaces (or approved object storage) in a separate account/region |
| Transfer | Encrypted upload (`s3cmd`/`rclone` with SSE); checksum verified after upload |
| Identity | Restricted service account; no production DB credentials in object metadata |
| Retention | Bucket lifecycle aligned with on-host retention; versioning enabled |
| Immutability | Object lock / WORM where available for daily full backups |
| Monitoring | Alert on upload failure; monthly restore-from-off-site drill |
| Gate | Pre-deploy backup gate remains disabled until on-host backup, archive validation, isolated restore drill, and first off-site upload all pass repeatedly |

Database backup readiness is **not complete** while all copies remain on a single VPS.

### Object storage (MinIO / S3)

```bash
docker compose -f infra/docker/docker-compose.yml exec -T minio-init \
  mc mirror local/the-eye /backup/the-eye
```

For AWS S3, enable versioning and lifecycle rules on the evidence bucket.

### Redis

Redis holds BullMQ job state. Rebuild queues after Redis loss; do not treat Redis as a system of record.

## Restore Procedures

### PostgreSQL restore

```bash
bash scripts/restore-the-eye.sh backups/the_eye_latest.dump --confirm
```

Manual restore into a fresh database:

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres-postgis \
  pg_restore -U the_eye -d the_eye --clean --if-exists < backups/the_eye_latest.dump
```

After restore:
1. `pnpm --filter @the-eye/api exec prisma migrate deploy`
2. `pnpm --filter @the-eye/api exec prisma db seed` (optional, idempotent for keyed seed rows)
3. Verify `GET /v1/health/ready`

### Object storage restore

```bash
docker compose -f infra/docker/docker-compose.yml exec -T minio-init \
  mc mirror /backup/the-eye local/the-eye
```

## Environment Recovery Checklist

1. Provision Postgres, Redis, object storage, and LiveKit endpoints
2. Restore `.env` secrets from your secret manager (never from git)
3. Run database restore
4. Run `prisma migrate deploy`
5. Restore object storage bucket contents
6. Start stack: `docker compose -f infra/docker/docker-compose.yml up -d --wait`
7. Confirm:
   - `GET /v1/health` → 200
   - `GET /v1/health/ready` → 200 with `database: ok`
   - Admin login works
   - Evidence presign + confirm flow works
8. Replay failed notification jobs if Redis was lost

## Quarterly Drill

1. Restore latest Postgres backup into an isolated environment
2. Restore a sample of evidence objects
3. Run backend tests and smoke tests
4. Record actual RTO/RPO and update this document

## Contacts and Escalation

Document on-call ownership, cloud account IDs, and secret manager locations outside this repository.
