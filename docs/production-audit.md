# THE EYE Production Readiness Audit

Date: 2026-07-09  
Scope: API, database, infrastructure, CI/CD, security, observability  
Target: 5-million-user launch readiness across Africa

## Executive Summary

THE EYE is a well-structured NestJS + PostGIS monorepo with strong domain modeling, RBAC, audit chaining, and Docker Compose infrastructure. It is suitable as an MVP but requires additional hardening before a continent-scale launch. This audit prioritized **safe, non-feature refactors** that improve production operability without changing product behavior or UI.

## Critical Findings (Pre-Fix)

| Area | Severity | Finding |
|------|----------|---------|
| Seed script | P0 | Multi-statement `$executeRawUnsafe` caused Prisma P2010 |
| Health checks | P0 | `/v1/health` did not verify Postgres/Redis |
| Graceful shutdown | P1 | No `enableShutdownHooks()` |
| Auth validation | P1 | Auth DTOs lacked `class-validator` decorators under global `forbidNonWhitelisted` |
| Observability | P1 | No structured request logs, no consistent error envelope |
| CI/CD | P1 | No GitHub Actions pipeline |
| DR | P1 | Backup guidance only; no scripts/runbook |
| Connection pooling | P1 | No documented Prisma pool limits |
| Rate limiting | P2 | Edge nginx limits only; no app-layer throttling |
| Notifications | P2 | BullMQ processor is stubbed |
| Pagination | P2 | Hard `take` limits; no cursor pagination |
| Admin web | P2 | Mock-data driven; not wired to API |

## Fixes Applied In This Pass

1. **Seed safety** — split 36 INSERT statements into individual `$executeRawUnsafe` calls
2. **Readiness probe** — `GET /v1/health/ready` checks Postgres + Redis
3. **Liveness probe** — `GET /v1/health` remains lightweight
4. **Graceful shutdown** — `enableShutdownHooks()` in bootstrap
5. **Trust proxy** — `TRUST_PROXY_HOPS` for correct client IP behind nginx
6. **Request tracing** — `X-Request-ID` propagation + structured access logs
7. **Global exception filter** — consistent `{ statusCode, message, requestId, timestamp, path }`
8. **Auth DTO validation** — `class-validator` + Swagger metadata on auth endpoints
9. **Body size limits** — configurable `JSON_BODY_LIMIT` (default 10mb)
10. **Production env hardening** — `REDIS_HOST` required; `ALLOW_DEV_AUTH_CODES` blocked in prod
11. **CI pipeline** — `.github/workflows/ci.yml` (lint, migrate deploy, tests, build, compose config)
12. **DR runbook + scripts** — `docs/disaster-recovery.md`, `scripts/backup-the-eye.ps1`, `scripts/restore-the-eye.ps1`
13. **Docker readiness** — API healthchecks now target `/v1/health/ready`
14. **Connection pooling docs** — `connection_limit` and `pool_timeout` in `.env.example`

## Remaining Risks

| Risk | Impact | Recommendation |
|------|--------|----------------|
| Notification delivery stub | Users won't receive real alerts | Integrate FCM/SMS/email providers behind existing BullMQ processor |
| No PgBouncer / read replicas | DB connection exhaustion at scale | Add PgBouncer sidecar; split read traffic for analytics |
| No app-layer rate limiting | Abuse on high-value endpoints | Add Redis-backed `@nestjs/throttler` on auth/SOS/incident routes |
| JWT permissions are static | Role changes delayed until re-login | Short access TTL + permission version claim or server-side permission lookup |
| Broadcast geofence O(users) scan | Slow emergency dispatch in dense cities | Spatial pre-filter + batched inserts |
| Deep Prisma includes | High DB/memory use on list endpoints | Cursor pagination + selective includes |
| Admin web uses mock data | Ops UI not production-connected | Wire existing pages to API (no redesign) |
| No Prometheus metrics | Limited SRE visibility | Add `/metrics` or OpenTelemetry exporter |
| TLS disabled in default nginx | MITM risk | Enable certbot/TLS block for production |
| Package manager drift in Dockerfiles | Dependency inconsistency | Align Dockerfiles with pnpm workspace |

## Deployment Readiness Checklist

- [x] Seed script idempotent for keyed entities
- [x] Readiness endpoint verifies dependencies
- [x] Graceful shutdown enabled
- [x] Structured request logging
- [x] Consistent API error format
- [x] Auth input validation enforced
- [x] CI pipeline defined
- [x] Backup/restore runbook and scripts
- [ ] Real notification providers configured
- [ ] TLS enabled on ingress
- [ ] PgBouncer or managed pooling in production
- [ ] Prometheus/Grafana dashboards
- [ ] Load testing (incident submit, broadcast dispatch, auth)
- [ ] Admin web connected to live API
- [ ] Multi-region failover design documented

## Recommended Next Actions

1. Connect BullMQ notification processor to FCM/SMS/email providers
2. Add Redis-backed rate limiting on `/v1/auth/*`, SOS, and incident submission
3. Introduce cursor pagination on incidents, broadcasts, and community feeds
4. Deploy PgBouncer with `connection_limit` tuned per API replica count
5. Add Prometheus metrics and alert rules for error rate, queue depth, DB latency
6. Enable nginx TLS and restrict host-published database ports in production
7. Replace admin-web mock layer with typed API client using `@the-eye/shared`
