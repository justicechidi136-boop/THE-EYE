# THE EYE load testing (k6)

This directory contains [Grafana k6](https://k6.io/) scripts for performance and soak testing THE EYE API. Scripts target seeded development credentials and do not modify application code.

## Prerequisites

1. **Running API stack** with seeded data:
   ```bash
   docker compose -f infra/docker/docker-compose.yml --profile tools run api-migrate
   docker compose -f infra/docker/docker-compose.yml --profile tools run api-seed
   docker compose -f infra/docker/docker-compose.yml up -d api redis postgres-postgis
   ```
   Or local dev API on port 4000 with `DATABASE_URL` and Redis configured.

2. **k6 installed** — [installation guide](https://grafana.com/docs/k6/latest/set-up/install-k6/)

3. **Environment** — copy `env.example` to `.env` and adjust if needed:
   ```bash
   cp scripts/k6/env.example scripts/k6/.env
   ```

## Quick start

```bash
# Validate all core endpoints (1 VU, 1 iteration)
k6 run scripts/k6/smoke.js

# Windows helpers
scripts\run-k6.cmd smoke.js
powershell -File scripts/run-k6.ps1 -Script smoke.js
```

With custom base URL:

```bash
k6 run -e BASE_URL=http://localhost:4000/v1 scripts/k6/smoke.js
```

## Scenarios

| Script | What it exercises | Default profile |
|--------|-------------------|-----------------|
| `smoke.js` | Health, auth, incidents, SOS, GPS, broadcasts, notifications | 1 VU × 1 iter |
| `scenarios/auth-login-burst.js` | Admin + citizen login bursts | ramping arrival 5→15 req/s |
| `scenarios/incident-submission.js` | Anonymous report + emergency | 3 req/s for 2m |
| `scenarios/sos-submission.js` | Smartwatch SOS (paired device) | 2 req/s for 90s |
| `scenarios/broadcast-dispatch.js` | Create + dispatch broadcasts | 3 VUs × 5 iters |
| `scenarios/notification-queue.js` | Enqueue (admin) + list (citizen) | dual arrival-rate |
| `scenarios/admin-incident-list.js` | Cursor-paginated incident list + detail | ramp 2→15 VUs |
| `scenarios/live-gps-updates.js` | Smartwatch GPS + live-video location | 10 + 4 req/s |
| `scenarios/verification-latency.js` | Admin verification scoring runs | ramp → 20 VUs |
| `combined.js` | All flows at reduced rates | ~2.5 min mixed load |
| `scale/platform-5m.js` | Full-platform 5M-user readiness mix | `SCALE=100\|1000\|10000\|100000` |

## 5M-user scale testing

The `scale/platform-5m.js` script simulates population tiers and records subsystem latency trends:

| `SCALE` | Model | Measures |
|---------|-------|----------|
| 100 | 100 concurrent VUs | API, DB/Redis proxy, verification, broadcast, notification, live video |
| 1,000 | 1,000 concurrent VUs | Same |
| 10,000 | ~400 req/s arrival rate | Simulated active population |
| 100,000 | ~2,500 req/s arrival rate | Distributed k6 recommended |

```bash
pnpm run test:load:scale:100
pnpm run test:load:scale:1000
pnpm run test:load:scale:10000
pnpm run test:load:scale:100000
pnpm run test:load:benchmark   # all tiers + report
```

Results export to `scripts/k6/results/` and aggregate into [performance-benchmark-report.md](./performance-benchmark-report.md).

Optional Prometheus correlation during teardown:

```bash
k6 run -e SCALE=100 -e METRICS_BEARER_TOKEN=... scripts/k6/scale/platform-5m.js
```

## npm scripts

From repo root:

```bash
pnpm run test:load:smoke
pnpm run test:load:combined
pnpm run test:load:auth
pnpm run test:load:incidents
pnpm run test:load:sos
pnpm run test:load:broadcasts
pnpm run test:load:notifications
pnpm run test:load:admin-list
pnpm run test:load:gps
pnpm run test:load:verification
pnpm run test:load:scale:100
pnpm run test:load:benchmark
```

## Seeded credentials

Development and staging accounts are created by `apps/api/prisma/seed.ts` using disposable credentials from `.env.example`:

| Variable | Default (placeholder) |
|----------|------------------------|
| `ADMIN_EMAIL` | `dev-admin@theeye.local` |
| `ADMIN_PASSWORD` | `change_me_dev_admin_password` |

Copy `.env.example` to `.env`, set a real password locally, then run `pnpm --filter @the-eye/api run db:seed`.

| Role | Email |
|------|-------|
| Super Admin | value of `ADMIN_EMAIL` |
| Dispatcher | `dispatcher.ikeja@theeye.local` (same `ADMIN_PASSWORD`) |
| Citizen | `citizen@theeye.local` (same `ADMIN_PASSWORD`) |

Smartwatch device: `watch-seed-001` (paired to citizen).

## Rate limits

THE EYE enforces Redis-backed rate limits. Expect **429** responses under aggressive load — this is expected and useful for baseline analysis:

| Policy | Approximate limit |
|--------|-----------------|
| `auth` | 15/min per IP |
| `incidentCreate` | 25 per 5 min per IP |
| `sos` | 6/min per IP |
| `broadcastCreate` | configured per role/IP |

Tune scenario `rate`, `vus`, and `duration` for staging; do not disable rate limits in production tests.

## Observability during tests

While load tests run, scrape Prometheus metrics:

```bash
curl -s http://localhost:4000/metrics | rg "the_eye_http_request_duration|the_eye_verification_duration|the_eye_broadcast_dispatch|the_eye_live_video_operation|the_eye_redis_operation|the_eye_bullmq_queue_depth"
```

Correlate k6 results with Grafana dashboards — see [grafana-dashboard.md](./grafana-dashboard.md).

## Exporting results

```powershell
powershell -File scripts/run-k6.ps1 -Script combined.js
# writes scripts/k6/results/combined-<timestamp>.json
```

Import the JSON summary into Grafana Cloud k6 or archive for regression comparison.

## CI usage

k6 is **not** wired into default CI. Run manually or in a dedicated performance pipeline against a staging environment with seeded data. The smoke script is safe for pre-release gates when a disposable API instance is available.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `401` on admin routes | Seed not applied or wrong `TEST_PASSWORD` |
| `403` on SOS/GPS | Citizen token missing or device not paired |
| All `429` | Rate limits — lower arrival rate or distribute IPs |
| `connection refused` | API not listening on `BASE_URL` |
| `503` on `/health/ready` | Postgres or Redis down |

See [load-testing-baseline.md](./load-testing-baseline.md) for recorded baseline metrics and SLO targets.
