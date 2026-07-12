# Load testing baseline report

**Project:** THE EYE API  
**Tool:** Grafana k6  
**Report date:** 2026-07-09  
**Environment:** Local development reference (seeded stack)  
**API base URL:** `http://localhost:4000/v1`

This document captures the initial load-testing baseline methodology, expected SLOs, and reference results from the k6 smoke validation profile. Re-run scenarios after infrastructure changes and append new sections with timestamps.

---

## Test matrix

| Scenario | Script | Primary endpoints | Success criteria |
|----------|--------|-------------------|------------------|
| Smoke validation | `scripts/k6/smoke.js` | `/health`, `/auth/login`, `/incidents/*`, `/smartwatch/*`, `/broadcasts`, `/notifications/*` | ≥ 90% checks pass |
| Auth login burst | `scenarios/auth-login-burst.js` | `POST /auth/login` | p95 < 1.5s; error rate < 10% (incl. 429) |
| Incident submission | `scenarios/incident-submission.js` | `POST /incidents/report`, `/emergency` | p95 < 3s; creates or 429 |
| SOS submission | `scenarios/sos-submission.js` | `POST /smartwatch/sos` | p95 < 3.5s |
| Broadcast dispatch | `scenarios/broadcast-dispatch.js` | `POST /broadcasts`, `/:id/dispatch` | p95 create < 2.5s, dispatch < 5s |
| Notification queue | `scenarios/notification-queue.js` | `POST /notifications/send`, `GET /notifications` | enqueue + list p95 < 3s / 1.5s |
| Admin incident list | `scenarios/admin-incident-list.js` | `GET /incidents`, `GET /incidents/:id` | p95 list < 2s |
| Live GPS updates | `scenarios/live-gps-updates.js` | `POST /smartwatch/devices/:id/gps`, live-video location | smartwatch p95 < 1s |
| Combined soak | `scripts/k6/combined.js` | All of the above (reduced rates) | p95 < 3s; fail rate < 20% |

---

## SLO targets (staging / production)

| Flow | Target p95 | Notes |
|------|------------|-------|
| Auth login | < 500 ms | Burst traffic during incidents |
| Incident report (standard) | < 2 s | Includes DB write + audit |
| Emergency fast path | < 3 s | Product target `targetProcessingTimeMs: 3000` |
| SOS end-to-end | < 3 s | Creates P1 incident + notifications |
| Admin incident list (50 rows) | < 1.5 s | Cursor pagination |
| Smartwatch GPS tick | < 300 ms | High-frequency updates |
| Notification enqueue | < 1 s | API accept; delivery async via BullMQ |
| Broadcast dispatch | < 5 s | Geofence recipient resolution |

---

## Smoke baseline (reference run)

**Command:**

```bash
k6 run scripts/k6/smoke.js
```

**Profile:** 1 VU, 1 iteration, default thresholds (`checks > 90%`).

### Expected outcomes (seeded local stack)

When API, Postgres, Redis, and seed data are healthy:

| Check | Expected |
|-------|----------|
| `GET /v1/health` | 200 |
| `GET /v1/health/ready` | 200 |
| Admin/citizen/super-admin login | 200 + JWT |
| `GET /incidents?limit=5` (admin) | 200 paginated body |
| `POST /incidents/report` (anonymous) | 201 or 429 if rate limited |
| `POST /smartwatch/sos` (citizen) | 201 or 429 |
| `POST /smartwatch/.../gps` | 200/201 |
| `GET /notifications` (citizen) | 200 |
| `POST /broadcasts` (admin) | 201 |
| `POST /notifications/send` (super admin) | 201 |

### Captured metrics (template)

Fill after running with `--summary-export`:

| Metric | Smoke | Auth burst | Incidents | SOS | Combined |
|--------|-------|------------|-----------|-----|----------|
| `http_req_duration` p95 | _ms | _ms | _ms | _ms | _ms |
| `http_req_failed` rate | _% | _% | _% | _% | _% |
| `checks` pass rate | _% | _% | _% | _% | _% |
| `iterations` | 1 | _ | _ | _ | _ |
| `vus` max | 1 | _ | _ | _ | _ |

**Example smoke run (documentation placeholder — re-run locally to populate):**

```
checks.........................: 100.00% ✓ 12        ✗ 0
http_req_duration..............: avg=145ms  min=22ms med=98ms max=890ms p(90)=310ms p(95)=420ms
http_req_failed................: 0.00%   ✓ 0         ✗ 0
http_reqs......................: 12      4.2/s
iteration_duration.............: avg=2.8s min=2.8s med=2.8s max=2.8s
```

> **Note:** Numbers above are illustrative targets for a healthy local seed. Export real values with `scripts/run-k6.ps1` and replace this section.

---

## Prometheus correlation

During load tests, monitor:

```promql
# API latency under load
histogram_quantile(0.95, sum(rate(the_eye_http_request_duration_seconds_bucket[1m])) by (le))

# Error rate
sum(rate(the_eye_http_errors_total[1m])) / sum(rate(the_eye_http_requests_total[1m]))

# Notification backlog
sum(the_eye_bullmq_queue_depth{queue="notifications", state="waiting"})

# Incident submission timing
histogram_quantile(0.95, sum(rate(the_eye_incident_submission_duration_seconds_bucket[1m])) by (le, intake))
```

---

## Rate-limit observations

Under default scenario rates, expect intentional throttling:

- **Auth burst** exceeds 15 req/min/IP → mixed 200/429; validates rate-limit guard + metrics.
- **SOS** exceeds 6/min/IP → 429 after threshold; confirms emergency abuse protection.
- **Incident create** may 429 after 25 reports/5 min/IP.

For capacity testing (finding true throughput), run from multiple k6 load generator IPs or temporarily raise limits in a **dedicated staging** environment only.

---

## Regression procedure

1. Deploy candidate build to staging with seed data.
2. Run `k6 run scripts/k6/smoke.js` — must pass.
3. Run `k6 run scripts/k6/combined.js` — export JSON summary.
4. Compare p95/p99 and error rate to prior baseline JSON in `scripts/k6/results/`.
5. Check Prometheus dashboards for queue depth and DB latency drift.
6. File regressions if p95 doubles or error rate exceeds 5% (excluding expected 429s).

---

## Files added

```
scripts/k6/
  lib/config.js
  lib/auth.js
  smoke.js
  combined.js
  env.example
  scenarios/
    auth-login-burst.js
    incident-submission.js
    sos-submission.js
    broadcast-dispatch.js
    notification-queue.js
    admin-incident-list.js
    live-gps-updates.js
  results/          # gitignored JSON exports
scripts/run-k6.cmd
scripts/run-k6.ps1
docs/load-testing.md
docs/load-testing-baseline.md
```

---

## Next steps

- [ ] Run smoke against staging and replace placeholder metrics
- [ ] Store first `combined-*.json` export in `scripts/k6/results/`
- [ ] Add Grafana dashboard panel for k6 run annotations (optional)
- [ ] Schedule weekly combined run in CI/staging pipeline
