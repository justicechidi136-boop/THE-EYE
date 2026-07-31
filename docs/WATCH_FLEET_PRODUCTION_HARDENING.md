# Watch Fleet Production Hardening Report

Branch: `feat/watch-fleet-production-hardening`

## Phase 1 — Gap matrix (before remediation)

| Requirement | Before | Risk | Remediation |
|-------------|--------|------|-------------|
| Owner summary stats | `findMany` + JS counting per owner group | Critical at 1M devices | SQL `COUNT(*) FILTER` aggregates |
| Geography-scoped pagination | Post-filter in Node after `take` | Wrong page sizes / skipped rows | Geography in SQL (summaries) and Prisma `where` (inventory) |
| CSV export | Enum only | Broken / N/A | Async export job + batched CSV write |
| Bulk inline fallback | Always inline when Redis off | HTTP timeouts on large jobs | `WATCH_FLEET_BULK_MODE`; staging/prod require queue |
| Replacement Pending | Schema enum only | Ops gap | API + admin UI + custody audit events |
| Million-device test | None | Unknown perf | Benchmark script + EXPLAIN docs |

## Summary query — before

```typescript
// watch-fleet.service.ts loadOwnerStats
const devices = await prisma.smartwatchDevice.findMany({ where: { OR: orClauses }, select: {...} });
for (const device of devices) { /* JS increment counters */ }
```

## Summary query — after

Single PostgreSQL aggregate via `WatchFleetStatsRepository.queryOwnerAggregates`:

```sql
COUNT(*) FILTER (WHERE is_online = true)
COUNT(*) FILTER (WHERE ownership_status = 'REPLACEMENT_PENDING')
MAX(last_seen_at)
GROUP BY current_owner_type, current_owner_id
```

Geography applied in `scoped_devices` CTE via `profiles` / `watch_organizations` joins.

## Indexes added (migration `20260731180000_watch_fleet_production_hardening`)

- Partial: `ownership_status = 'REPLACEMENT_PENDING'`
- Partial: `battery_level <= 20`
- Partial: active online `(is_online, last_seen_at)` excluding retired/lost

## Export architecture (S3-ready)

1. `POST /watch-fleet/exports` — creates `watch_export_jobs` row
2. BullMQ worker (`watch-fleet-export` queue) batches inventory cursor reads (500 rows)
3. Writes CSV incrementally to temp file, uploads via `WatchExportStorage`
4. **Production:** `S3WatchExportStorage` — multipart upload for files ≥100MB, object key `watch-fleet-exports/{env}/{year}/{month}/{jobId}.csv`
5. **Development:** `LocalWatchExportStorage` — HMAC token download only
6. `GET /watch-fleet/exports/:id/download-url` — S3 presigned GET (prod) or HMAC local URL (dev)
7. Geography + ownership revalidated before URL issuance; every download audited
8. `WatchExportCleanupService` — 15-minute interval deletes expired objects and marks jobs `EXPIRED`

### Environment variables

```
WATCH_EXPORT_STORAGE_PROVIDER=s3|local
WATCH_EXPORT_S3_ENDPOINT=
WATCH_EXPORT_S3_REGION=
WATCH_EXPORT_S3_BUCKET=
WATCH_EXPORT_S3_ACCESS_KEY_ID=
WATCH_EXPORT_S3_SECRET_ACCESS_KEY=
WATCH_EXPORT_S3_FORCE_PATH_STYLE=false
WATCH_EXPORT_SIGNED_URL_TTL_SECONDS=900
WATCH_EXPORT_RETENTION_HOURS=24
WATCH_EXPORT_ALLOW_LOCAL_IN_PRODUCTION=0  # emergency only
```

Production startup fails if `WATCH_EXPORT_STORAGE_PROVIDER=local` unless emergency override is set.

See also: `docs/WATCH_FLEET_INDEX_DEPLOYMENT.md` for concurrent index runbook.

## Benchmark scripts

- Seed: `tsx scripts/watch-fleet-performance/seed-million-devices.ts`
- Run: `tsx scripts/watch-fleet-performance/run-full-benchmark.ts`
- Results written to `artifacts/watch-fleet-benchmark-results.json`

**Status:** 1M-device benchmark requires isolated perf DB with fleet migrations applied. Local dev DB lacks `current_owner_type` column (fleet migration not deployed).

## Bulk queue hardening

- `WATCH_FLEET_BULK_MODE=queue|inline|required` (default `queue`)
- Inline allowed only in development and ≤25 devices
- Staging/production: `ServiceUnavailableException` if Redis/BullMQ unavailable
- Startup: `assertWatchFleetBulkConfiguration()` in `validate-env.ts`

## Replacement workflow

- `POST .../replacement-pending`
- `POST .../replacement/approve|cancel|issue`
- Admin inventory filter + `REPLACEMENT_PENDING` badge
- Append-only `watch_ownership_records` + audit events

## Acceptance targets (documented, not yet measured at 1M scale)

| Metric | Target |
|--------|--------|
| Owner summary p95 | < 500 ms (staging hardware) |
| Inventory page p95 | < 750 ms |
| Export | No full in-memory CSV; worker batching |
| Bulk 10k+ devices | Must use BullMQ |

Run benchmark: `tsx scripts/watch-fleet-performance/owner-summary-benchmark.ts`

## Remaining production risks

- **1M-device benchmark not yet executed** — requires isolated perf DB + `seed-million-devices.ts` + `run-full-benchmark.ts`
- Staging export verification (S3 bucket, signed URL, cleanup) not yet run in deployed environment
- Concurrent partial indexes on large `smartwatch_devices` tables must follow manual runbook
- `WatchFleetWorkerModule` must be deployed alongside API worker process for export + cleanup
- `CREATE INDEX CONCURRENTLY` recommended for zero-downtime on large prod tables (manual ops step)
