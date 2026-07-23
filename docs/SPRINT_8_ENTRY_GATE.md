# THE EYE — Sprint 8 Entry Gate

**Purpose:** Define mandatory Release Candidate gates that must pass with **live staging evidence** before Sprint 8 is authorized.  
**Decision authority:** Principal Release Gatekeeper / QA Director  
**Last updated:** 2026-07-23  
**Certified staging commit (Git):** `841d96a217d51fd2d0ed27479b30fbed240d250a`  
**Live VPS runtime commit:** **Unknown / likely pre-PR-#19** — VPS redeploy pending  

> **Sprint 8 is NOT authorized.** Do not create a Sprint 8 branch until `docs/SPRINT_8_AUTHORIZATION_REPORT.md` records **SPRINT 8 AUTHORIZED**.

---

## Allowed test statuses

| Status | Meaning |
|--------|---------|
| **PASS** | Live staging evidence recorded (see evidence rules below) |
| **FAIL** | Reproduced defect on staging with evidence |
| **BLOCKED BY PROVIDER** | External provider approval/config blocks test (documented) |
| **BLOCKED BY HARDWARE** | Physical device/watch required and unavailable |
| **BLOCKED BY DATASET** | Verified dataset not ready; UI must be honest |
| **NOT TESTED** | No live evidence yet |

**PASS requires:** staging commit, app version, device/browser, timestamp, route/UI flow, expected vs actual, sanitized request ID where relevant. Unit/CI tests alone are insufficient for device/runtime PASS.

---

## Gate A — Mobile Application (25 mandatory flows)

Physical Android device required unless explicitly noted.

| # | Flow | Release 1 required | Matrix ID |
|---|------|:------------------:|-----------|
| 1 | Install/launch without crash or white screen | Y | GA-MOB-001 |
| 2 | Email registration | Y | GA-MOB-002 |
| 3 | Email/password login | Y | GA-MOB-003 |
| 4 | Google Sign-In | Y | GA-MOB-004 |
| 5 | Session restoration after restart | Y | GA-MOB-005 |
| 6 | Logout clears session and private cache | Y | GA-MOB-006 |
| 7 | Password-reset email received and reset completes | Y | GA-MOB-007 |
| 8 | OTP works or blocked only by Termii Sender ID | Y | GA-MOB-008 |
| 9 | Citizen profile loads real data | Y | GA-MOB-009 |
| 10 | Profile edit persists | Y | GA-MOB-010 |
| 11 | Avatar upload end to end | Y | GA-MOB-011 |
| 12 | Emergency contacts CRUD | Y | GA-MOB-012 |
| 13 | Notification inbox loads | Y | GA-MOB-013 |
| 14 | Broadcast feed loads | Y | GA-MOB-014 |
| 15 | Standard SOS creates real incident | Y | GA-MOB-015 |
| 16 | Silent SOS creates real incident | Y | GA-MOB-016 |
| 17 | All report types terminate (7 types) | Y | GA-MOB-017 |
| 18 | Loading indicators always terminate | Y | GA-MOB-018 |
| 19 | Offline queue and retry | Y | GA-MOB-019 |
| 20 | Incident history and detail from API | Y | GA-MOB-020 |
| 21 | Location submission | Y | GA-MOB-021 |
| 22 | Theme readable light/dark | Y | GA-MOB-022 |
| 23 | Police-station filters factual or dataset-blocked | Y | GA-MOB-023 |
| 24 | Unsupported features hidden or honestly disabled | Y | GA-MOB-024 |
| 25 | No localhost/production URL in staging APK | Y | GA-MOB-025 |

**Gate A rollup (2026-07-23):** 0 PASS · 0 FAIL · 1 BLOCKED BY PROVIDER · 0 BLOCKED BY DATASET · **24 NOT TESTED**

---

## Gate B — Admin Dashboard (20 mandatory flows)

Staging browser; role matrix: Super Admin, Country, State, Agency/Dispatcher, Community Moderator (where in Release 1).

