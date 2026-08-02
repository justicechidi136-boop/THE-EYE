# Watch Fleet Production Index Deployment Runbook

This runbook covers indexes introduced in migration `20260731180000_watch_fleet_production_hardening`.

## Indexes in migration (non-concurrent)

The Prisma migration creates these indexes using standard `CREATE INDEX`:

| Index | Table | Purpose |
|-------|-------|---------|
| `watch_export_jobs_status_created_at_idx` | `watch_export_jobs` | Export job queue/status queries |
| `watch_export_jobs_expires_at_idx` | `watch_export_jobs` | Retention cleanup |
| `smartwatch_devices_replacement_pending_idx` | `smartwatch_devices` | Partial: `REPLACEMENT_PENDING` |
| `smartwatch_devices_low_battery_idx` | `smartwatch_devices` | Partial: battery ≤ 20 |
| `smartwatch_devices_active_online_idx` | `smartwatch_devices` | Partial: online + active ownership |

Small/staging databases: apply via `pnpm prisma:deploy` as usual.

## Production: partial indexes on `smartwatch_devices`

When `smartwatch_devices` exceeds ~500k rows, create partial indexes **concurrently** outside the migration transaction.

### Pre-checks

```sql
SELECT COUNT(*) FROM smartwatch_devices;
SELECT pg_size_pretty(pg_relation_size('smartwatch_devices'));
```

### 1. Replacement pending (CONCURRENTLY)

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS smartwatch_devices_replacement_pending_idx
  ON smartwatch_devices (ownership_status)
  WHERE ownership_status = 'REPLACEMENT_PENDING';
```

### 2. Low battery (CONCURRENTLY)

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS smartwatch_devices_low_battery_idx
  ON smartwatch_devices (battery_level)
  WHERE battery_level IS NOT NULL AND battery_level <= 20;
```

### 3. Active online (CONCURRENTLY)

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS smartwatch_devices_active_online_idx
  ON smartwatch_devices (is_online, last_seen_at)
  WHERE ownership_status NOT IN ('RETIRED', 'LOST_OR_STOLEN');
```

**Important:** Do not wrap `CREATE INDEX CONCURRENTLY` in a transaction block.

### Deployment sequencing

1. Deploy API/worker code (compatible before indexes exist — queries degrade to seq scan).
2. Run concurrent index SQL during low-traffic window (one index at a time).
3. Verify index validity and usage.
4. Mark migration as applied if using manual index path: `prisma migrate resolve --applied 20260731180000_watch_fleet_production_hardening`.

### Verification

```sql
SELECT indexname, indisvalid, indisready
FROM pg_indexes i
JOIN pg_class c ON c.relname = i.indexname
JOIN pg_index ix ON ix.indexrelid = c.oid
WHERE i.tablename = 'smartwatch_devices'
  AND i.indexname LIKE 'smartwatch_devices_%';

EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM smartwatch_devices
WHERE ownership_status = 'REPLACEMENT_PENDING';
```

### INVALID index cleanup

If concurrent build fails:

```sql
SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE NOT indisvalid;
DROP INDEX CONCURRENTLY IF EXISTS smartwatch_devices_replacement_pending_idx;
-- Re-run CREATE INDEX CONCURRENTLY
```

### Rollback

```sql
DROP INDEX CONCURRENTLY IF EXISTS smartwatch_devices_replacement_pending_idx;
DROP INDEX CONCURRENTLY IF EXISTS smartwatch_devices_low_battery_idx;
DROP INDEX CONCURRENTLY IF EXISTS smartwatch_devices_active_online_idx;
```

Application remains functional after rollback; aggregate queries may be slower.

## Export job table indexes

`watch_export_jobs` is new and empty at deploy time — standard migration indexes are sufficient.
