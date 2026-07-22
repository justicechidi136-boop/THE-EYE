# THE EYE — Staging Release Candidate 1 (RC1)

**Release ID:** `staging-rc1`  
**Branch:** `staging`  
**Commit:** `a6da95a0041aba1943eafa732cc6968ec1f7d885`  
**Tagged:** 2026-07-22  
**Validate Staging run:** [29881070188](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29881070188) — **SUCCESS**

## Release verdict

| Dimension | Status |
|-----------|--------|
| **Staging RC1** | **READY FOR VPS DEPLOYMENT** |
| **Sprint 1 (Auth)** | CODE COMPLETE — PENDING STAGING QA |
| **Sprint 2 (Citizen Profile)** | CODE COMPLETE — PENDING STAGING QA |
| **Sprint 3 (Incident Reporting)** | CODE COMPLETE — PENDING STAGING QA |
| **Production release** | **NOT READY** — no PASS promotions without device/runtime evidence |

> RC1 is a **staging deploy candidate**, not a production release. Do not merge to `main` or deploy production from this tag.

## Scope

RC1 captures validated `staging` through Sprint 3 incident reporting merge (PR #14) plus post-merge watch lint hotfix.

### Included since baseline `45c2197`

| PR / change | Summary |
|-------------|---------|
| PR #14 | Sprint 3 incident lifecycle: idempotency, location updates, mobile history/detail, admin verify/assign/evidence, witness confirmations, watch SOS replay |
| Hotfix `a6da95a` | Watch `home_screen.dart` curly-brace lint (Validate Staging gate) |

### Platforms

| Platform | Version | Notes |
|----------|---------|-------|
| API | `@the-eye/api@0.1.0` | NestJS + Prisma |
| Admin | `@the-eye/admin-web@0.1.0` | Next.js BFF |
| Mobile | Flutter staging flavor | Build verified locally; CI APK skipped without `MOBILE_GOOGLE_SERVICES_JSON` |
| Watch | Flutter staging flavor | Analyze + 49 tests green |

## Validation evidence

| Job | Result | Job ID |
|-----|--------|--------|
| API lint, test, build | PASS | 88801854104 |
| Admin lint & build | PASS | 88801854110 |
| Mobile staging analyze, test, build | PASS | 88801854116 |
| Watch staging analyze, test, build | PASS | 88801854145 |
| Firebase staging guards | PASS | 88801854119 |
| Docker images (staging) | PASS | 88801854162 |

**Test totals (API job):** 211/211 backend tests  
**Mobile:** 101/101 (CI)  
**Watch:** 49/49 (CI)

## Database migration (required on VPS)

Apply before or during API container rollout:

```
20260722120000_incident_idempotency_location
```

Adds `client_submission_id`, `occurred_at` on `incidents`; creates `incident_location_updates` with PostGIS trigger.

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-migrate
```

## Staging deploy procedure

1. On VPS: `git fetch && git checkout staging && git pull` (expect `a6da95a` or later manifest commit).
2. Optionally pin: `git checkout staging-rc1` (tag points at `a6da95a`).
3. Run migration gate (above).
4. Rebuild and restart API + admin: see [STAGING_DEPLOYMENT.md](../STAGING_DEPLOYMENT.md).
5. Run Sprint 1–3 physical-device QA on staging endpoints — **do not mark checklist rows PASS until evidence exists**.

**Do not** run [Deploy](../.github/workflows/deploy.yml) to production. Staging deploy is manual on the VPS.

## Environment

| Setting | Value |
|---------|-------|
| Firebase project | `the-eye-2stg` |
| API | `https://staging-api.theeye.com.ng/v1` |
| Admin | `https://staging-dashboard8jps.theeye.com.ng` |
| LiveKit | `wss://staging-livekit.theeye.com.ng` |

## Known infrastructure blockers (runtime)

These remain **BLOCKED** on staging until VPS services are configured and verified:

| ID | Blocker | Impact |
|----|---------|--------|
| INF-005 | Redis / BullMQ workers | Notification queue delivery |
| FCM | Firebase Cloud Messaging | Push notifications |
| INF-006 | S3 / DigitalOcean Spaces | Evidence E2E upload/view |
| INF-003 | LiveKit | Live video sessions |

## QA focus for RC1 sign-off

Priority device QA tracks (all currently **NOT TESTED** in checklist):

- Sprint 3: incident report → history → detail → live location → admin verify/assign
- Watch: SOS hold → offline replay → server tracking poll
- Sprint 2: profile completion, emergency contacts, KYC queue
- Sprint 1: session restore, logout, OTP/password-reset webhooks (when configured)

## References

- [PRODUCTION_FUNCTIONALITY_CHECKLIST.md](../PRODUCTION_FUNCTIONALITY_CHECKLIST.md)
- [INCIDENT_CONTRACT.md](../INCIDENT_CONTRACT.md)
- [github-workflows.md](../github-workflows.md)
