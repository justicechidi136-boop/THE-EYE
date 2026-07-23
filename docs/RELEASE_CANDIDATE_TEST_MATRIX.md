# THE EYE — Release Candidate Test Matrix

**Environment:** staging  
**Certified Git staging commit:** `703be04cb91c9db6080c74fe59e582a59cd9e146` (includes PR #19 `841d96a` lineage)  
**Matrix version:** 2026-07-23  
**Evidence rule:** PASS only with live staging proof per `docs/SPRINT_8_ENTRY_GATE.md`

**Summary**

| Gate | Total | PASS | FAIL | BLOCKED | NOT TESTED |
|------|------:|-----:|-----:|--------:|-----------:|
| A — Mobile | 25 | 0 | 0 | 1 | 24 |
| B — Admin | 20 | 0 | 0 | 0 | 20 |
| C — Watch | 20 | 0 | 0 | 0 | 20 |
| D — Infrastructure | 18 | 0 | 0 | 2 | 16 |
| **Total** | **83** | **0** | **0** | **3** | **80** |

Historical failures are retained in `docs/STAGING_RUNTIME_BLOCKERS.md` (SRB-001–012). This matrix does not delete prior audit rows in `docs/PRODUCTION_FUNCTIONALITY_CHECKLIST.md`.

---

## Column legend

| Column | Description |
|--------|-------------|
| R1 | Release 1 mandatory |
| Sev | P0 / P1 / P2 |
| Blocker | Linked SRB or defect ID |
| Owner | Responsible squad |
| Status | PASS / FAIL / BLOCKED BY PROVIDER / BLOCKED BY HARDWARE / BLOCKED BY DATASET / NOT TESTED |
| Retest | Pending / N/A |

---

## Gate A — Mobile

**Build artifact (prior session, rebuild required):** `app-staging-release.apk` · v`0.1.0+1` · `com.theeye.app.staging` · SHA-256 `C823F10BF21576A254787C01A71F2ED39C7E3B0F53C5DA251BB656FE23C38C22` · commit `841d96a` · **not installed on device this session**

| ID | Feature | R1 | Sev | Reproduction | Expected | Actual | Evidence | Blocker | Owner | Status | Retest |
|----|---------|:--:|:---:|--------------|----------|--------|----------|---------|-------|--------|--------|
| GA-MOB-001 | Install & launch | Y | P0 | Install staging APK; cold start | Splash → login; no crash/white screen | — | — | — | Mobile | **NOT TESTED** | Pending deploy + device |
| GA-MOB-002 | Email registration | Y | P0 | Register new citizen email | Account created; can log in | — | — | — | Mobile/Auth | **NOT TESTED** | Pending |
| GA-MOB-003 | Email/password login | Y | P0 | Login staging test account | Session established | — | — | — | Mobile/Auth | **NOT TESTED** | Pending |
| GA-MOB-004 | Google Sign-In | Y | P0 | Tap Google on staging | Firebase exchange; session | — | — | MOB-AUTH-005 | Mobile/Auth | **NOT TESTED** | Pending |
| GA-MOB-005 | Session restoration | Y | P0 | Kill app; relaunch | Restored session or login | — | — | MOB-AUTH-010 | Mobile/Auth | **NOT TESTED** | Pending |
| GA-MOB-006 | Logout | Y | P0 | Logout from profile/settings | API logout; cache cleared | — | — | MOB-AUTH-008 | Mobile/Auth | **NOT TESTED** | Pending |
| GA-MOB-007 | Password reset E2E | Y | P0 | Forgot password → inbox → reset | Email received; token single-use | Pre-fix: no email (webhook path) | CI only; no inbox | SRB-001 | Mobile/Auth | **NOT TESTED** | After VPS deploy + SMTP |
| GA-MOB-008 | Phone OTP | Y | P0 | Request OTP to handset | SMS received or provider block | Termii sender pending | SRB-002 | Mobile/Auth | **BLOCKED BY PROVIDER** | After sender approval |
| GA-MOB-009 | Profile load | Y | P1 | Open profile signed in | Real `GET /users/me` data | — | — | MOB-PROF-001 | Mobile | **NOT TESTED** | Pending |
| GA-MOB-010 | Profile edit | Y | P1 | Edit name/jurisdiction; save | Persists after reload | — | — | MOB-PROF-002 | Mobile | **NOT TESTED** | Pending |
| GA-MOB-011 | Avatar upload | Y | P0 | Gallery/camera JPG/PNG/WEBP | Presign→PUT→confirm→visible | Prior manual QA failures | CI presign only | SRB-005 | Mobile/Infra | **NOT TESTED** | After deploy + Spaces |
| GA-MOB-012 | Emergency contacts CRUD | Y | P1 | Add/edit/delete contact | API CRUD reflected | — | — | MOB-PROF-004 | Mobile | **NOT TESTED** | Pending |
| GA-MOB-013 | Notification inbox | Y | P0 | Open notifications tab | Paginated inbox loads | Was localhost URL | Code fix CI verified | SRB-003 | Mobile | **NOT TESTED** | After deploy + APK |
| GA-MOB-014 | Broadcast feed | Y | P0 | Open broadcasts | Nearby feed loads | Was localhost URL | Code fix CI verified | SRB-004 | Mobile | **NOT TESTED** | After deploy + APK |
| GA-MOB-015 | Standard SOS | Y | P0 | Send Emergency Now | Incident created ≤45s | Infinite spinner reported pre-fix | CI timeout tests | SRB-006 | Mobile | **NOT TESTED** | Per report on device |
| GA-MOB-016 | Silent SOS | Y | P0 | Silent SOS from sheet | Incident with silent flag | — | — | MOB-EMRG-002 | Mobile | **NOT TESTED** | Pending |
| GA-MOB-017 | Report types (×7) | Y | P0 | Submit crime/fire/kidnap/abuse/suspicious/missing/stolen | Each terminates; DB record | Infinite loading pre-fix | CI partial | SRB-006 | Mobile | **NOT TESTED** | 7 sub-retests |
| GA-MOB-018 | Loading termination | Y | P0 | Any async submit | Spinner stops ≤45s | — | — | SRB-006 | Mobile | **NOT TESTED** | Pending |
| GA-MOB-019 | Offline queue/retry | Y | P0 | Airplane mode SOS; restore network | Queued replay once | — | — | MOB-EMRG-007 | Mobile | **NOT TESTED** | Pending |
| GA-MOB-020 | Incident history/detail | Y | P0 | Open tracking/history | API-backed list/detail | Checklist: mobile list FAIL historically | MOB-EMRG-010 | Mobile | **NOT TESTED** | Verify post-deploy |
| GA-MOB-021 | Location submission | Y | P0 | Report with GPS | Coordinates in payload | — | — | MOB-EMRG-005 | Mobile | **NOT TESTED** | Pending |
| GA-MOB-022 | Theme contrast | Y | P1 | Light/dark on report + notifications | Readable labels | Low contrast reported | Code fix CI | SRB-011 | Mobile | **NOT TESTED** | Device pass |
| GA-MOB-023 | Police station filters | Y | P1 | State/LGA/radius search | Factual API data or empty | Was demo Ikeja list | API wired CI | SRB-009 | Mobile/Data | **NOT TESTED** | Dataset QA |
| GA-MOB-024 | Honest feature availability | Y | P1 | Live video, job vacancies | Hidden/disabled honestly | Misleading copy fixed | SRB-007,010 | Mobile | **NOT TESTED** | Device UI |
| GA-MOB-025 | Staging API URL config | Y | P0 | Runtime network inspection | `https://staging-api.theeye.com.ng/v1` only | localhost regressions fixed in code | CI + config review | SRB-003,004 | Mobile | **NOT TESTED** | Device packet capture |

---

## Gate B — Admin

**URL:** `https://staging-dashboard8jps.theeye.com.ng`  
**Build:** Validate Staging admin Linux build PASS on `841d96a` (CI only — not Gate PASS)

| ID | Feature | R1 | Sev | Reproduction | Expected | Actual | Evidence | Blocker | Owner | Status | Retest |
|----|---------|:--:|:---:|--------------|----------|--------|----------|---------|-------|--------|--------|
| GB-ADM-001 | Login | Y | P0 | Super admin credentials | Dashboard loads | — | — | — | Admin | **NOT TESTED** | Browser QA |
| GB-ADM-002 | Session restore | Y | P0 | Refresh protected route | Session maintained | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-003 | Logout | Y | P0 | Click logout | POST clears cookies → `/login` | 405 on misrouted GET pre-fix | CI script only | SRB-012 | Admin | **NOT TESTED** | After deploy |
| GB-ADM-004 | User list/detail | Y | P1 | Users module | Real user records | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-005 | KYC queue/review | Y | P1 | KYC queue | Approve/reject works | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-006 | Incident list/detail | Y | P0 | Incidents module | Real incidents | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-007 | Verify/reject | Y | P0 | Incident actions | State transitions | — | — | — | Admin/Dispatch | **NOT TESTED** | Pending |
| GB-ADM-008 | Assign/reassign/escalate | Y | P0 | Dispatch actions | Assignment persisted | Sprint 6 on separate PR #20 | — | Admin/Dispatch | **NOT TESTED** | Pending |
| GB-ADM-009 | Dispatch queue | Y | P0 | `/dispatch` | Queue with SLA indicators | — | — | — | Admin/Dispatch | **NOT TESTED** | Pending |
| GB-ADM-010 | Timeline | Y | P1 | Incident detail timeline | Factual events | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-011 | Broadcast lifecycle | Y | P0 | Create→approve→dispatch | Scheduled/sent broadcasts | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-012 | Notification monitoring | Y | P1 | Notifications admin | Real queue metrics | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-013 | NW moderation | Y | P1 | Community moderation | Approve/reject/ban | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-014 | Smartwatch console | Y | P1 | Device detail/actions | Revoke/lost/stolen | PR #18 not merged | — | Admin/Watch | **NOT TESTED** | After PR #18 |
| GB-ADM-015 | Geo/agency scoping | Y | P0 | Scoped admin roles | Denied cross-scope ops | — | — | — | Admin | **NOT TESTED** | Role matrix |
| GB-ADM-016 | Audit BigInt serialization | Y | P1 | Audit endpoints | JSON without BigInt errors | — | — | — | Admin/API | **NOT TESTED** | Pending |
| GB-ADM-017 | No dead buttons | Y | P1 | Click all primary actions | All wired or disabled honestly | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-018 | No raw JSON pages | Y | P1 | Navigate all modules | Rendered UI only | — | — | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-019 | No fake data | Y | P0 | Maps/charts/dispatch | Real coordinates/metrics | Mock coords noted in Sprint 5 audit | — | Admin | **NOT TESTED** | Pending |
| GB-ADM-020 | Linux production build | Y | P0 | CI/admin Docker build | Build passes | Validate Staging PASS | Run 29991936821 | — | Admin/DevOps | **NOT TESTED** | CI ≠ browser Gate PASS |

---

## Gate C — Smartwatch

**Branch note:** Sprint 7 on PR #18 (`723a238`) — **not merged** to certified staging. Watch runtime QA blocked until merge + deploy.

| ID | Feature | R1 | Sev | Reproduction | Expected | Actual | Evidence | Blocker | Owner | Status | Retest |
|----|---------|:--:|:---:|--------------|----------|--------|----------|---------|-------|--------|--------|
| GC-WCH-001 | APK install | Y | P0 | Install watch staging APK | Installs cleanly | — | PR #18 open | — | Watch | **NOT TESTED** | After merge |
| GC-WCH-002 | Package/Firebase identity | Y | P0 | Inspect manifest | Staging package + `the-eye-2stg` | — | — | — | Watch | **NOT TESTED** | Pending |
| GC-WCH-003 | Launcher | Y | P0 | Open on square watch | Boot screen renders | — | — | — | Watch | **NOT TESTED** | Pending |
| GC-WCH-004 | Boot recovery | Y | P0 | Reboot during emergency | State restored | Code on PR #18 | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-005 | Pairing | Y | P0 | Pair flow | Device registered | — | — | Watch | **NOT TESTED** | Pending |
| GC-WCH-006 | Unpairing | Y | P0 | Unpair | Token deactivated | — | — | Watch | **NOT TESTED** | Pending |
| GC-WCH-007 | Standard SOS | Y | P0 | Hold SOS | Incident created | — | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-008 | Silent SOS | Y | P0 | Silent action | Silent flag set | — | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-009 | Offline replay | Y | P0 | Offline SOS then online | Single incident | Encrypted queue PR #18 | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-010 | Battery/network telemetry | Y | P1 | During emergency | Real device readings | — | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-011 | Emergency location updates | Y | P0 | Active tracking | Location posts | — | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-012 | Active emergency restore | Y | P0 | Kill app mid-emergency | Tracking resumes | — | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-013 | Push registration | Y | P0 | Register FCM on watch | Device token stored | — | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-014 | Push alert receipt | Y | P0 | Send test push | Alert on watch | — | — | Watch | **BLOCKED BY HARDWARE** | Physical watch |
| GC-WCH-015 | Alert acknowledgement | Y | P0 | Ack from watch | Backend records ack | — | — | Watch | **NOT TESTED** | Hardware |
| GC-WCH-016 | Status refresh | Y | P1 | Poll during incident | UI matches server | — | — | Watch | **NOT TESTED** | Pending |
| GC-WCH-017 | Terminal incident cleanup | Y | P0 | Resolve incident | Tracking stops | — | — | Watch | **NOT TESTED** | Pending |
| GC-WCH-018 | Revoked device denial | Y | P0 | Revoke in admin | SOS policy per spec | PR #18 code | — | Watch/Admin | **NOT TESTED** | After merge |
| GC-WCH-019 | Lost/stolen restrictions | Y | P0 | Mark lost/stolen | Non-emergency blocked | PR #18 code | — | Watch | **NOT TESTED** | After merge |
| GC-WCH-020 | No fake telemetry | Y | P0 | Inspect logs/API | No mock success | — | — | Watch | **NOT TESTED** | Pending |

**Deferred (approved for Sprint 8 entry if not Release 1):** Wear Data Layer phone relay (documented on PR #18); fall detection; physical hardware buttons; heart-rate triggers.

---

## Gate D — Backend & Infrastructure

**Probe timestamp:** 2026-07-23T09:04:24Z · **VPS commit uncertified** (likely pre-`841d96a`)

| ID | Feature | R1 | Sev | Reproduction | Expected | Actual | Evidence | Blocker | Owner | Status | Retest |
|----|---------|:--:|:---:|--------------|----------|--------|----------|---------|-------|--------|--------|
| GD-INF-001 | API healthy | Y | P0 | `GET /v1/health/ready` | status ok | status ok | timestamp above | — | DevOps | **NOT TESTED** | After deploy @841d96a |
| GD-INF-002 | PostgreSQL/PostGIS | Y | P0 | health ready | database ok | database ok | same probe | — | DevOps | **NOT TESTED** | Certified deploy |
| GD-INF-003 | Redis | Y | P0 | health ready | redis ok | redis ok | same probe | — | DevOps | **NOT TESTED** | Certified deploy |
| GD-INF-004 | Notification worker | Y | P0 | health ready | worker ok | worker ok, heartbeat 1.5s | same probe | — | DevOps | **NOT TESTED** | Certified deploy |
| GD-INF-005 | Broadcast scheduler | Y | P0 | scheduler health endpoint | heartbeat recent | Not probed this session | — | DevOps | **NOT TESTED** | Pending |
| GD-INF-006 | Heartbeats current | Y | P0 | worker + scheduler | age < threshold | worker yes; scheduler unknown | partial | — | DevOps | **NOT TESTED** | Full probe |
| GD-INF-007 | Firebase staging project | Y | P0 | health firebase block | the-eye-2stg | the-eye-2stg | same probe | — | DevOps | **NOT TESTED** | Certified deploy |
| GD-INF-008 | FCM simulation off | Y | P0 | health firebase | simulation false | simulation false | same probe | — | DevOps | **NOT TESTED** | Certified deploy |
| GD-INF-009 | SMTP password reset | Y | P0 | Request reset on staging | Inbox receives email | Webhook path failed pre-PR#19 | SRB-001 | Auth/DevOps | **NOT TESTED** | After deploy |
| GD-INF-010 | Termii SMS | Y | P0 | Request OTP | ProviderAccepted or clear fail | Sender ID pending | SRB-002 | Auth | **BLOCKED BY PROVIDER** | Sender approval |
| GD-INF-011 | S3/Spaces uploads | Y | P0 | Avatar/evidence presign PUT | Object stored | INF-006 historically blocked | SRB-005 | Infra | **NOT TESTED** | E2E upload |
| GD-INF-012 | LiveKit | Y | P0 | Start live video / health | WSS join or honest disable | healthz 200; room join untested | SRB-008 | Infra | **NOT TESTED** | WSS QA |
| GD-INF-013 | Nginx/TLS | Y | P0 | healthz all hosts | 200 TLS | api/admin/livekit 200 | curl probe | — | DevOps | **NOT TESTED** | Certified deploy |
| GD-INF-014 | Migrations applied | Y | P0 | `prisma migrate deploy` on VPS | No pending migrations | Not verified on VPS | — | DevOps | **NOT TESTED** | Post-deploy |
| GD-INF-015 | No crash loops | Y | P0 | `docker compose ps` | All healthy | Not inspected | — | DevOps | **NOT TESTED** | VPS access |
| GD-INF-016 | Graceful provider degradation | Y | P0 | SOS with SMS/FCM down | Incident still created | Code intent; not runtime tested | — | API | **NOT TESTED** | Fault injection |
| GD-INF-017 | Request IDs / error codes | Y | P1 | Failed API call | x-request-id + code | Not sampled live | — | API | **NOT TESTED** | Pending |
| GD-INF-018 | Backups/rollback docs | Y | P1 | Review runbook | Documented procedure | STAGING_DEPLOYMENT.md exists | docs only | — | DevOps | **NOT TESTED** | Execute backup |

---

## Artifact registry (Phase 3)

| Artifact | Commit | Tag/Version | SHA-256 / ID | Status |
|----------|--------|-------------|--------------|--------|
| Git `staging` | `841d96a` | merge PR #19 | — | **Certified source** |
| API Docker image | `841d96a` | `the-eye-api:staging-validate` (CI) | CI build only | Not deployed to VPS |
| Worker image | `841d96a` | same API image | — | Not redeployed |
| Admin web image | `841d96a` | `the-eye-admin-web:staging-validate` | CI build only | Not deployed |
| Mobile APK | `841d96a` | `0.1.0+1` / `com.theeye.app.staging` | `C823F10B…38C22` | Built; **rebuild required** (clean removed artifact) |
| Watch APK | — | — | — | **Not built** (PR #18 not merged) |

**Firebase:** `the-eye-2stg` · **API URL:** `https://staging-api.theeye.com.ng/v1`

---

## P0/P1 open defects (integration gate)

| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| SRB-001 | P0 | Password reset SMTP E2E unverified on live VPS | NOT TESTED |
| SRB-002 | P0 | Termii OTP — sender ID approval | BLOCKED BY PROVIDER |
| SRB-003 | P0 | Notifications inbox — device QA pending | NOT TESTED |
| SRB-004 | P0 | Broadcasts — device QA pending | NOT TESTED |
| SRB-005 | P0 | Avatar upload — Spaces E2E pending | NOT TESTED |
| SRB-006 | P0 | SOS/report termination — per-type device QA | NOT TESTED |
| SRB-012 | P0 | Admin logout — live browser QA pending | NOT TESTED |
| SRB-008 | P0 | LiveKit room join or honest disable | NOT TESTED |
| SRB-009 | P1 | Police dataset + filters | NOT TESTED |
| SRB-011 | P1 | Theme contrast device pass | NOT TESTED |
| DEP-001 | P0 | VPS not redeployed to `841d96a` | OPEN |
| PR18-001 | P0 | Sprint 7 watch reliability not on staging | OPEN (PR #18) |

---

## Formal deferrals (approved scope)

| Item | Rationale | Blocks Sprint 8? |
|------|-----------|:----------------:|
| Termii Sender ID (SRB-002) | Provider approval; OTP may be BLOCKED BY PROVIDER if phone auth not Release 1 mandatory | Only if phone OTP required for R1 |
| Wear Data Layer phone relay | Deferred on PR #18; standalone HTTPS path for Sprint 7 | No |
| Fall detection / HR / physical buttons | Hardware-only; not Release 1 | No |
| Job Vacancies feature | Coming soon snackbar; not Release 1 | No |
| LiveKit full E2E | Acceptable if honestly disabled in UI | No, if GA-MOB-024 PASS |

---

## Retest procedure

For each FAIL or NOT TESTED row after fix:

1. Assign/update blocker ID  
2. Reproduce on certified staging commit  
3. Capture sanitized request ID  
4. Root cause + failing automated test  
5. Focused PR → staging → CI green → merge → redeploy  
6. Rebuild APK from exact commit  
7. Retest row → update **Status** and **Retest** columns  
8. Never delete historical failure notes  
