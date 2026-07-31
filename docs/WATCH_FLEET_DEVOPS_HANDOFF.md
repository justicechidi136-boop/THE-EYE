# Watch Fleet Production Hardening — DevOps Deployment Handoff

**Release branch:** `feat/watch-fleet-production-hardening`  
**Commit SHA:** `56969727f965d42533536dc69338a46490882816`  
**Prepared for:** DevOps / Platform Engineering  
**Date:** 2026-07-31

---

## 1. Deployment overview

This release adds watch fleet ownership/fleet management (PR #64 baseline), production hardening (SQL aggregates, async exports, BullMQ bulk jobs, replacement workflow), and **S3-backed export storage** with signed download URLs and retention cleanup.

**Processes required in staging/production:**

| Process | Image | Purpose |
|---------|-------|---------|
| API | `the-eye-api:<tag>` | HTTP API, enqueues export/bulk jobs |
| Worker | `the-eye-api:<tag>` (same image, different CMD) | BullMQ processors + export cleanup scheduler |

Watch fleet export/bulk processors run inside the existing **notification-worker** process via `WatchFleetWorkerModule` (no separate container required, but worker must be running).

---

## 2. Required environment variables

### Core (existing — must remain set)

| Variable | Staging | Production | Notes |
|----------|---------|------------|-------|
| `THE_EYE_APP_ENV` | `staging` | `production` | Drives queue names, Firebase guards |
| `NODE_ENV` | `production` | `production` | |
| `DATABASE_URL` | required | required | Pooled URL if using PgBouncer |
| `DATABASE_DIRECT_URL` | required | required | Direct Postgres for migrations |
| `REDIS_HOST` | required | required | |
| `REDIS_PORT` | `6379` | `6379` | |
| `REDIS_PASSWORD` | required | required | ≥24 chars in production |
| `REDIS_DB` | `0` | `0` | Optional |
| `REDIS_TLS` | `true` if managed Redis | `true` if managed Redis | |
| `THE_EYE_DISABLE_REDIS` | **`0`** | **`0`** | Must not be `1` in staging/prod |
| `BULLMQ_PREFIX` | optional | optional | Default: `the-eye-{THE_EYE_APP_ENV}` |
| `JWT_ACCESS_SECRET` | required | required | ≥24 chars in production |
| `JWT_REFRESH_SECRET` | required | required | ≥24 chars in production |
| `METRICS_BEARER_TOKEN` | required | required | ≥24 chars in production |
| `CORS_ORIGINS` | required | required | Comma-separated admin origins |
| `FCM_PROJECT_ID` | `the-eye-2stg` | `the-eye-2pd-d0217` | |
| `FIREBASE_PROJECT_ID` | must match FCM | must match FCM | |

### Evidence / general S3 (existing)

| Variable | Required | Notes |
|----------|----------|-------|
| `S3_ENDPOINT` | yes (prod) | e.g. `https://nyc3.digitaloceanspaces.com` |
| `S3_BUCKET` | yes (prod) | General evidence bucket |
| `S3_ACCESS_KEY` | yes (prod) | |
| `S3_SECRET_KEY` | yes (prod) | Secret — ≥24 chars in production |
| `S3_REGION` | recommended | Default `us-east-1` |

### Watch fleet — NEW (required for staging/production)

| Variable | Staging recommended | Production required | Default | Notes |
|----------|---------------------|---------------------|---------|-------|
| `WATCH_FLEET_BULK_MODE` | `queue` | `queue` | `queue` | **`inline` forbidden** in staging/prod |
| `WATCH_EXPORT_STORAGE_PROVIDER` | `s3` | **`s3`** | `local` | Prod **fails startup** if `local` |
| `WATCH_EXPORT_S3_ENDPOINT` | optional | optional | falls back to `S3_ENDPOINT` | |
| `WATCH_EXPORT_S3_REGION` | optional | optional | falls back to `S3_REGION` | |
| `WATCH_EXPORT_S3_BUCKET` | optional | **recommended dedicated bucket** | falls back to `S3_BUCKET` | |
| `WATCH_EXPORT_S3_ACCESS_KEY_ID` | optional | optional | falls back to `S3_ACCESS_KEY` | |
| `WATCH_EXPORT_S3_SECRET_ACCESS_KEY` | optional | optional | falls back to `S3_SECRET_KEY` | Secret |
| `WATCH_EXPORT_S3_FORCE_PATH_STYLE` | `false` | `true` for MinIO/some DO setups | `false` | |
| `WATCH_EXPORT_SIGNED_URL_TTL_SECONDS` | `900` | `900` | `900` | 60–3600 allowed |
| `WATCH_EXPORT_RETENTION_HOURS` | `24` | `24` | `24` | Export job + object TTL |
| `WATCH_EXPORT_ALLOW_LOCAL_IN_PRODUCTION` | unset | **`0` / unset** | — | Emergency override only |

### Worker flag

| Variable | Value | Where |
|----------|-------|-------|
| `THE_EYE_RUN_NOTIFICATION_WORKER` | `1` | Worker container only (set automatically by `dist/worker.js`) |

---

## 3. Required secrets (secret manager)

Store in vault / GitHub Environment secrets / K8s secrets — **never** in git:

| Secret | Used by |
|--------|---------|
| `DATABASE_URL` | API + worker |
| `DATABASE_DIRECT_URL` | migrate job |
| `REDIS_PASSWORD` | API + worker |
| `JWT_ACCESS_SECRET` | API + worker |
| `JWT_REFRESH_SECRET` | API |
| `S3_SECRET_KEY` | API + worker (evidence + export fallback) |
| `WATCH_EXPORT_S3_SECRET_ACCESS_KEY` | API + worker (if dedicated export credentials) |
| `FCM_PRIVATE_KEY` | API + worker |
| `METRICS_BEARER_TOKEN` | API |
| `LIVEKIT_API_SECRET` | API (production validation) |
| `LIVE_LOCATION_LINK_SECRET` | API |

**Do not log:** access keys, secret keys, presigned URLs, export file contents, full IMEI/EID, phone numbers, emails.

---

## 4. Redis requirements

- **Mandatory** in staging and production (`THE_EYE_DISABLE_REDIS=0`).
- Used for BullMQ job queues, broadcast scheduler heartbeats, notification worker heartbeats.
- **Connection:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, optional `REDIS_DB`, optional `REDIS_TLS`.
- **Prefix:** `BULLMQ_PREFIX` or default `the-eye-staging` / `the-eye-production`.
- **Sizing:** export jobs are I/O-bound; ensure Redis memory headroom for queue metadata. Large exports stream to S3 — payloads are job IDs only, not CSV bodies.
- **Persistence:** AOF/RDB recommended so queued export jobs survive Redis restart.

---

## 5. BullMQ requirements

### Queues (watch fleet)

| Queue name pattern | Job type | Producer | Consumer |
|--------------------|----------|----------|----------|
| `the-eye-{env}-watch-fleet-export` | `process-export` | API (`WatchExportService`) | Worker (`WatchFleetExportProcessor`) |
| `the-eye-{env}-watch-fleet-bulk` | bulk operations | API (`WatchBulkService`) | Worker (`WatchFleetBulkProcessor`) |

Example staging: `the-eye-staging-watch-fleet-export`

### Configuration rules

- `WATCH_FLEET_BULK_MODE=queue` (default) — bulk/export enqueue to BullMQ.
- `WATCH_FLEET_BULK_MODE=required` — fails startup if Redis disabled.
- `WATCH_FLEET_BULK_MODE=inline` — **blocked** in staging/production at startup.
- API registers queues when Redis enabled; worker must run `WatchFleetWorkerModule` processors.
- Export job ID = BullMQ `jobId` = `watch_export_jobs.id` (UUID).

### Worker modules loaded (`dist/worker.js`)

- Notifications, Broadcasts, Location retry, Voice transcription, Watch danger alerts, **Watch fleet (bulk + export + cleanup)**.

---

## 6. Startup commands

### API container

```bash
node --require ./src/preload-env.cjs dist/main.js
```

Dockerfile default / compose:

```yaml
command: ["node", "--require", "./src/preload-env.cjs", "dist/main.js"]
```

Package script: `pnpm --filter @the-eye/api run start:prod`

### Worker container (same image)

```bash
node --require ./src/preload-env.cjs dist/worker.js
```

Compose (`notification-worker` service):

```yaml
command: ["node", "--require", "./src/preload-env.cjs", "dist/worker.js"]
environment:
  THE_EYE_RUN_NOTIFICATION_WORKER: "1"
  THE_EYE_DISABLE_REDIS: "0"
  # ... all Redis, DB, S3, WATCH_EXPORT_* vars same as API
```

Package script: `pnpm --filter @the-eye/api run start:worker`

### Pre-start (migrate job — tools image or CI)

```bash
cd /app   # or apps/api in monorepo
pnpm prisma:deploy
# or: npx prisma migrate deploy
```

Tools Dockerfile target: `apps/api/Dockerfile` target `tools`.

---

## 7. Migration order

Run **`prisma migrate deploy`** — applies pending migrations in timestamp order.

**Watch fleet migrations (must be applied before enabling exports):**

| Order | Migration | Purpose |
|-------|-----------|---------|
| 1 | `20260731120000_watch_ownership_fleet` | Ownership columns, org tables, bulk jobs, history |
| 2 | `20260731180000_watch_fleet_production_hardening` | `watch_export_jobs`, partial indexes |

All prior migrations in `apps/api/prisma/migrations/` must already be applied on the target database.

**Verify:**

```bash
pnpm --filter @the-eye/api exec prisma migrate status
```

```sql
SELECT migration_name, finished_at FROM _prisma_migrations
WHERE migration_name LIKE '%watch%'
ORDER BY finished_at;
```

---

## 8. Index creation order

### Small / staging DB (<500k `smartwatch_devices`)

Indexes created automatically by migration `20260731180000` via standard `CREATE INDEX`.

### Large production DB (≥500k rows)

**Do not rely on blocking index build inside migration transaction.**

1. Deploy API + worker code (safe without indexes — slower queries).
2. Apply migration for **`watch_export_jobs`** table (empty table — fast).
3. For **`smartwatch_devices`** partial indexes, run **one at a time**, **outside a transaction**:

```sql
-- 1
CREATE INDEX CONCURRENTLY IF NOT EXISTS smartwatch_devices_replacement_pending_idx
  ON smartwatch_devices (ownership_status)
  WHERE ownership_status = 'REPLACEMENT_PENDING';

-- 2
CREATE INDEX CONCURRENTLY IF NOT EXISTS smartwatch_devices_low_battery_idx
  ON smartwatch_devices (battery_level)
  WHERE battery_level IS NOT NULL AND battery_level <= 20;

-- 3
CREATE INDEX CONCURRENTLY IF NOT EXISTS smartwatch_devices_active_online_idx
  ON smartwatch_devices (is_online, last_seen_at)
  WHERE ownership_status NOT IN ('RETIRED', 'LOST_OR_STOLEN');
```

4. Verify validity (see `docs/WATCH_FLEET_INDEX_DEPLOYMENT.md`).

**Export job indexes** (on new table — no CONCURRENTLY needed):

- `watch_export_jobs_status_created_at_idx`
- `watch_export_jobs_requested_by_admin_id_idx`
- `watch_export_jobs_correlation_id_idx`
- `watch_export_jobs_expires_at_idx`

---

## 9. S3 configuration requirements

### Production

- `WATCH_EXPORT_STORAGE_PROVIDER=s3` (**required**).
- Dedicated bucket recommended: e.g. `the-eye-watch-exports-staging` / `the-eye-watch-exports-prod`.
- Bucket must be **private** — no public ACL, no public bucket policy.
- Block public access enabled.
- Object lifecycle optional (app cleanup handles retention; lifecycle rule is belt-and-suspenders).

### Object key layout

```
watch-fleet-exports/{environment}/{year}/{month}/{jobId}.csv
```

Example: `watch-fleet-exports/staging/2026/07/550e8400-e29b-41d4-a716-446655440000.csv`

No PII in keys.

### Upload behavior

- CSV built in 500-row DB batches (bounded memory).
- Temp file → S3 PUT (single upload) or multipart if ≥100MB.
- DB stores: `storage_key`, `storage_provider`, `bucket`, `content_type`, `checksum`, `file_size_bytes` — **not** presigned URLs.

### DigitalOcean Spaces

```
WATCH_EXPORT_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
WATCH_EXPORT_S3_REGION=us-east-1
WATCH_EXPORT_S3_FORCE_PATH_STYLE=false
```

### MinIO (local compose)

```
WATCH_EXPORT_S3_ENDPOINT=http://minio:9000
WATCH_EXPORT_S3_FORCE_PATH_STYLE=true
```

---

## 10. Required IAM / bucket permissions

Minimum S3 policy for export service account (adjust ARNs):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WatchFleetExportObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::the-eye-watch-exports-prod/watch-fleet-exports/*"
    },
    {
      "Sid": "WatchFleetExportListBucketMultipart",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": "arn:aws:s3:::the-eye-watch-exports-prod"
    }
  ]
}
```

**Not required:** `s3:GetBucketPolicy`, public read, ACL write.

For AWS IAM user/role used by the API: same actions on the export bucket prefix.

---

## 11. Rollback procedure

### Application rollback

1. Deploy previous API/worker image tag.
2. Previous build without watch fleet routes still works if migrations not applied; **if migrations applied**, older code may error on new columns — prefer forward fix.

### Migration rollback (destructive — avoid in prod)

Only if export feature never used:

```sql
DROP TABLE IF EXISTS watch_export_jobs;
-- Partial indexes (if created):
DROP INDEX CONCURRENTLY IF EXISTS smartwatch_devices_replacement_pending_idx;
DROP INDEX CONCURRENTLY IF EXISTS smartwatch_devices_low_battery_idx;
DROP INDEX CONCURRENTLY IF EXISTS smartwatch_devices_active_online_idx;
```

Ownership migration rollback is **high risk** (data loss) — do not roll back `20260731120000` in production without DBA sign-off.

### Feature flags (soft disable)

- Cannot disable via env once deployed — exports exposed at `/v1/watch-fleet/exports`.
- Emergency: revoke admin `user:manage` permission or block route at ingress.

### S3 cleanup after rollback

List and delete orphaned prefix:

```bash
aws s3 rm s3://BUCKET/watch-fleet-exports/ --recursive
```

---

## 12. Health check endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /v1/health` | none | Liveness — always 200 |
| `GET /v1/health/ready` | none | Readiness — DB, Redis, queues, schema |
| `GET /metrics` | Bearer `METRICS_BEARER_TOKEN` | Prometheus scrape |

Docker HEALTHCHECK hits: `http://127.0.0.1:4000/v1/health/ready`

**Ready check includes (staging/prod):**

- `database: ok`
- `redis: ok`
- `notificationQueue: ok`
- `locationRetryQueue: ok`
- `schemaCompatibility: ok`

**Note:** Watch fleet queues are **not** yet in `/health/ready` — verify separately (section 15).

---

## 13. Smoke-test checklist

Deploy to staging, then:

- [ ] `GET /v1/health` → 200
- [ ] `GET /v1/health/ready` → 200, `redis: ok`
- [ ] `prisma migrate status` → all applied including `20260731180000`
- [ ] Worker container running, Redis heartbeats present
- [ ] Admin login → Fleet → Owner summaries load (<2s on staging data)
- [ ] Inventory pagination returns consistent page sizes with geography filter
- [ ] **Small export** (≤500 devices): request → READY → signed URL download
- [ ] CSV opens; IMEI/EID masked for non-privileged admin
- [ ] Object visible in S3 bucket at expected key path
- [ ] Signed URL expires after TTL (re-request returns new URL)
- [ ] **Bulk job** (≤25 devices staging test): queue → complete
- [ ] Replacement Pending filter shows badge in admin UI
- [ ] Metrics: `the_eye_watch_exports_total` increments

---

## 14. Expected logs

### API (structured JSON via Nest Logger)

```
{"component":"watch-export","event":"signed_url_issued","exportJobId":"...","storageProvider":"s3",...}
```

Audit table entries:

- `watch.export.requested`
- `watch.export.download_issued`
- `watch.export.cancelled`

### Worker — export processor

- Job start: BullMQ `process-export` for job ID
- On success: `{"component":"watch-export","event":"export_completed","rows":N,"bytes":N,"storageProvider":"s3"}`
- On failure: job status `FAILED`, `failure_reason` in DB

### Worker — cleanup (every 15 min)

```
{"component":"watch-export","event":"cleanup_cycle_complete","reason":"interval","processed":N}
{"component":"watch-export","event":"export_cleaned_up","exportJobId":"...","storageKey":"..."}
```

### Startup warnings (staging only)

```
WatchExportStorageConfig - Watch export storage is using local disk in staging...
```

### Startup failures (misconfiguration)

```
WATCH_EXPORT_STORAGE_PROVIDER=local is not allowed in production...
WATCH_EXPORT_STORAGE_PROVIDER=s3 requires WATCH_EXPORT_S3_* ...
Watch fleet bulk operations require Redis in staging and production
```

**Never expect in logs:** secrets, presigned URL full query strings, export CSV content.

---

## 15. Queue verification commands

Replace `{env}` with `staging` or `production`, `{prefix}` with `the-eye-{env}`.

### Redis CLI

```bash
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD --no-auth-warning

# List BullMQ keys for export queue
KEYS *watch-fleet-export*

# Queue depth (BullMQ 5.x key layout — verify prefix)
LLEN bull:{prefix}:the-eye-{env}-watch-fleet-export:wait
```

### Inspect via API (after admin JWT)

```bash
# Request export
curl -s -X POST "$API/v1/watch-fleet/exports" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# Poll status
curl -s "$API/v1/watch-fleet/exports/$EXPORT_JOB_ID" \
  -H "Authorization: Bearer $ADMIN_JWT" | jq .data.status
```

Expected progression: `QUEUED` → `PROCESSING` → `READY`

### DB verification

```sql
SELECT id, status, processed_rows, total_rows, storage_key, storage_provider, file_size_bytes, created_at, completed_at
FROM watch_export_jobs
ORDER BY created_at DESC
LIMIT 5;
```

---

## 16. Export verification procedure

1. **Request export** as Super Admin or scoped admin:
   `POST /v1/watch-fleet/exports` with optional filters (`ownerType`, `ownershipStatus`, etc.).

2. **Confirm queued:**
   - DB row `status = QUEUED`
   - BullMQ job exists with same UUID

3. **Wait for processing:**
   - Worker logs show export job
   - DB `status = PROCESSING`, `processed_rows` increasing

4. **Confirm complete:**
   - DB `status = READY`
   - `storage_key` like `watch-fleet-exports/staging/2026/07/{uuid}.csv`
   - `storage_provider = s3`, `checksum` populated, `file_size_bytes > 0`

5. **S3 verify:**
   ```bash
   aws s3 head-object --bucket $BUCKET --key "$STORAGE_KEY"
   ```

6. **Download URL:**
   `GET /v1/watch-fleet/exports/{id}/download-url`
   - Returns HTTPS presigned URL (not `/watch-fleet/exports/.../download` path in production)

7. **Download file:**
   ```bash
   curl -sL "$PRESIGNED_URL" -o export.csv
   wc -l export.csv
   head -2 export.csv
   ```

8. **Masking:** For LGA admin, IMEI/EID columns should show masked values (`***` pattern per `maskImei`).

9. **Audit:**
   ```sql
   SELECT action, created_at FROM audit_logs
   WHERE entity_type = 'watch_export_jobs' AND entity_id = '$EXPORT_JOB_ID'
   ORDER BY created_at;
   ```

---

## 17. Cleanup verification procedure

1. Set short retention for test: `WATCH_EXPORT_RETENTION_HOURS=1` (staging only).

2. Create and complete a small export.

3. Wait until `expires_at < now()` (or manually backdate in DB for test):

   ```sql
   UPDATE watch_export_jobs SET expires_at = NOW() - INTERVAL '1 hour'
   WHERE id = '$EXPORT_JOB_ID';
   ```

4. Wait up to 15 minutes for cleanup cycle (or restart worker to trigger startup cleanup).

5. **Expected:**
   - S3 object deleted (`head-object` → 404)
   - DB `status = EXPIRED`, `deleted_at` set, `local_file_path` null
   - Metric `the_eye_watch_export_cleanup_total{outcome="deleted"}` increments

6. **Failure case:** if S3 delete fails, `deletion_failure_reason` populated; metric `outcome="failed"`.

---

## 18. Performance benchmark execution

**Run only on isolated perf database — never production or shared staging.**

### Prerequisites

```bash
export DATABASE_URL="postgresql://perf_user:pass@perf-host:5432/the_eye_perf"
pnpm --filter @the-eye/api exec prisma migrate deploy
```

### Seed 1M devices (adjust count for time budget)

```bash
export WATCH_FLEET_BENCH_DEVICE_COUNT=1000000
export WATCH_FLEET_BENCH_BATCH_SIZE=5000
export WATCH_FLEET_BENCH_OWNER_ID=$(uuidgen)   # or fixed UUID
export WATCH_FLEET_BENCH_OWNER_TYPE=PERSON

pnpm --filter @the-eye/api exec tsx scripts/watch-fleet-performance/seed-million-devices.ts
```

### Run benchmark

```bash
export WATCH_FLEET_BENCH_ITERATIONS=30
export WATCH_FLEET_BENCH_OWNER_ID=<same-as-seed>

pnpm --filter @the-eye/api exec tsx scripts/watch-fleet-performance/run-full-benchmark.ts
```

Output: `artifacts/watch-fleet-benchmark-results.json`

### Acceptance targets

| Metric | Target |
|--------|--------|
| Owner summary p95 | < 500 ms |
| Inventory first page p95 | < 750 ms |
| Filtered inventory p95 | < 1000 ms |
| No full-table fetch in API | verified by code + EXPLAIN |

---

## 19. Known risks

| Risk | Mitigation |
|------|------------|
| 1M benchmark not yet run on perf DB | Execute section 18 before production scale |
| Large `smartwatch_devices` index build locks table | Use CONCURRENTLY runbook |
| Worker not running → exports stuck QUEUED | Monitor queue depth + alert |
| S3 credentials missing → startup fail (prod) | Pre-deploy config validation |
| Same worker handles all queues | CPU/memory spike during large export — scale worker replicas |
| Export cleanup 15-min granularity | Objects may linger up to 15 min past expiry |
| `/health/ready` does not check watch-fleet queues | Manual Redis/DB checks post-deploy |
| Local storage in staging (warn only) | Set `WATCH_EXPORT_STORAGE_PROVIDER=s3` for prod-like staging |

---

## 20. Expected results (success criteria)

| Check | Expected |
|-------|----------|
| API startup | No validation errors; listens on `:4000` |
| Worker startup | Processes register; cleanup timer starts |
| Migration | `20260731120000` + `20260731180000` applied |
| Export small fleet | READY in <2 min; S3 object present |
| Download | Presigned URL works once; 403/404 after expiry |
| Metrics | `the_eye_watch_exports_total{status="completed"}` ≥ 1 |
| Bulk queue | Jobs complete via worker, not inline |
| Production storage | `WATCH_EXPORT_STORAGE_PROVIDER=s3` only |
| Git SHA deployed | `56969727f965d42533536dc69338a46490882816` |

---

## 21. Quick reference — staging env block

Add to staging secret store:

```env
THE_EYE_APP_ENV=staging
THE_EYE_DISABLE_REDIS=0
WATCH_FLEET_BULK_MODE=queue
WATCH_EXPORT_STORAGE_PROVIDER=s3
WATCH_EXPORT_S3_BUCKET=the-eye-watch-exports-staging
WATCH_EXPORT_S3_ENDPOINT=https://YOUR_REGION.digitaloceanspaces.com
WATCH_EXPORT_S3_REGION=us-east-1
WATCH_EXPORT_SIGNED_URL_TTL_SECONDS=900
WATCH_EXPORT_RETENTION_HOURS=24
# WATCH_EXPORT_S3_* credentials or reuse S3_ACCESS_KEY / S3_SECRET_KEY
```

---

## 22. Related documentation

- `docs/WATCH_FLEET_PRODUCTION_HARDENING.md` — engineering report
- `docs/WATCH_FLEET_INDEX_DEPLOYMENT.md` — concurrent index runbook
- `apps/api/.env.example` — variable reference
- `infra/docker/docker-compose.yml` — reference compose services

---

**Contact:** Backend team / watch fleet hardening PR author for escalation.