| # | Flow | Release 1 required | Matrix ID |
|---|------|:------------------:|-----------|
| 1 | Login | Y | GB-ADM-001 |
| 2 | Session restoration | Y | GB-ADM-002 |
| 3 | Logout → `/login` without HTTP 405 | Y | GB-ADM-003 |
| 4 | User list/detail | Y | GB-ADM-004 |
| 5 | KYC queue and review | Y | GB-ADM-005 |
| 6 | Incident list/detail | Y | GB-ADM-006 |
| 7 | Verify/reject | Y | GB-ADM-007 |
| 8 | Assign/reassign/escalate | Y | GB-ADM-008 |
| 9 | Dispatch queue | Y | GB-ADM-009 |
| 10 | Timeline factual data | Y | GB-ADM-010 |
| 11 | Broadcast create/approve/schedule/cancel/dispatch | Y | GB-ADM-011 |
| 12 | Notification delivery monitoring | Y | GB-ADM-012 |
| 13 | Neighborhood Watch moderation | Y | GB-ADM-013 |
| 14 | Smartwatch device detail/actions (if merged) | Y | GB-ADM-014 |
| 15 | Country/state/LGA/agency scoping | Y | GB-ADM-015 |
| 16 | Audit endpoints — no BigInt errors | Y | GB-ADM-016 |
| 17 | No dead buttons | Y | GB-ADM-017 |
| 18 | No raw JSON pages | Y | GB-ADM-018 |
| 19 | No fake coords/charts/delivery/responder data | Y | GB-ADM-019 |
| 20 | Admin Linux production build passes | Y | GB-ADM-020 |

**Gate B rollup:** 0 PASS · 0 FAIL · **20 NOT TESTED** (GB-ADM-020 CI-only: Validate Staging admin build PASS on `841d96a` — not counted as Gate PASS without browser QA)

---

## Gate C — Smartwatch (20 mandatory flows)

Approved Android 8.1+ square watch and/or emulator where certifiable; FCM/GPS/reboot on hardware.

| # | Flow | Release 1 required | Matrix ID |
|---|------|:------------------:|-----------|
| 1 | Watch APK installs | Y | GC-WCH-001 |
| 2 | Package + staging Firebase identity | Y | GC-WCH-002 |
| 3 | Launcher on approved target | Y | GC-WCH-003 |
| 4 | Boot recovery | Y | GC-WCH-004 |
| 5 | Pairing | Y | GC-WCH-005 |
| 6 | Unpairing | Y | GC-WCH-006 |
| 7 | Standard SOS | Y | GC-WCH-007 |
| 8 | Silent SOS | Y | GC-WCH-008 |
| 9 | Offline SOS queue/replay no dupes | Y | GC-WCH-009 |
| 10 | Real battery/network telemetry | Y | GC-WCH-010 |
| 11 | Location updates during emergency | Y | GC-WCH-011 |
| 12 | Active emergency restore after restart | Y | GC-WCH-012 |
| 13 | Push registration | Y | GC-WCH-013 |
| 14 | Push alert on hardware | Y | GC-WCH-014 |
| 15 | Alert acknowledgement reaches backend | Y | GC-WCH-015 |
| 16 | Incident status refresh from server | Y | GC-WCH-016 |
| 17 | Terminal incident stops tracking | Y | GC-WCH-017 |
| 18 | Revoked device denied per policy | Y | GC-WCH-018 |
| 19 | Lost/stolen restrictions | Y | GC-WCH-019 |
| 20 | No fake telemetry/mock success | Y | GC-WCH-020 |

**Hardware-only deferrals (do not block Sprint 8 unless in Release 1 scope):** fall detection, physical buttons, heart-rate triggers.

