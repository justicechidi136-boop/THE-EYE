# PostgreSQL + PostGIS scaling for THE EYE

This guide covers connection pooling, Prisma configuration, and the scale indexes added in migration `20260709223000_postgres_scale_indexes`.

## Connection topology

```
API replica(s)  -->  PgBouncer (transaction pool)  -->  PostgreSQL/PostGIS
Prisma migrate  -->  PostgreSQL direct (bypass pooler)
```

- **Runtime traffic** should use PgBouncer to avoid exhausting Postgres `max_connections`.
- **Migrations and seeds** must bypass PgBouncer and connect directly to Postgres.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Runtime URL through PgBouncer |
| `DATABASE_DIRECT_URL` | Direct Postgres URL for `prisma migrate` / `prisma db seed` |
| `PGBOUNCER_PORT` | Host port for optional local PgBouncer (default `6432`) |

### Example (Docker Compose with pooling profile)

```env
# Direct Postgres (migrations, seeds, admin tools)
DATABASE_DIRECT_URL=postgresql://the_eye:change_me_postgres@postgres-postgis:5432/the_eye?schema=public

# Runtime via PgBouncer — one logical connection per API worker is enough
DATABASE_URL=postgresql://the_eye:change_me_postgres@pgbouncer:6432/the_eye?schema=public&pgbouncer=true&connection_limit=5&pool_timeout=20
```

### Prisma + PgBouncer rules

1. Add `pgbouncer=true` to `DATABASE_URL` when using transaction pooling (disables prepared statements).
2. Keep `connection_limit` low per API replica (5–10). PgBouncer multiplexes many clients onto fewer server connections.
3. Set `DATABASE_DIRECT_URL` in `schema.prisma` so migrations never hit the pooler.
4. Do **not** run long transactions or advisory locks through PgBouncer transaction mode.
5. PostGIS spatial queries are compatible with transaction pooling when each request uses a single transaction.

### Sizing formula

```
pgbouncer.default_pool_size >= API_replicas × DATABASE_URL.connection_limit
postgres.max_connections >= pgbouncer.default_pool_size + admin_margin (migrations, monitoring)
```

For 4 API replicas with `connection_limit=5`, set `default_pool_size` to at least **20** and Postgres `max_connections` to **100+**.

## Docker Compose

PgBouncer is available behind the `pooling` profile:

```bash
docker compose -f infra/docker/docker-compose.yml --profile pooling up -d
```

Point `DATABASE_URL` at `pgbouncer:6432` and keep `DATABASE_DIRECT_URL` on `postgres-postgis:5432`.

## Scale indexes (20260709223000)

| Area | Index | Query pattern |
|------|-------|---------------|
| Incidents | `reporter_id, created_at DESC` | Citizen incident history; latest-location CTE |
| Incidents | `assigned_agency_id, status, created_at DESC` | Agency admin dashboards |
| Incidents | `jurisdiction_id, status, priority, created_at DESC` | Jurisdiction-scoped escalation scans |
| Incidents | `country, state, lga, status, created_at DESC` | LGA/state/country admin lists |
| Broadcasts | `published_at DESC WHERE status = 'Published'` | Nearby published broadcast feed |
| Broadcasts | `creator_admin_id` | Admin broadcast scope |
| Broadcast deliveries | `user_id, broadcast_id` | `EXISTS` lookup in `nearbyForUser()` |
| Community posts | `author_id, created_at DESC` | Author history |
| Community posts | `community_id, verification_status, created_at DESC` | Moderation queues |
| Communities | `country, state, lga, created_at DESC` | Admin community directory |
| Notifications | partial unread indexes on `user_id` / `admin_user_id` | Unread inbox (`read_at IS NULL`) |
| Notifications | `broadcast_id` | Broadcast delivery linkage |
| Admin users | `agency_id, is_active` | Agency operator lookups |
| Admin users | `country, state, lga, is_active` | Jurisdiction admin directory |

Existing GiST indexes on `incidents.gps_location`, `broadcasts.target_area/target_center`, `jurisdictions.boundary`, and `notifications.target_location` continue to serve spatial predicates (`ST_DWithin`, `ST_Covers`, `ST_Intersects`).

## Postgres tuning (managed or self-hosted)

Recommended starting points for PostGIS workloads at scale:

| Setting | Suggested value | Notes |
|---------|-----------------|-------|
| `max_connections` | 100–200 | Prefer PgBouncer over raising this |
| `shared_buffers` | 25% of RAM | Up to ~8 GB on large instances |
| `work_mem` | 16–64 MB | Spatial joins benefit; watch total concurrency |
| `effective_cache_size` | 50–75% of RAM | Planner hint only |
| `random_page_cost` | 1.1–1.5 | SSD/NVMe storage |
| `maintenance_work_mem` | 512 MB–2 GB | Index builds and VACUUM |

Enable Point-in-Time Recovery (PITR) and regular `pg_dump` backups — see `docs/disaster-recovery.md`.

## Remaining architectural hotspots

Indexes improve btree lookups but do not fix full-table scans in:

- `broadcasts.service.ts` geofence recipient dispatch (`latest_user_location` CTE over all users)
- `notifications.service.ts` `findUsersNear()` with the same pattern

Long-term: maintain a `user_latest_locations` table or Redis GEO index updated on location writes.

## Verification

```bash
pnpm --filter @the-eye/api run prisma:deploy
pnpm run test:backend
pnpm --filter @the-eye/api run build
```

Inspect index usage after load testing:

```sql
SELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE relname IN ('incidents', 'broadcasts', 'community_posts', 'notifications', 'admin_users')
ORDER BY idx_scan DESC;
```
