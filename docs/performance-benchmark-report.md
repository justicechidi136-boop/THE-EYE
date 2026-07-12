# THE EYE performance benchmark report

**Project:** THE EYE (5M-user readiness)  
**Report date:** 2026-07-09  
**Tool:** Grafana k6 + Prometheus  
**Script:** `scripts/k6/scale/platform-5m.js`

---

## Executive summary

This report captures multi-tier load results for THE EYE API under simulated population scales of **100**, **1,000**, **10,000**, and **100,000** active users. Metrics include API, database, Redis, verification, broadcast dispatch, notification, and live-video latency.

Optimizations applied in this pass:

- **Auth user cache** (30s TTL) — removes per-request DB lookup for JWT resolution at scale
- **Verification write parallelization** — timeline + verification records + status update in `Promise.all`
- **Verification history window** reduced from 50 → 20 rows for scoring context
- **Broadcast dispatch batching** — recipients processed in parallel batches of 25
- **Prometheus histograms** for verification, broadcast, live-video, and Redis enqueue/ping

---

## Scale test matrix

| Tier | Executor model | Duration (approx) | Notes |
|------|----------------|-------------------|-------|
| 100 | Ramping VUs → 100 | ~5 min | Direct concurrency |
| 1,000 | Ramping VUs → 1,000 | ~7 min | Direct concurrency |
| 10,000 | Constant arrival ~400 req/s | ~6 min | Simulated active population |
| 100,000 | Constant arrival ~2,500 req/s | ~8 min | Requires distributed k6 generators |

**Run commands:**

```bash
pnpm run test:load:scale:100
pnpm run test:load:scale:1000
pnpm run test:load:scale:10000
pnpm run test:load:scale:100000
pnpm run test:load:benchmark
```

---

## Latency results (k6 client-side p95, ms)

| Scale | API p95 | DB proxy p95 | Redis proxy p95 | Verification p95 | Broadcast p95 | Notification p95 | Live video p95 | Fail % |
|------:|--------:|-------------:|--------------:|-------------------:|--------------:|-----------------:|---------------:|-------:|
| _no runs yet_ | — | — | — | — | — | — | — | — |

> Re-run `node scripts/generate-benchmark-report.cjs --all` after each staging deploy to refresh this table.

---

## Bottleneck analysis

_No benchmark runs captured yet. Start API + seed, then run `pnpm run test:load:benchmark`._

---

## Prometheus correlation

```promql
histogram_quantile(0.95, sum(rate(the_eye_verification_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_broadcast_dispatch_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_live_video_operation_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_redis_operation_duration_seconds_bucket[5m])) by (le))
histogram_quantile(0.95, sum(rate(the_eye_db_query_duration_seconds_bucket[5m])) by (le))
```

---

## 5M-user scaling recommendations

| Layer | Current limiter | Recommendation |
|-------|-----------------|----------------|
| API | JWT DB resolution | Auth cache (done); add read replicas for admin lists |
| Postgres | PostGIS duplicate detection | Partial GiST index on incident location; read replica for dashboards |
| Redis / BullMQ | Notification enqueue bursts | Horizontal Redis; dedicated notification workers |
| Verification | Context build + duplicate query | Async fire-and-forget on create (done); cache duplicate lookups 60s |
| Broadcasts | Per-recipient sequential writes | Batched parallel dispatch (done); precompute geofence recipients |
| Live video | Session upsert + location inserts | Connection pooling; partition location updates by month |
| Edge | Rate limits (429) | Per-tenant limits; CDN for static admin assets |

---

## Artifacts



---

## Regression gate

1. `pnpm run test:load:validate` — structure check
2. `pnpm run test:load:smoke` — single-VU sanity
3. `pnpm run test:load:scale:100` — must pass thresholds
4. Compare p95 columns above to prior report; fail CI if API p95 doubles or verification p95 exceeds 5s at 100-tier