**Gate C rollup:** 0 PASS · **20 NOT TESTED** (PR #18 not merged; watch runtime not on certified staging deploy)

---

## Gate D — Backend and Infrastructure (18 mandatory checks)

| # | Check | Release 1 required | Matrix ID |
|---|-------|:------------------:|-----------|
| 1 | API healthy | Y | GD-INF-001 |
| 2 | PostgreSQL/PostGIS healthy | Y | GD-INF-002 |
| 3 | Redis healthy | Y | GD-INF-003 |
| 4 | Notification worker healthy | Y | GD-INF-004 |
| 5 | Broadcast scheduler healthy | Y | GD-INF-005 |
| 6 | Worker/scheduler heartbeats current | Y | GD-INF-006 |
| 7 | Firebase project `the-eye-2stg` | Y | GD-INF-007 |
| 8 | FCM simulation disabled | Y | GD-INF-008 |
| 9 | SMTP password-reset email | Y | GD-INF-009 |
| 10 | Termii factual / fail closed | Y | GD-INF-010 |
| 11 | S3/Spaces uploads | Y | GD-INF-011 |
| 12 | LiveKit or honest disable | Y | GD-INF-012 |
| 13 | Nginx + TLS healthy | Y | GD-INF-013 |
| 14 | All migrations applied | Y | GD-INF-014 |
| 15 | No container crash loops | Y | GD-INF-015 |
| 16 | Optional provider failure does not block incident create | Y | GD-INF-016 |
| 17 | Request IDs + safe error codes | Y | GD-INF-017 |
| 18 | Backups + rollback instructions | Y | GD-INF-018 |

**Gate D rollup (partial remote probe 2026-07-23T09:04Z):** 7 observational checks on **current VPS** (pre-PR-#19 deploy): GD-INF-001,002,003,004,007,008,013 → **observed healthy** but **not PASS** until certified commit deployed and full matrix signed. Remaining: **NOT TESTED** or **BLOCKED BY PROVIDER** (SMTP/Termii E2E).

---

## Merge order (Phase 2)

| Step | Item | Status |
|------|------|--------|
| 1 | PR #19 CI green | **DONE** (run 29991834750) |
| 2 | Merge PR #19 → staging | **DONE** (`841d96a`) |
| 3 | Validate Staging | **DONE** (run 29991936821) |
| 4 | Deploy + runtime test stabilization | **PENDING** |
| 5 | Resolve P0/P1 from deploy QA | **PENDING** |
| 6 | Rebase PR #18 on latest staging | **PENDING** (diverged: +20 / −4) |
| 7 | Sprint 7 security gaps or formal deferrals | **PENDING** |
| 8 | PR #18 CI green post-rebase | **STALE** (CI green on old base @ `723a238`) |
| 9 | Merge PR #18 after approval | **NOT STARTED** |
| 10 | Deploy + test watch changes | **NOT STARTED** |

**Open PRs:** [#19 MERGED](https://github.com/justicechidi136-boop/THE-EYE/pull/19) · [#18 OPEN](https://github.com/justicechidi136-boop/THE-EYE/pull/18) (Sprint 7 watch reliability)

---

## Sprint 8 authorization conditions

### SPRINT 8 AUTHORIZED — requires ALL:

- Every mandatory Gate A test **PASS** (or approved deferral)
- Every mandatory Gate B test **PASS**
- Every mandatory Gate C test **PASS** or approved hardware-only exclusion
- Gate D **PASS** on certified staging commit
- No open P0; no mandatory open P1
- Remaining blockers are documented approved deferrals

### SPRINT 8 NOT AUTHORIZED — if ANY:

- Mandatory test **FAIL** or **NOT TESTED**
- Open P0 or mandatory P1
- Staging unhealthy or artifacts not from certified commit
- False PASS from code/CI alone

**Current decision:** See `docs/SPRINT_8_AUTHORIZATION_REPORT.md` → **SPRINT 8 NOT AUTHORIZED**

---

## Related documents

| Document | Role |
|----------|------|
| `docs/STAGING_RUNTIME_BLOCKERS.md` | SRB-001–012 runtime blocker matrix |
| `docs/PRODUCTION_FUNCTIONALITY_CHECKLIST.md` | Full feature-level checklist |
| `docs/RELEASE_CANDIDATE_TEST_MATRIX.md` | Per-test IDs, evidence, owners |
| `docs/SPRINT_8_AUTHORIZATION_REPORT.md` | Formal authorization decision |
| `docs/STAGING_DEPLOYMENT.md` | VPS deploy and rollback |
