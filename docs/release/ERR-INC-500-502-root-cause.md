# ERR-INC-500 / ERR-INC-502 staging root cause (2026-07-26)

## Observed staging behavior

Direct anonymous smoke tests against `https://staging-api.theeye.com.ng/v1`:

| Endpoint | HTTP | Request ID (sample) |
|----------|------|---------------------|
| `POST /incidents/report` | 500 | `08223564-9f45-4181-8c36-a465ad59c3f2` |
| `POST /incidents/emergency` | 500 | `ac16621f-1de6-45d2-9c2f-7629acedad5c` |
| `GET /health/ready` | 200 | n/a |

Health checks remain green. Failure is isolated to the incident write path.

## Confirmed local contributing factors

1. **Non-critical writes were blocking HTTP success**
   - Timeline creation ran after incident insert but was still awaited without isolation.
   - Audit logging threw on standard report path when audit chain/database write failed.
   - Emergency contact notification enqueue could reject the request if Redis/SMS queue failed.

2. **Likely staging schema drift (requires VPS confirmation)**
   - Migration `20260724120000_incident_pending_location_nullable` makes `latitude`, `longitude`, and `gps_location` nullable and updates the PostGIS trigger for pending location.
   - If this migration is not deployed while the API image expects nullable coordinates, incident inserts can fail at the database layer.

3. **Authenticated forensics blocked**
   - Example staging citizen credentials from `.env.staging.example` returned `401 Invalid credentials`.
   - VPS log correlation by request ID was not completed in this session.

## Fix applied in code

- Incident create remains critical and aborts on failure.
- Timeline, audit, and emergency-contact notification writes are isolated with structured warnings (`nonCriticalWarnings`) while still returning the created incident id.
- Optional string fields normalized before Prisma create (`clientSubmissionId`, `address`, `title`).
- Volunteer registration validates canonical enum payload server-side.
- Mobile volunteer categories submit selected API enums (no `SecurityVolunteer` fallback).
- Live video client retry remains a resilience layer only (single retry on transient 500/502/503).

## Required staging follow-up

1. SSH to VPS/API container and correlate request IDs above with API logs + Prisma error codes.
2. Run `prisma migrate status` and apply pending migrations with `prisma migrate deploy` only.
3. Redeploy API image built from the PR SHA after CI is green.
4. Re-run direct endpoint smoke tests until all three return 201 with real incident ids.
5. Only then run device QA for volunteer registration and Start SOS Live Video.

## Sprint 8

Not authorized until incident creation is verified on staging and device QA completes.
