# Incident location Prisma runtime failure (staging)

**Date:** 2026-07-27  
**Status:** DEPLOYED — STAGING PERSISTENCE NOT VERIFIED  
**Related:** SRB-039 (Live Emergency Video), Live GPS persistence, LOCATION-RETRY-001

## LOCATION-RETRY-001

The previous API returned HTTP 503 with `retrying: true` even when `scheduleRetry()` failed or BullMQ was unavailable. That false server-retry claim is fixed.

## Response contract

| Case | HTTP | Fields |
|------|------|--------|
| Persisted immediately | 200 | `persisted=true`, `retryQueued=false`, `data` |
| Server retry accepted | 202 | `persisted=false`, `retryQueued=true`, `retryId` |
| No server retry | 503 | `persisted=false`, `retryQueued=false`, `errorCode=LOCATION-RETRY-001` |

## Retry job identity

- Business job ID: `incident-location:{incidentId}:{sequenceNumber}`
- BullMQ `attempts` / `backoff` handle transport retries; attempt counter is **not** part of the job ID
- Repeated enqueue for the same sequence returns the existing job (`duplicate=true`)

## Retry payload privacy

- Redis must be private, authenticated, and TLS-enabled in production
- Job retention: `removeOnComplete=100`, `removeOnFail=50`
- Application logs emit incident ID, sequence, idempotency key — **not** raw coordinates
- Payload excludes JWT, refresh tokens, device secrets, and LiveKit tokens
- Operational job inspection requires privileged Redis access

## Readiness

`/v1/health/ready` exposes:

- `incidentLocationCreateCapability` (`ok` / `degraded` / `error`)
- `locationRetryQueue`
- `locationRetryWorker` (shared `notification-worker` process)

Create capability probe uses a rolled-back insert against a **closed** incident only; no durable probe rows are left behind.

## Observed staging failure

| Item | Value |
|------|-------|
| Incident ID | `0d688594-f2cf-4c67-af25-e5794568adc4` |
| Endpoint | `POST /v1/incidents/:id/location` |
| HTTP | 500 |
| Prisma error | `Invalid prisma.incidentLocationUpdate.create() invocation: Operation 'createOne' for model 'IncidentLocationUpdate' does not match any query` |
| Working endpoints | `GET /incidents/:id`, `GET /timeline`, `GET /live-location` → 200 |

Incident creation succeeds. Failure is isolated to persisting `IncidentLocationUpdate` rows.

## Root cause

**Classification:** `STALE_GENERATED_PRISMA_CLIENT` / Docker build-order defect.

The API production image copied `/app/deploy` from `pnpm deploy --prod`, but `prisma generate` ran via `pnpm --filter @the-eye/api exec` from the monorepo builder context instead of `/app/deploy`. The runtime image could ship a generated client and query engine that do not match the deployed schema, causing `createOne` to be rejected for `IncidentLocationUpdate`.

Secondary risk: `PrismaService` used `Object.assign(this, extended)` after `$extends`, which can leave delegate routing inconsistent under metrics extensions.

## Fix summary

1. **Dockerfile:** `WORKDIR /app/deploy` then `/app/node_modules/.bin/prisma generate --schema=./prisma/schema.prisma`; build-time `diagnose-prisma-location-model.cjs` fails the image build when the delegate is missing.
2. **PrismaService:** factory-created extended client (no `Object.assign` on `$extends` result).
3. **Readiness:** `/v1/health/ready` exposes `prismaClient`, `incidentLocationModel`, `schemaCompatibility`; readiness fails when incompatible (`PRISMA-SCHEMA-001`…`004`).
4. **Location isolation:** persistence failures return controlled `503` with `ERR-INC-LOCATION-RETRY`, enqueue BullMQ retry on `the-eye-{env}-incident-location-retry`, record timeline warning without destroying the incident or LiveKit session.

## Deploy requirements

Do **not** `docker compose restart api` alone. Rebuild and recreate:

```bash
docker compose --env-file .env build api notification-worker api-tools --no-cache api-tools
docker compose --env-file .env up -d --force-recreate api notification-worker
```

Use `--no-cache` for the first diagnostic deploy if the stale client layer persists.

**2026-07-27 staging note:** PR #44 merged and VPS redeployed @ `f345a55`, but authenticated proof (deploy run 30286025761) still hits `createOne` mismatch in direct Prisma create and HTTP 202 on location POST. Follow-up Dockerfile commits (`5505e33`+) generate via `npx prisma@6.19.3` inside `/app/deploy`; CI GHCR image builds green — **VPS API must be force-recreated on the fixed SHA once Prisma client path is confirmed.**

## Verification checklist (staging)

- [x] Readiness: `schemaCompatibility=ok` (create capability probe **degraded** — no closed incident)
- [ ] `node scripts/diagnose-prisma-location-model.cjs` inside API container → runtime createOne passes
- [ ] `POST /v1/incidents/:id/location` → 200/201 with `persisted=true`
- [ ] Row in `incident_location_updates`
- [ ] `GET /live-location`, `GET /location-history` reflect update
- [ ] Retry worker consumes `the-eye-staging-incident-location-retry` (controlled 202 proof pending)
- [ ] No raw Prisma 500; no ERR-INC-502 on primary path after fix

## Sprint 8

**NOT AUTHORIZED** until staging runtime persistence proof completes (Phases 7–11).
