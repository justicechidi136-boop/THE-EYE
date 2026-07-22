# THE EYE — Production Functionality Checklist

**Single source of truth for release readiness.**  
**Branch baseline:** `staging`  
**Last updated:** 2026-07-22 (Sprint 4 Phase 1 — notifications & broadcasts audit)  
**Release gate:** **NOT READY FOR PRODUCTION**  
**Sprint 2 status:** **CODE COMPLETE — PENDING STAGING QA** (no PASS without device/runtime evidence)  
**Sprint 3 status:** **CODE COMPLETE — PENDING STAGING QA**  
**Sprint 4 status:** **IN PROGRESS — PHASES 3 AND 8 CODE COMPLETE**

> Rules enforced: PASS requires working navigation, real API, backend, DB (where applicable), authorization, UI update, and verified evidence. UI-only or placeholder data = FAIL / NOT IMPLEMENTED.

---

## Release Dashboard

| Metric | Count |
|--------|------:|
| **Total features tracked** | **249** |
| **PASS** | **77** |
| **FAIL** | **28** |
| **PARTIAL** | **62** |
| **BLOCKED** | **19** |
| **NOT IMPLEMENTED** | **54** |
| **NOT APPLICABLE** | **1** |
| **NOT TESTED** | **7** |
| **P0 blockers (open)** | **34** |
| **P1 blockers (open)** | **26** |

*Counts derived from checklist rows (231 feature IDs). Recalculate after each update.*

### Completion by platform (% PASS of applicable items)

| Platform | Applicable | PASS | Completion |
|----------|----------:|-----:|-----------:|
| Mobile App | 77 | 22 | **28.6%** |
| Smartwatch | 27 | 12 | **44.4%** |
| Admin Dashboard | 75 | 22 | **29.3%** |
| Backend / API | 34 | 13 | **38.2%** |
| Infrastructure | 18 | 8 | **44.4%** |

*Sprint 2 moved many profile rows from NOT IMPLEMENTED → NOT TESTED/PARTIAL. PASS count unchanged until staging device QA.*

*Completion = PASS ÷ applicable rows. UI presence alone does not count.*

### Summary by status

| Status | Mobile | Watch | Admin | Backend | Infra |
|--------|-------:|------:|------:|--------:|------:|
| PASS | 22 | 12 | 22 | 13 | 8 |
| FAIL | 16 | 3 | 0 | 0 | 0 |
| PARTIAL | 18 | 5 | 15 | 8 | 4 |
| BLOCKED | 8 | 4 | 3 | 2 | 3 |
| NOT IMPLEMENTED | 12 | 2 | 37 | 11 | 3 |
| NOT APPLICABLE | 0 | 0 | 1 | 0 | 0 |
| NOT TESTED | 0 | 2 | 0 | 0 | 0 |

*Platform status columns are approximate rollups; authoritative status is per row below.*

### Summary by severity (open non-PASS items)

| Severity | Count |
|----------|------:|
| P0 Critical | 38 |
| P1 High | 24 |
| P2 Medium | 45 |
| P3 Low | 31 |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-07-22 | Sprint 4 staging QA attempt | Deploy workflow `29887082714` failed preflight: GitHub `staging` environment missing `vars.NEXT_PUBLIC_API_BASE_URL`. Live staging API @ `ca227fc` era (pre-Sprint-4): `/v1/health/ready` returns database/redis only; `/v1/broadcasts/admin/scheduler-health` returns 404; no worker/scheduler heartbeats observable. Feature branch `c66561e` local CI green (API 238/238, mobile 106/106, watch 49/49). End-to-end device QA not executed (no VPS deploy, no physical phone/watch in this session). No PASS promotions. |
| 2026-07-22 | Sprint 4 Phase 1 | Full notifications & broadcasts re-audit on `staging` @ `ca227fc` (RC1). Sprint 4 gap table added on `feature/sprint-4-notifications-broadcasts`. No implementation changes in this entry. No PASS promotions. Sprint 1–3 statuses unchanged. |
| 2026-07-22 | Sprint 3 Phase 1–2 | Full incident lifecycle re-audit on `staging` @ `45c2197`. Sprint 3 gap table + canonical contract (`docs/INCIDENT_CONTRACT.md`) added. Implementation started on `feature/sprint-3-incident-reporting`: idempotency, location endpoint, notification enqueue, mobile history/detail, admin verify/assign/evidence viewer. No PASS without staging device QA. |
| 2026-07-21 | Sprint 2 implementation | Citizen profile lifecycle coded on `feature/sprint-2-citizen-profile`: PATCH/me, emergency contacts CRUD, avatar presign/confirm, KYC submit+admin review, deletion deactivate, mobile completion/edit/contacts/KYC, admin KYC queue + citizen detail. Automated API + mobile tests green. No PASS without staging redeploy + device QA. Full erasure/preferences sync remain BLOCKED. |
| 2026-07-21 | Sprint 2 Phase 1 | Full citizen-profile re-audit on `staging` @ `74565ff`. Sprint 2 gap table added; 13 new checklist rows (MOB-PROF-009–011, API-PROF-001–010). MOB-PROF-001 downgraded to PARTIAL pending completion flow + avatar. No implementation changes in this entry. |
| 2026-07-21 | Sprint 1 (Auth) | Session restore, token refresh-on-restore, logout API, auth delivery webhooks, required registration names, guest flow, demo profile defaults removed. Backend auth tests + mobile auth tests green. Staging device QA pending. |
| 2026-07-21 | Release audit | Initial checklist created from full-repo audit (`staging` @ `49613b1`). Mobile staging APK build/install verified 2026-07-20 (Firebase `the-eye-2stg`, API `https://staging-api.theeye.com.ng/v1`, login screen + startup logs). |

---

## Column legend

| Column | Description |
|--------|-------------|
| Status | PASS / FAIL / PARTIAL / BLOCKED / NOT IMPLEMENTED / NOT APPLICABLE / NOT TESTED |
| Blocker | Y = prevents production release until resolved or formally waived |
| Files Changed | Updated when fixes land; `—` at initial audit |
| Deployment Required | Y if staging/production deploy needed to verify fix |

---

## MOBILE APP

### Authentication

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| MOB-AUTH-001 | Auth | Email registration | Citizen | Mobile | `/register` | Y | Y | `POST /v1/auth/register` | Y | Y | Y | Y | Y | Y | N | N | N | **PARTIAL** | P0 | Y | Requires first/last name + staging device verify | `auth.service.ts`, `auth_validation.dart`, `main.dart` | Y | Backend rejects missing names; mobile validates; demo geo defaults removed |
| MOB-AUTH-002 | Auth | Email login | Citizen | Mobile | `/login` | Y | Y | `POST /v1/auth/login` | Y | Y | Y | Y | Y | Y | Y | Y | N | **PASS** | P0 | N | — | — | N | Session stored locally after login; guest entry added |
| MOB-AUTH-003 | Auth | Phone login | Citizen | Mobile | `/login` | Y | Y | `POST /v1/auth/phone/request-otp`, `/verify-otp` | Y | Y | Y | Y | Y | Y | Y | N | N | **PARTIAL** | P0 | Y | `AUTH_PHONE_OTP_WEBHOOK_URL` must be set on staging | `auth-delivery.service.ts`, `auth.service.ts` | Y | Delivery wired; returns 503 until webhook configured |
| MOB-AUTH-004 | Auth | OTP verification | Citizen | Mobile | `/otp-verification` | Y | Y | `POST /v1/auth/phone/verify-otp` | Y | Y | Y | Y | Y | Y | Y | N | N | **PARTIAL** | P0 | Y | Depends on MOB-AUTH-003 OTP delivery webhook | `auth-delivery.service.ts` | Y | Unit tests cover API error mapping |
| MOB-AUTH-005 | Auth | Google sign-in | Citizen | Mobile | `/login` | Y | Y | `POST /v1/auth/firebase/exchange` | Y | Y | Y | Y | Y | Y | N | Y | N | **BLOCKED** | P0 | Y | Requires Firebase + reachable API; lifecycle edge cases | `auth.service.ts` | Y | Hardcoded Lagos/Ikeja profile defaults removed |
| MOB-AUTH-006 | Auth | Apple sign-in | Citizen | Mobile | `/login` | Y | Y | `POST /v1/auth/firebase/exchange` | Y | Y | Y | Y | Y | Y | N | N | N | **BLOCKED** | P1 | Y | Platform availability + Firebase + backend | — | Y | Gated by `SocialAuthService.isAppleSignInSupported` |
| MOB-AUTH-007 | Auth | Password reset | Citizen | Mobile | `/login` | Y | Y | `POST /v1/auth/password-reset/request` | Y | Y | Y | Y | Y | Y | Y | N | N | **PARTIAL** | P0 | Y | `AUTH_PASSWORD_RESET_WEBHOOK_URL` must be set on staging | `auth-delivery.service.ts`, `auth.service.ts` | Y | TODO removed; webhook dispatch implemented |
| MOB-AUTH-008 | Auth | Logout | Citizen | Mobile | Profile / Settings | Y | Y | `POST /v1/auth/logout` | Y | Y | Y | Y | Y | Y | Y | N | N | **PARTIAL** | P0 | Y | Staging device verify revoke + local clear | `auth_service.dart`, `main.dart` | Y | Calls API logout then clears local session |
| MOB-AUTH-009 | Auth | Token refresh | Citizen | Mobile | Background | Y | Y | `POST /v1/auth/refresh` | Y | Y | Y | Y | Y | Y | Y | N | N | **PARTIAL** | P0 | Y | Refresh on session restore only; no proactive background refresh | `the_eye_api_client.dart`, `auth_service.dart` | Y | `auth_session_restore_test.dart` covers 401→refresh |
| MOB-AUTH-010 | Auth | Session restoration | Citizen | Mobile | `/` splash | Y | Y | `GET /v1/users/me`, `POST /v1/auth/refresh` | Y | Y | Y | Y | Y | Y | Y | N | N | **PARTIAL** | P0 | Y | Staging cold-start device test pending | `main.dart`, `auth_service.dart` | Y | Splash validates persisted session; routes home/profile/login |
| MOB-AUTH-011 | Auth | Account suspension handling | Citizen | Mobile | `/account-status` | Y | Y | Via auth errors | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Error path only; not device-tested | — | N | Shown on suspended/deactivated social auth |

### Profile

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| MOB-PROF-001 | Profile | View profile | Citizen | Mobile | `/profile` | Y | Y | `GET /v1/users/me` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | Y | Code: real profile + geo + contacts count + avatar; device QA pending | `profile_screen.dart` | Y | Do not PASS without staging device |
| MOB-PROF-002 | Profile | Edit profile | Citizen | Mobile | `/profile/edit` | Y | Y | `PATCH /v1/users/me` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | Y | Edit UI wired; staging device QA pending | `profile_edit_screen.dart` | Y | — |
| MOB-PROF-003 | Profile | Avatar upload | Citizen | Mobile | `/profile` | Y | Y | presign + confirm | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P1 | Y | Pipeline coded; S3 staging env required (INF-006) | `avatar_upload_service.dart` | Y | — |
| MOB-PROF-004 | Profile | Emergency contacts | Citizen | Mobile | `/profile/emergency-contacts` | Y | Y | CRUD `/users/me/emergency-contacts` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | Y | List/add/edit/delete UI; device QA pending | `emergency_contacts_screen.dart` | Y | Do not claim SOS notify delivery without verify |
| MOB-PROF-005 | Profile | KYC | Citizen | Mobile | `/profile/kyc` | Y | Y | `POST /users/me/kyc` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | Y | Status + submit foundation; doc upload optional; legal docs may BLOCK | `kyc_screen.dart` | Y | — |
| MOB-PROF-006 | Profile | Trust score | Citizen | Mobile | `/profile` | Y | Y | `GET /v1/users/me` | Y | Y | Y | Y | Y | Y | N | N | N | **PARTIAL** | P2 | N | Numeric display; null = Not rated; no client edit; calc rules BLOCKED | — | N | No hardcoded 82 |
| MOB-PROF-007 | Profile | Preferences (theme, contrast, low-data) | Citizen | Mobile | `/settings` | Y | Y | — (local) | N/A | N/A | N/A | Y | Y | Y | N | N | N | **PARTIAL** | P2 | N | Local-only theme/contrast/low-data; no server-synced notification/privacy prefs | — | N | `theme_and_car_profile_test.dart` |
| MOB-PROF-008 | Profile | Account deletion | Citizen | Mobile | `/settings` | Y | Y | `POST /users/me/deletion-request` | Y | PARTIAL | Y | Y | Y | Y | N | N | N | **PARTIAL** | P2 | Y | Deactivate + revoke sessions; full erasure BLOCKED pending legal retention | `main.dart` settings | Y | Explicit retention message |
| MOB-PROF-009 | Profile | Profile completion routing | Citizen | Mobile | splash/login/register/social/otp | Y | Y | auth + `GET /v1/users/me` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Password/OTP/register/social/splash honor `profileComplete` | `main.dart`, `auth_service.dart` | Y | Device QA pending |
| MOB-PROF-010 | Profile | Profile completion form | Citizen | Mobile | `/profile` | Y | Y | `PATCH /v1/users/me` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Required name + jurisdiction; no silent NG default | `profile_screen.dart` | Y | — |
| MOB-PROF-011 | Profile | Server-synced citizen preferences | Citizen | Mobile | `/settings` | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | No typed preferences API | — | Y | Notification/privacy prefs out of scope |

### Emergency

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| MOB-EMRG-001 | Emergency | SOS | Citizen | Mobile | Eye FAB / bottom sheet | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | — | — | N | `sos_actions_test.dart`; SOS type via incidents |
| MOB-EMRG-002 | Emergency | Silent SOS | Citizen | Mobile | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P1 | Y | No distinct silent SOS flow | — | Y | — |
| MOB-EMRG-003 | Emergency | SOS cancellation | Citizen | Mobile | SOS sheet | Y | Y | — | N/A | N/A | N/A | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | UI dismiss only before submit | — | N | No cancel-after-submit |
| MOB-EMRG-004 | Emergency | Emergency type selection | Citizen | Mobile | SOS sheet | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | Types mapped in submission service |
| MOB-EMRG-005 | Emergency | GPS capture | Citizen | Mobile | SOS / reports | Y | Y | In incident payload | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | Geolocator + draft builder |
| MOB-EMRG-006 | Emergency | Live location (during stream) | Citizen | Mobile | `/live-video` | Y | Y | `POST /v1/live-video/sessions/:id/location` | Y | Y | Y | Y | Y | Y | N | N | N | **BLOCKED** | P0 | Y | Requires LiveKit + live session | — | Y | Code complete in `main.dart` |
| MOB-EMRG-007 | Emergency | Offline SOS queue | Citizen | Mobile | Background | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | `pending_retry_coordinator.dart` |
| MOB-EMRG-008 | Emergency | Emergency contacts notification | Citizen | Mobile | — | N | N | Internal | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Backend may notify; no user CRUD | — | Y | Contacts read during SOS server-side |
| MOB-EMRG-009 | Emergency | Incident status | Citizen | Mobile | `/tracking` | Y | Y | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | No fetch API wired in mobile | — | Y | In-memory list only |
| MOB-EMRG-010 | Emergency | Incident history | Citizen | Mobile | `/tracking` | Y | Y | `GET /v1/incidents` exists | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P0 | Y | Mobile does not call list API | — | Y | Session-local `controller.incidents` |

### Incident reporting

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| MOB-INCD-001 | Incidents | Create report | Citizen | Mobile | `/report/*` | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | — | — | N | 7 report routes |
| MOB-INCD-002 | Incidents | Category selection | Citizen | Mobile | `/report/*` | Y | Y | In payload | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| MOB-INCD-003 | Incidents | Description | Citizen | Mobile | `/report/*` | Y | Y | In payload | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| MOB-INCD-004 | Incidents | Photo capture | Citizen | Mobile | Report evidence | Y | Y | presign/confirm | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | `evidence_capture_service_test.dart` |
| MOB-INCD-005 | Incidents | Video capture | Citizen | Mobile | Report evidence | Y | Y | presign/confirm | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| MOB-INCD-006 | Incidents | Audio evidence | Citizen | Mobile | Report evidence | Y | Y | presign/confirm | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P1 | N | — | — | N | — |
| MOB-INCD-007 | Incidents | Live video | Citizen | Mobile | `/live-video` | Y | Y | live-video module | Y | Y | Y | Y | Y | Y | N | N | N | **BLOCKED** | P0 | Y | LiveKit env required | — | Y | — |
| MOB-INCD-008 | Incidents | GPS timestamp | Citizen | Mobile | Reports | Y | Y | In payload | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| MOB-INCD-009 | Incidents | Upload progress | Citizen | Mobile | Report evidence | Y | Y | S3 PUT | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Progress UI exists; not E2E tested | — | N | — |
| MOB-INCD-010 | Incidents | Draft saving | Citizen | Mobile | Offline | Y | Y | Local store | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | `pending_submission_store.dart` |
| MOB-INCD-011 | Incidents | Offline retry | Citizen | Mobile | Banner / tracking | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| MOB-INCD-012 | Incidents | Submit | Citizen | Mobile | Report screens | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| MOB-INCD-013 | Incidents | View report | Citizen | Mobile | `/tracking` | Y | Y | `GET /v1/incidents` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | API history wired Sprint 3; staging device QA pending | `incident_history_service.dart` | Y | Replaces session-local list |
| MOB-INCD-014 | Incidents | Edit draft | Citizen | Mobile | Report resume | Y | Y | Local only | N/A | Y | N | Y | Y | Y | N | N | N | **NOT TESTED** | P2 | N | Compose draft resume on report screens | `main.dart` | N | Distinct from offline queue |
| MOB-INCD-015 | Incidents | Delete draft | Citizen | Mobile | `/tracking` | Y | Y | Local | N/A | Y | N | Y | Y | Y | N | N | N | **NOT TESTED** | P2 | N | Delete icon on saved drafts | `compose_draft_store.dart` | N | — |
| MOB-INCD-016 | Incidents | Missing person report | Citizen | Mobile | `/missing-person` | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P0 | N | — | — | N | Dedicated payload |
| MOB-INCD-017 | Incidents | Incident history API | Citizen | Mobile | `/tracking` | Y | Y | `GET /v1/incidents` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Wired in Sprint 3; staging device QA pending | `incident_history_service.dart` | Y | Replaces session-local list |
| MOB-INCD-018 | Incidents | Incident detail screen | Citizen | Mobile | `/incident-detail` | Y | Y | `GET /v1/incidents/:id` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Detail screen added Sprint 3 | `incident_detail_screen.dart` | Y | Pull-to-refresh |
| MOB-INCD-019 | Incidents | Status refresh | Citizen | Mobile | `/tracking` | Y | Y | `GET /v1/incidents` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | N | Pull-to-refresh + API reload; push update still BLOCKED (FCM) | `main.dart` | N | — |
| MOB-INCD-020 | Incidents | Compose draft save | Citizen | Mobile | Report flow | Y | Y | Local store | N/A | Y | N | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | N | Auto-save + resume from tracking | `compose_draft_store.dart` | N | Distinct from offline queue |
| MOB-INCD-021 | Incidents | Emergency contact IDs on submit | Citizen | Mobile | Report/SOS | Y | Y | In payload | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | N | Multi-select picker wired | `main.dart` | N | — |
| MOB-INCD-022 | Incidents | Live location updates | Citizen | Mobile | Active emergency | Y | Y | `POST /v1/incidents/:id/location` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | N | 10s tracker after emergency submit | `incident_location_tracker.dart` | Y | Staging device QA |

### Notifications

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| MOB-NOTF-001 | Notifications | FCM token registration | Citizen | Mobile | Background | Y | N/A | `POST /v1/notifications/push-tokens` | Y | Y | Y | Y | Y | Y | N | Y | N | **BLOCKED** | P0 | Y | Android only; iOS skipped; FCM creds required | — | Y | `push_notification_service.dart:56-58` |
| MOB-NOTF-002 | Notifications | Foreground notifications | Citizen | Mobile | — | Y | N/A | — | Y | Y | Y | Y | Y | Y | N | N | N | **PARTIAL** | P0 | Y | Android local display; depends on MOB-NOTF-001 | — | Y | — |
| MOB-NOTF-003 | Notifications | Background notifications | Citizen | Mobile | — | Y | N/A | FCM | Y | Y | Y | Y | Y | N | N | N | N | **BLOCKED** | P0 | Y | FCM + backend dispatch | — | Y | — |
| MOB-NOTF-004 | Notifications | Terminated-app notifications | Citizen | Mobile | — | Y | N/A | FCM | Y | Y | Y | Y | Y | N | N | N | N | **BLOCKED** | P0 | Y | Not verified on device | — | Y | — |
| MOB-NOTF-005 | Notifications | Deep links | Citizen | Mobile | Router | Y | Y | — | N/A | N/A | Y | Y | Y | Y | N | N | N | **PASS** | P1 | N | Routing logic only | — | N | `push_deep_link_router_test.dart` |
| MOB-NOTF-006 | Notifications | Notification history | Citizen | Mobile | `/notifications` | Y | Y | `GET /v1/notifications` | Y | Y | Y | Y | Y | Y | N | N | N | **CODE COMPLETE — DEVICE QA PENDING** | P1 | Y | Live inbox wired; device QA pending | `notification_inbox_service.dart`, `main.dart` | Y | Removed hardcoded seed |
| MOB-NOTF-007 | Notifications | Read/unread | Citizen | Mobile | `/notifications` | Y | Y | `PATCH /v1/notifications/:id/read`, `PATCH /read-all` | Y | Y | Y | Y | Y | Y | N | N | N | **CODE COMPLETE — DEVICE QA PENDING** | P1 | Y | Mark read/all read wired | `notification_inbox_service.dart` | Y | Idempotent API + mobile actions |
| MOB-NOTF-008 | Notifications | Notification settings | Citizen | Mobile | `/settings` | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | No settings UI/API | — | Y | — |

### Neighborhood Watch

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| MOB-NW-001 | NW | View communities | Citizen | Mobile | `/neighborhood-watch/my-communities` | Y | Y | `GET /v1/neighborhood-watch/communities` | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | Static strings in UI | — | Y | Backend exists; mobile uses mock |
| MOB-NW-002 | NW | Join community | Citizen | Mobile | `/neighborhood-watch/join` | Y | Y | `POST .../join` | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | Buttons `onPressed: () {}` | — | Y | — |
| MOB-NW-003 | NW | Leave community | Citizen | Mobile | — | N | N | `PATCH .../leave` | Y | Y | Y | N | N | N | N | N | N | **NOT IMPLEMENTED** | P1 | Y | No mobile UI | — | Y | — |
| MOB-NW-004 | NW | Create post | Citizen | Mobile | `/neighborhood-watch/create-post` | Y | Y | `POST .../posts` | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | Post navigates to feed only; no API | — | Y | — |
| MOB-NW-005 | NW | Comment | Citizen | Mobile | — | N | N | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | No comments API | — | Y | Prisma model unused |
| MOB-NW-006 | NW | Report post | Citizen | Mobile | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| MOB-NW-007 | NW | Alerts | Citizen | Mobile | `/neighborhood-watch/alerts` | Y | Y | — | N | N | N | N | N | N | N | N | N | **FAIL** | P1 | Y | Static alert types | — | Y | — |
| MOB-NW-008 | NW | Member list | Citizen | Mobile | — | N | N | — | Y | Y | Y | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | Backend has memberships | — | Y | — |
| MOB-NW-009 | NW | Admin contact | Citizen | Mobile | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P3 | N | — | — | Y | — |
| MOB-NW-010 | NW | Community incident feed | Citizen | Mobile | `/neighborhood-watch/feed` | Y | Y | `GET .../feed` | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | Hardcoded posts | — | Y | — |

### Safety services

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| MOB-SAFE-001 | Safety | Missing persons (submit) | Citizen | Mobile | `/missing-person` | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P0 | N | — | — | N | — |
| MOB-SAFE-002 | Safety | Stolen vehicles (submit) | Citizen | Mobile | `/stolen-vehicle` | Y | Y | `POST /v1/incidents/report` | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P0 | N | Car profile local prefill | — | N | — |
| MOB-SAFE-003 | Safety | Nearby police stations | Citizen | Mobile | `/police-stations` | Y | Y | `GET /v1/police-stations/search` | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | 3 hardcoded Lagos stations | — | Y | API exists |
| MOB-SAFE-004 | Safety | Nearby hospitals | Citizen | Mobile | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | No UI or API | — | Y | — |
| MOB-SAFE-005 | Safety | Maps (in-app) | Citizen | Mobile | NW / police | Y | Y | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | Icon placeholders | — | N | — |
| MOB-SAFE-006 | Safety | Directions | Citizen | Mobile | Police cards | Y | Y | External Google Maps | N/A | N/A | N/A | Y | Y | N | N | N | N | **PASS** | P2 | N | `openMaps()` | — | N | — |
| MOB-SAFE-007 | Safety | Broadcasts feed | Citizen | Mobile | `/broadcasts` | Y | Y | `GET /v1/broadcasts/nearby` | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | Hardcoded 7 alerts | — | Y | API exists |
| MOB-SAFE-008 | Safety | Search | Citizen | Mobile | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| MOB-SAFE-009 | Safety | Filters | Citizen | Mobile | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P3 | N | — | — | Y | — |

---

## SMARTWATCH

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| WCH-BOOT-001 | Boot | Launcher boot | Citizen | Watch | `/` | Y | Y | — | N/A | N/A | N/A | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | `watch_boot_screen_test.dart` |
| WCH-BOOT-002 | Boot | Default home selection | Citizen | Watch | `/launcher/*` | Y | Y | Native channel | N/A | N/A | N/A | Y | Y | Y | N | N | N | **PASS** | P1 | N | — | — | N | `launcher_service_test.dart` |
| WCH-UI-001 | UI | Watch home | Citizen | Watch | `/home` | Y | Y | Heartbeat/GPS | Y | Y | Y | PARTIAL | N | N | N | N | N | **PARTIAL** | P1 | N | Static area risk label | — | N | — |
| WCH-PAIR-001 | Pairing | Pairing | Citizen | Watch | `/pairing` | Y | Y | `/smartwatch/devices/pairing-codes` | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | Poll every 3s |
| WCH-PAIR-002 | Pairing | Unpairing | Citizen | Watch | Settings | Y | Y | Local + revoke token | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P1 | N | — | — | N | Clears credentials |
| WCH-PAIR-003 | Pairing | Standalone mode | Citizen | Watch | Pairing dialog | Y | Y | `/smartwatch/devices/standalone-login` | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P1 | N | — | — | N | — |
| WCH-PAIR-004 | Pairing | Paired mode | Citizen | Watch | Home | Y | Y | Multiple | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| WCH-SOS-001 | SOS | SOS hold | Citizen | Watch | Home | Y | Y | `/smartwatch/sos` | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | 3s hold + countdown | — | N | `sos_service_test.dart` |
| WCH-SOS-002 | SOS | Silent SOS | Citizen | Watch | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P1 | Y | No distinct flow | — | Y | — |
| WCH-SOS-003 | SOS | GPS tracking | Citizen | Watch | `/sos/active` | Y | Y | `/smartwatch/devices/:id/gps` | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P0 | N | 5s emergency interval | — | N | — |
| WCH-SOS-004 | SOS | Offline queue | Citizen | Watch | Connection | Y | Y | `/offline-sync` | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P0 | N | — | — | N | — |
| WCH-INC-001 | SOS | Duplicate SOS prevention | Citizen | Watch | SOS | Y | Y | `/smartwatch/sos` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | N | `clientSubmissionId` from watch idempotency key | `smartwatch.service.ts` | N | Staging device QA |
| WCH-INC-002 | SOS | Server status on watch | Citizen | Watch | Tracking | Y | Y | `/smartwatch/sos/:id/tracking` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | N | Polls server tracking every 5s | `active_emergency_screen.dart` | N | Staging device QA |
| WCH-PUSH-001 | Push | FCM token | Citizen | Watch | Background | Y | N/A | `/notifications/push-tokens` | Y | Y | Y | Y | Y | N | N | N | N | **BLOCKED** | P0 | Y | Firebase config required | — | Y | — |
| WCH-PUSH-002 | Push | Incoming alert | Citizen | Watch | `/alerts/incoming` | Y | Y | FCM | Y | Y | Y | Y | Y | N | N | N | N | **BLOCKED** | P0 | Y | Depends on FCM | — | Y | — |
| WCH-PUSH-003 | Push | Alert acknowledgement | Citizen | Watch | Alert screens | Y | PARTIAL | — | N | N | N | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | Local UI only | — | N | — |
| WCH-PUSH-004 | Push | Alert history | Citizen | Watch | `/alerts/history` | Y | Y | — | N | Y | N | N | N | N | N | N | N | **PARTIAL** | P2 | N | Local prefs only | — | N | No server sync |
| WCH-DEV-001 | Device | Battery status | Citizen | Watch | `/device` | Y | Y | In heartbeat payload | Y | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | Hardcoded 100/80 | — | Y | `HeartbeatService` |
| WCH-DEV-002 | Device | Network status | Citizen | Watch | `/connection` | Y | Y | — | N | N | N | N | N | N | N | N | N | **FAIL** | P1 | Y | `ConnectivityService` static flags | — | N | — |
| WCH-UI-002 | UI | App drawer | Citizen | Watch | `/launcher/drawer` | Y | Y | — | N/A | N/A | N/A | Y | Y | N | N | N | N | **PASS** | P2 | N | — | — | N | — |
| WCH-SET-001 | Settings | Settings | Citizen | Watch | `/settings` | Y | Y | — | N/A | N/A | N/A | PARTIAL | N | N | N | N | N | **PARTIAL** | P2 | N | Vibration toggle bug | — | N | Hardcoded `true` |
| WCH-REL-001 | Reliability | Crash recovery | Citizen | Watch | Boot | Y | Y | — | N/A | N/A | N/A | Y | Y | Y | N | N | N | **PASS** | P1 | N | Boot sequencer recovery UI | — | N | — |
| WCH-REL-002 | Reliability | Reboot recovery | Citizen | Watch | Boot | Y | Y | Pairing restore | Y | Y | Y | Y | Y | Y | N | N | N | **PASS** | P1 | N | `pairing_state_test.dart` | — | N | — |
| WCH-HW-001 | Hardware | Physical-button integration | Citizen | Watch | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | Not evidenced | — | N | — |
| WCH-HW-002 | Hardware | Round screen | Citizen | Watch | All | Y | Y | — | N/A | N/A | N/A | Y | Y | N | N | N | N | **NOT TESTED** | P3 | N | No device matrix test | — | N | — |
| WCH-HW-003 | Hardware | Square screen | Citizen | Watch | All | Y | Y | — | N/A | N/A | N/A | Y | Y | N | N | N | N | **NOT TESTED** | P3 | N | — | — | N | — |
| WCH-TGT-001 | Target | Full Android watch | Citizen | Watch | — | Y | PARTIAL | — | N/A | N/A | N/A | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | Build exists; not fully verified | — | N | — |
| WCH-TGT-002 | Target | Wear OS target | Citizen | Watch | — | Y | PARTIAL | — | N/A | N/A | N/A | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | Flutter wear flavor | — | N | — |
| WCH-REP-001 | Reports | Report flow (prototype D) | Citizen | Watch | `/report/*` | Y | Y | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | UI shell; fakes sent | — | N | Remove or wire |

---

## ADMIN DASHBOARD

### Authentication

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-AUTH-001 | Auth | Admin login | Admin | Admin | `/login` | Y | Y | `POST /v1/auth/login?admin` | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | — | — | N | `admin-auth-validation-test.cjs` |
| ADM-AUTH-002 | Auth | Logout | Admin | Admin | Header | Y | Y | `POST /v1/auth/logout` | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P0 | N | — | — | N | — |
| ADM-AUTH-003 | Auth | Session timeout | Admin | Admin | Middleware | Y | Y | Cookie session | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Not fully verified | — | N | — |
| ADM-AUTH-004 | Auth | Password reset | Admin | Admin | `/login/forgot-password` | Y | Y | Same as citizen | Y | Y | Y | N | N | Y | N | N | N | **PARTIAL** | P0 | Y | `AUTH_PASSWORD_RESET_WEBHOOK_URL` must be set on staging | `auth-delivery.service.ts` | Y | Shares citizen delivery path |
| ADM-AUTH-005 | Auth | MFA | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT APPLICABLE** | P2 | N | Not implemented | — | Y | — |

### Dashboard

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-DASH-001 | Dashboard | Statistics | Admin | Admin | `/` | Y | Y | Multiple GET | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Live incidents/users/sessions | — | N | Smoke test |
| ADM-DASH-002 | Dashboard | Charts | Admin | Admin | `/` | Y | Y | Derived | PARTIAL | Y | Y | PARTIAL | Y | Y | N | Y | N | **PARTIAL** | P1 | Y | User trend not time-series | — | Y | Missing `GET /analytics/users` |
| ADM-DASH-003 | Dashboard | Filters | Admin | Admin | `/` | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-DASH-004 | Dashboard | Date ranges | Admin | Admin | `/` | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-DASH-005 | Dashboard | Jurisdiction scoping | Admin | Admin | `/` | N | N | — | N | Y | PARTIAL | N | N | N | N | N | N | **NOT IMPLEMENTED** | P1 | Y | No jurisdictions API | — | Y | — |
| ADM-DASH-006 | Dashboard | Live refresh | Admin | Admin | `/` | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | Static SSR fetch | — | N | — |

### Incidents

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-INC-001 | Incidents | Incident list | Admin | Admin | `/incidents` | Y | Y | `GET /v1/incidents` | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | — | — | N | — |
| ADM-INC-002 | Incidents | Incident details | Admin | Admin | `/incidents/[id]` | Y | Y | `GET /v1/incidents/:id` | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P0 | N | — | — | N | — |
| ADM-INC-003 | Incidents | Verification | Admin | Admin | `/verification` | Y | Y | verification module | Y | Y | Y | Y | Y | N | N | Y | N | **PARTIAL** | P0 | Y | Approve/reject buttons unwired | — | Y | Queue live |
| ADM-INC-004 | Incidents | Assign responder | Admin | Admin | Detail | Y | Y | `PATCH /v1/incidents/:id/assign` | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | UI exists; not verified | — | N | — |
| ADM-INC-005 | Incidents | Change status | Admin | Admin | Detail | Y | Y | `PATCH /v1/incidents/:id/status` | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P0 | N | Backend ready | — | N | — |
| ADM-INC-006 | Incidents | Escalate | Admin | Admin | — | Y | PARTIAL | `POST /v1/escalation/run` | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Manual run only | — | N | No cron |
| ADM-INC-007 | Incidents | Reject | Admin | Admin | Verification | Y | N | admin-review | Y | Y | Y | Y | Y | N | N | N | N | **FAIL** | P0 | Y | Button no handler | — | Y | — |
| ADM-INC-008 | Incidents | Evidence viewer | Admin | Admin | Detail | Y | Y | media view/download | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P0 | N | — | — | N | Access logged |
| ADM-INC-009 | Incidents | Live video | Admin | Admin | `/live-video` | Y | Y | admin-token | Y | Y | Y | Y | Y | Y | N | N | N | **BLOCKED** | P0 | Y | LiveKit env | — | Y | Player wired |
| ADM-INC-010 | Incidents | Location map | Admin | Admin | Detail / emergency | Y | Y | — | N | Y | Y | N | N | N | N | N | N | **FAIL** | P1 | Y | CSS dot placeholder map | — | N | Not real map |
| ADM-INC-011 | Incidents | Audit trail | Admin | Admin | Detail | Y | Y | audit filtered | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| ADM-INC-012 | Incidents | Verify/reject wired | Admin | Admin | `/verification` | Y | Y | admin-review BFF | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P0 | Y | Buttons wired Sprint 3 | `incident-review-button.tsx` | Y | Staging QA pending |
| ADM-INC-013 | Incidents | Assign/status wired | Admin | Admin | Detail | Y | Y | PATCH status/assign BFF | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P0 | N | Admin actions panel Sprint 3 | `incident-admin-actions.tsx` | Y | — |
| ADM-INC-014 | Incidents | Evidence signed view | Admin | Admin | Detail | Y | Y | media view BFF | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P0 | Y | Signed URL when S3 configured (INF-006) | `evidence-view-button.tsx` | Y | BLOCKED without S3 |
| ADM-INC-015 | Incidents | Real GPS map markers | Admin | Admin | List/detail map | Y | PARTIAL | GPS from API | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Uses real lat/lng positions; not full map library | `incident-widgets.tsx` | N | — |
| ADM-INC-016 | Incidents | Queue filters | Admin | Admin | `/incidents` | Y | Y | query params | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P2 | N | status/priority/type filters | `incident-filter.tsx` | N | Staging QA |

### Users

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-USR-001 | Users | User list | Admin | Admin | `/users` | Y | Y | `GET /v1/users/directory` | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | Read-only | — | N | — |
| ADM-USR-002 | Users | User details | Admin | Admin | `/users/[id]` | Y | Y | `GET /v1/users/:id` | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P1 | Y | Detail page coded; staging QA pending | `app/users/[id]/page.tsx` | Y | Jurisdiction scoped |
| ADM-USR-003 | Users | Suspend | Admin | Admin | — | N | N | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | No admin user action API | — | Y | — |
| ADM-USR-004 | Users | Reactivate | Admin | Admin | — | N | N | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | — | — | Y | — |
| ADM-USR-005 | Users | Delete | Admin | Admin | — | N | N | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P1 | Y | — | — | Y | — |
| ADM-USR-006 | Users | KYC review | Admin | Admin | `/users/kyc` | Y | Y | pending + review | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P1 | Y | Queue + approve/reject UI; staging QA pending | `app/users/kyc`, `kyc-review-button` | Y | — |
| ADM-USR-007 | Users | Trust score | Admin | Admin | `/users` | Y | Y | In directory | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P2 | N | Display only | — | N | — |
| ADM-USR-008 | Users | Export | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |

### Administrators

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-ADM-001 | Admins | Create admin | Super Admin | Admin | — | N | N | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | No CRUD API | — | Y | — |
| ADM-ADM-002 | Admins | Edit admin | Super Admin | Admin | — | N | N | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | — | — | Y | — |
| ADM-ADM-003 | Admins | Disable admin | Super Admin | Admin | — | N | N | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | — | — | Y | — |
| ADM-ADM-004 | Admins | Country scope | Super Admin | Admin | `/roles` | Y | Y | — | N | N | Y | N | N | N | N | N | N | **PARTIAL** | P1 | N | Static `role-matrix.ts` | — | N | Docs only |
| ADM-ADM-005 | Admins | State scope | Super Admin | Admin | `/roles` | Y | Y | — | N | N | Y | N | N | N | N | N | N | **PARTIAL** | P1 | N | Static matrix | — | N | — |
| ADM-ADM-006 | Admins | LGA scope | Super Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-ADM-007 | Admins | Role permissions | Super Admin | Admin | `/roles` | Y | Y | — | N | N | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Local config not DB | — | N | — |

### Neighborhood Watch (Admin)

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-NW-001 | CSOC | Communities | Admin | Admin | `/neighborhood-watch/communities` | Y | Y | NW module | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| ADM-NW-002 | CSOC | Members | Admin | Admin | `/residents`, `/approvals` | Y | Y | memberships | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | Approve wired | — | N | — |
| ADM-NW-003 | CSOC | Moderation | Admin | Admin | `/verification` | Y | Y | post verify | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| ADM-NW-004 | CSOC | Posts | Admin | Admin | `/posts` | Y | Y | GET posts | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| ADM-NW-005 | CSOC | Alerts | Admin | Admin | broadcasts | Y | Y | broadcasts | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| ADM-NW-006 | CSOC | Admin assignment | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-NW-007 | CSOC | Reports | Admin | Admin | `/reports` | Y | Y | — | N | Y | Y | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | `POST /reports/generate` missing | — | Y | Placeholder notice |

### Broadcasts

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-BRD-001 | Broadcasts | Create | Admin | Admin | `/broadcasts` | Y | Y | `POST /v1/broadcasts` | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Form wired | — | N | — |
| ADM-BRD-002 | Broadcasts | Preview | Admin | Admin | `/broadcasts` | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-BRD-003 | Broadcasts | Target by geography | Admin | Admin | Create form | Y | PARTIAL | In payload | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Backend supports; UI partial | — | N | — |
| ADM-BRD-004 | Broadcasts | Send / dispatch | Admin | Admin | `/broadcasts` | Y | Y | dispatch endpoints | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P0 | Y | Delivery depends on FCM/SMS/email | — | Y | — |
| ADM-BRD-005 | Broadcasts | Schedule | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-BRD-006 | Broadcasts | Cancel | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-BRD-007 | Broadcasts | Delivery results | Admin | Admin | — | Y | PARTIAL | delivery logs | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | — | — | N | — |
| ADM-BRD-008 | Broadcasts | Push channel | Admin | Admin | Notifications | Y | Y | send + FCM | Y | Y | Y | PARTIAL | N | N | N | N | N | **BLOCKED** | P0 | Y | FCM simulated without creds | — | Y | — |
| ADM-BRD-009 | Broadcasts | SMS / Email channels | Admin | Admin | Notifications | Y | Y | providers | PARTIAL | Y | Y | N | N | N | N | N | N | **FAIL** | P0 | Y | Placeholder providers default off | — | Y | — |

### Missing persons / Stolen vehicles (Admin)

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-MP-001 | Missing | List / view | Admin | Admin | `/missing-persons` | Y | Y | `GET /v1/incidents` | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | Filter by type | — | N | — |
| ADM-MP-002 | Missing | Create (admin) | Admin | Admin | — | N | N | report API | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | Citizens create; no admin form | — | N | — |
| ADM-MP-003 | Missing | Verify / publish / update / close | Admin | Admin | — | Y | PARTIAL | verification + status | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Via incident workflows | — | N | — |
| ADM-MP-004 | Missing | Sightings | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-SV-001 | Stolen | List / view | Admin | Admin | `/stolen-vehicles` | Y | Y | incidents | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| ADM-SV-002 | Stolen | Sightings | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |

### Audit & Settings

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-AUD-001 | Audit | Audit list | Admin | Admin | `/audit` | Y | Y | `GET /v1/audit` | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| ADM-AUD-002 | Audit | Pagination | Admin | Admin | `/audit` | Y | Y | query params | Y | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | — | — | N | — |
| ADM-AUD-003 | Audit | BigInt serialization | Admin | Admin | API | N/A | N/A | interceptor | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | `json-safe.ts` added staging | — | N | — |
| ADM-AUD-004 | Audit | Filters | Admin | Admin | `/audit` | Y | Y | search params | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P2 | N | — | — | N | — |
| ADM-AUD-005 | Audit | Export | Admin | Admin | — | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | — | — | Y | — |
| ADM-AUD-006 | Audit | Actor details | Admin | Admin | `/audit` | Y | Y | in log rows | Y | Y | Y | Y | Y | N | N | Y | N | **PASS** | P2 | N | — | — | N | — |
| ADM-AUD-007 | Audit | Immutable log chain | Admin | Admin | `/audit` | Y | Y | verify-chain | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | — | — | N | — |
| ADM-SET-001 | Settings | System settings | Admin | Admin | `/settings` | Y | PARTIAL | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | Labels only | — | N | — |
| ADM-SET-002 | Settings | Notification providers status | Admin | Admin | `/settings` | N | N | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P1 | Y | — | — | Y | — |
| ADM-SET-003 | Settings | Firebase / Redis / LiveKit / Storage status | Admin | Admin | — | N | N | health/ready | PARTIAL | N/A | Y | PARTIAL | Y | N | N | Y | N | **PARTIAL** | P1 | N | Via API health not admin UI | — | N | — |

### Admin placeholder modules

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| ADM-PL-001 | Placeholder | Jurisdictions | Admin | Admin | `/jurisdictions` | Y | Y | — | N | Y | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | `PlaceholderNotice` | — | Y | Documented in `placeholder-dependencies.ts` |
| ADM-PL-002 | Placeholder | Job vacancies | Admin | Admin | `/job-vacancies` | Y | Y | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P3 | N | — | — | Y | — |
| ADM-PL-003 | Placeholder | Live chats | Admin | Admin | `/live-chats` | Y | Y | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P3 | N | — | — | Y | — |
| ADM-PL-004 | Placeholder | Sailing permits | Admin | Admin | `/sailing-permit` | Y | Y | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P3 | N | — | — | Y | — |
| ADM-SW-001 | Smartwatch | Admin device CRUD buttons | Admin | Admin | `/smartwatch` | Y | N | PATCH endpoints exist | Y | Y | Y | Y | Y | N | N | N | N | **FAIL** | P1 | Y | Add/rename/disable UI-only | — | Y | — |
| ADM-POL-001 | Police | Station create/search forms | Admin | Admin | `/police-stations` | Y | N | POST/PATCH exist | Y | Y | Y | Y | Y | N | N | N | N | **FAIL** | P1 | Y | Forms not wired | — | Y | List works |

---

## BACKEND / API

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| API-CORE-001 | API | Route existence (106 `/v1` routes) | System | Backend | Controllers | N/A | N/A | All modules | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | 15 controller modules | — | N | Audit 2026-07-21 |
| API-CORE-002 | API | DTO validation | System | Backend | Global pipes | N/A | N/A | All POST/PATCH | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | class-validator | — | N | — |
| API-CORE-003 | API | Authentication (JWT) | System | Backend | Guards | N/A | N/A | auth module | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | — | — | N | — |
| API-CORE-004 | API | Authorization (RBAC) | System | Backend | Guards | N/A | N/A | admin routes | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Shared role matrix | — | N | — |
| API-CORE-005 | API | Jurisdiction guards | System | Backend | Services | N/A | N/A | incidents | PARTIAL | Y | PARTIAL | Y | Y | N | N | Y | N | **PARTIAL** | P1 | N | Fallback NG/Lagos/Ikeja | — | N | — |
| API-CORE-006 | API | Rate limiting | System | Backend | Middleware | N/A | N/A | global | Y | N/A | Y | Y | Y | N | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| API-CORE-007 | API | Pagination | System | Backend | List endpoints | N/A | N/A | various | PARTIAL | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | Not uniform | — | N | — |
| API-CORE-008 | API | Error responses | System | Backend | Filters | N/A | N/A | global | Y | N/A | Y | Y | Y | Y | N | Y | N | **PASS** | P1 | N | — | — | N | — |
| API-CORE-009 | API | Audit logging | System | Backend | All modules | N/A | N/A | audit service | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Hash chain | — | N | — |
| API-CORE-010 | API | Prisma persistence | System | Backend | Services | N/A | N/A | all | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | No mock repos | — | N | — |
| API-CORE-011 | API | Redis / BullMQ jobs | System | Backend | notifications | N/A | N/A | queue | PARTIAL | N/A | Y | N | N | Y | N | N | N | **CODE COMPLETE — STAGING INFRASTRUCTURE QA PENDING** | P0 | Y | Worker entrypoint + fail-closed enqueue coded; VPS QA pending | `worker.ts`, `queue-config.ts` | Y | Dev may still set `THE_EYE_DISABLE_REDIS=1` |
| API-CORE-012 | API | FCM delivery | System | Backend | fcm.provider | N/A | N/A | notifications | PARTIAL | Y | Y | N | N | Y | N | N | N | **BLOCKED** | P0 | Y | Simulated without creds | — | Y | — |
| API-CORE-013 | API | SMS delivery | System | Backend | sms.provider | N/A | N/A | auth/notifications | N | N/A | Y | N | N | Y | N | N | N | **FAIL** | P0 | Y | Default disabled placeholder | — | Y | — |
| API-CORE-014 | API | Email delivery | System | Backend | email.provider | N/A | N/A | auth/notifications | N | N/A | Y | N | N | Y | N | N | N | **FAIL** | P0 | Y | Default disabled placeholder | — | Y | — |
| API-CORE-015 | API | LiveKit tokens | System | Backend | live-video | N/A | N/A | sessions | Y | Y | Y | PARTIAL | N | Y | N | N | N | **BLOCKED** | P0 | Y | Dev key defaults if unset | — | Y | — |
| API-CORE-016 | API | Signed uploads (S3) | System | Backend | storage/incidents | N/A | N/A | presign | Y | N/A | Y | Y | Y | Y | N | N | N | **BLOCKED** | P0 | Y | Requires S3 env | — | Y | — |
| API-CORE-017 | API | Signed downloads | System | Backend | incidents media | N/A | N/A | view/download | Y | Y | Y | Y | Y | N | N | N | N | **PASS** | P0 | N | Access logged | — | N | — |
| API-CORE-018 | API | Health live | System | Backend | `/health` | N/A | N/A | GET | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Staging curl verified | — | N | — |
| API-CORE-019 | API | Health ready | System | Backend | `/health/ready` | N/A | N/A | GET | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Firebase block in response | — | N | — |
| API-CORE-020 | API | Metrics | System | Backend | `/metrics` | N/A | N/A | GET | Y | N/A | Y | Y | Y | Y | N | N | N | **PASS** | P2 | N | — | — | N | — |
| API-CORE-021 | API | Graceful shutdown | System | Backend | main.ts | N/A | N/A | — | PARTIAL | N/A | N/A | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | Not verified | — | N | — |
| API-CORE-022 | API | Admin bootstrap | System | Backend | seed/migration | N/A | N/A | — | PARTIAL | Y | Y | Y | Y | N | N | N | N | **PARTIAL** | P1 | N | Manual process | — | Y | — |
| API-CORE-023 | API | Database migrations | System | Backend | prisma | N/A | N/A | — | Y | Y | N/A | Y | Y | Y | N | Y | N | **PASS** | P0 | N | — | — | N | — |
| API-CORE-024 | API | Seed idempotency | System | Backend | seeds | N/A | N/A | — | PARTIAL | Y | N/A | Y | Y | N | N | N | N | **PARTIAL** | P2 | N | Community roles only | — | N | — |

### Profile (Sprint 2)

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| API-PROF-001 | Profile | GET citizen profile | Citizen | Backend | `GET /v1/users/me` | N/A | N/A | `GET /v1/users/me` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Returns `profileComplete`, geo, contacts[], KYC reason; no secrets | `users.service.ts` | Y | Staging runtime pending |
| API-PROF-002 | Profile | PATCH citizen profile | Citizen | Backend | `PATCH /v1/users/me` | N/A | N/A | `PATCH /v1/users/me` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Allowlisted fields; forbidNonWhitelisted; audit | `dto/users.dto.ts` | Y | — |
| API-PROF-003 | Profile | Avatar presign + confirm | Citizen | Backend | avatar routes | N/A | N/A | presign/confirm | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | Y | Image MIME allowlist; ownership; INF-006 S3 staging | `s3-presign.ts` | Y | — |
| API-PROF-004 | Profile | Emergency contacts CRUD | Citizen | Backend | `/users/me/emergency-contacts` | N/A | N/A | CRUD | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Max contacts; phone validate; audit; owner-only | `users.service.ts` | Y | — |
| API-PROF-005 | Profile | KYC citizen submit | Citizen | Backend | `POST /users/me/kyc` | N/A | N/A | submit | Y | Y | Y | Y | Y | Y | N | N | N | **PARTIAL** | P1 | Y | Status workflow foundation; documentary requirements may BLOCK | — | Y | No mobile client approval |
| API-PROF-006 | Profile | KYC admin review | Admin | Backend | pending + review | N/A | N/A | list/review | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | Y | Jurisdiction scoped; audit decisions | `users.controller.ts` | Y | — |
| API-PROF-007 | Profile | profileComplete rules | System | Backend | auth + users | N/A | N/A | shared helper | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Shared `profile-complete.ts`; on GET/PATCH/auth | `profile-complete.ts` | Y | No silent NG default |
| API-PROF-008 | Profile | Server-synced preferences | Citizen | Backend | — | N/A | N/A | — | N | N | N | N | N | N | N | N | N | **NOT IMPLEMENTED** | P2 | N | No preferences model/API | — | Y | Avoid JSON blob |
| API-PROF-009 | Profile | Account deletion request | Citizen | Backend | `POST /users/me/deletion-request` | N/A | N/A | deletion | Y | PARTIAL | Y | Y | Y | Y | N | N | N | **PARTIAL** | P2 | Y | Deactivate + revoke; full erasure BLOCKED | — | Y | Retention policy pending |
| API-PROF-010 | Profile | Profile write audit | System | Backend | profile writes | N/A | N/A | AuditService | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P1 | N | Actor audit on profile/contacts/avatar/KYC/deletion | `users.service.ts` | Y | — |

### Incidents API (Sprint 3)

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| API-INC-001 | Incidents | Report idempotency | System | Backend | `POST /incidents/report` | N/A | N/A | `x-client-submission-id` | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | Unique `clientSubmissionId`; duplicate response | `incidents.service.ts` | Y | Migration required |
| API-INC-002 | Incidents | Live location endpoint | System | Backend | `POST /incidents/:id/location` | N/A | N/A | location route | Y | Y | Y | Y | Y | Y | N | N | N | **NOT TESTED** | P0 | Y | `IncidentLocationUpdate` model + sequence dedupe | `incidents.service.ts` | Y | — |
| API-INC-003 | Incidents | Emergency contact enqueue | System | Backend | report notify | N/A | N/A | NotificationsService | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P0 | Y | SMS via BullMQ enqueue; Redis/FCM may BLOCK | `incidents.service.ts` | Y | — |
| API-INC-004 | Incidents | Assign lifecycle FSM | System | Backend | PATCH assign | N/A | N/A | assign | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P0 | N | Validates transition to Assigned | `incidents.service.ts` | N | — |
| API-INC-005 | Incidents | Evidence signed GET | System | Backend | media view | N/A | N/A | view/download | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P0 | Y | Short-lived signed URL in response | `s3-presign.ts` | Y | INF-006 |
| API-INC-006 | Incidents | Status history actor notes | System | Backend | PATCH status | N/A | N/A | statusHistory | Y | Y | Y | Y | Y | N | N | N | N | **NOT TESTED** | P1 | N | App writes note + resolved/closed timestamps | `incidents.service.ts` | Y | — |

---

## SPRINT 2 — Citizen Profile

**Baseline:** `staging` @ `74565ff`  
**Implementation branch:** `feature/sprint-2-citizen-profile`  
**Sprint 2 verdict:** **CODE COMPLETE — PENDING STAGING QA**

### Sprint 2 gap table (post-implementation)

| ID | Feature | Platform | Current status | UI status | Endpoint status | Database status | Authorization status | Mock/demo status | Tests | Severity | Required change |
|----|---------|----------|----------------|-----------|-----------------|-----------------|----------------------|------------------|-------|----------|-----------------|
| S2-001 | View real profile | Mobile + API | NOT TESTED | Full profile view | GET complete | Existing models | Owner JWT | Real API only | Unit + service | P1 | Staging device QA |
| S2-002 | Edit profile | Mobile + API | NOT TESTED | Edit screen | PATCH allowlist | Existing | Owner + validation | No demo | Service + mobile API | P0 | Staging device QA |
| S2-003 | Profile completion | Mobile + API | NOT TESTED | Completion form + routing | Server `profileComplete` | Existing | Auth | No silent geo | Service + auth | P0 | Staging device QA |
| S2-004 | Avatar upload | Mobile + API + Storage | NOT TESTED | Picker + upload | Presign/confirm | `avatarUrl` | Owner | No base64 | Service | P1 | S3 staging (INF-006) + device QA |
| S2-005 | Emergency contacts | Mobile + API | NOT TESTED | CRUD UI | Full CRUD | Model used | Owner | Real | Service + mobile | P0 | Staging device QA |
| S2-006 | KYC workflow | Mobile + API + Admin | PARTIAL/NOT TESTED | Citizen + admin UI | Submit + review | KycRecord | RBAC + jurisdiction | No fake approve | Service | P1 | Legal docs may BLOCK; staging QA |
| S2-007 | Trust score | Mobile + API | PARTIAL | Display only | Read-only | TrustedReporter | Server-controlled | No hardcoded 82 | Display | P2 | Automated calc BLOCKED |
| S2-008 | Citizen settings | Mobile | PARTIAL | Local prefs | No sync API | N/A | N/A | Local real | Theme tests | P2 | Typed sync API deferred |
| S2-009 | Account deletion | Mobile + API | PARTIAL | Settings entry | Deactivate | Status + revoke | Owner confirm | Honest retention copy | Service + mobile | P2 | Full erasure BLOCKED |
| S2-010 | Admin user detail | Admin | NOT TESTED | `/users/[id]` | GET detail | Includes contacts/KYC | user:manage + scope | Real | Manual | P1 | Staging QA |
| S2-011 | Admin KYC review | Admin + API | NOT TESTED | `/users/kyc` | Pending + review | KycRecord | user:manage + scope | Real | Manual | P1 | Staging QA |
| S2-012 | Session + navigation | Mobile | NOT TESTED | Login/OTP/splash routes | Session + profile | N/A | Guest gated | Cache cleared on logout | Auth restore tests | P0 | Staging device QA |
| S2-013 | Profile security | All | NOT TESTED | N/A | forbidNonWhitelisted | Audit events | Ownership + RBAC | No secrets in GET | Service specs | P0 | Staging + security regression |

### Sprint 2 evidence tracker

| Track | ID | Target status | Staging device QA | Notes |
|-------|-----|---------------|-------------------|-------|
| Profile read | MOB-PROF-001, API-PROF-001 | NOT TESTED | Required | Code complete |
| Profile edit | MOB-PROF-002, API-PROF-002 | NOT TESTED | Required | Code complete |
| Profile completion | MOB-PROF-009, MOB-PROF-010, API-PROF-007 | NOT TESTED | Required | Login/OTP routing fixed |
| Avatar | MOB-PROF-003, API-PROF-003 | NOT TESTED | Required | Needs S3 env |
| Emergency contacts | MOB-PROF-004, API-PROF-004 | NOT TESTED | Required | Code complete |
| KYC | MOB-PROF-005, API-PROF-005/006, ADM-USR-006 | PARTIAL / NOT TESTED | Required | Docs may BLOCK |
| Trust score | MOB-PROF-006 | PARTIAL | Required | Read-only |
| Settings | MOB-PROF-007, MOB-PROF-011, API-PROF-008 | PARTIAL / NOT IMPL | Optional | Sync API deferred |
| Deletion | MOB-PROF-008, API-PROF-009 | PARTIAL | Required | Erasure BLOCKED |

---

## SPRINT 3 — Incident Reporting

**Baseline:** `staging` @ `45c2197`  
**Implementation branch:** `feature/sprint-3-incident-reporting`  
**Contract:** `docs/INCIDENT_CONTRACT.md`  
**Sprint 3 verdict:** **CODE COMPLETE — PENDING STAGING QA**

### Sprint 3 gap table (Phase 1 audit @ 2026-07-22)

| ID | Feature | Platform | Current status | UI | Navigation | Endpoint | Backend | Database | Storage | Notification | Admin | Watch | Tests | Severity | Required change |
|----|---------|----------|----------------|:--:|:----------:|:--------:|:-------:|:--------:|:-------:|:------------:|:-----:|:-----:|:-----:|:--------:|-----------------|
| S3-001 | Create incident | Mobile + API | NOT TESTED | Report flows exist | 7 routes | POST report | Y | Y | Presign path | Partial enqueue | Read-only | SOS Y | Mobile service tests | P0 | Staging device QA |
| S3-002 | Idempotency | API + Mobile | NOT TESTED | N/A | Header sent | Dedupe key | Y | Y | N/A | N/A | N/A | Y | New specs | P0 | Staging QA |
| S3-003 | Draft save | Mobile | NOT TESTED | Compose store + resume | Tracking drafts | Local | N/A | N/A | Local refs | N/A | N/A | N/A | compose_draft_store_test | P1 | Staging QA |
| S3-004 | Offline queue | Mobile | PASS | Banner/tracking | Y | POST report | Y | Y | Retry | N/A | N/A | SOS queue | pending store tests | P0 | Staging QA |
| S3-005 | Photo/video/audio evidence | Mobile + API | PASS/BLOCKED | Capture UI | Y | presign/confirm | Y | Y | INF-006 | N/A | Signed view NOT TESTED | N/A | evidence tests | P0 | S3 staging + device QA |
| S3-006 | GPS + timestamps | Mobile + API | PASS | Capture | Y | In payload | Y | Y | N/A | N/A | Map partial | GPS Y | DTO tests | P0 | Device QA |
| S3-007 | Live location | API + Mobile | NOT TESTED | Tracker wired | Y | POST location | Y | Y | N/A | N/A | N/A | GPS trail | payload + tracker tests | P1 | Staging device QA |
| S3-008 | Incident history | Mobile | NOT TESTED | Tracking | Y | GET list | Y | Y | N/A | N/A | Y | N/A | history service test | P0 | Staging QA after deploy |
| S3-009 | Incident details | Mobile | NOT TESTED | Detail screen | Y | GET detail | Y | Y | N/A | N/A | Y | N/A | history service test | P0 | Staging QA |
| S3-010 | Status tracking | All | NOT TESTED | Tiles | Refresh wired | PATCH status | Y | Y | N/A | BLOCKED | Wired NOT TESTED | Server poll | lifecycle partial | P0 | FCM staging + device QA |
| S3-011 | Verification workflow | Admin + API | NOT TESTED | Witness panel wired | Y | confirmations/crowd | Y | Y | N/A | BLOCKED enqueue | Y | N/A | verification specs | P0 | Staging QA |
| S3-012 | Admin operations | Admin | NOT TESTED | Detail actions + filters | Y | assign/status BFF | Y | Y | Signed view | N/A | Y | N/A | Manual | P0 | Staging QA |
| S3-013 | Notifications | API | BLOCKED | N/A | N/A | BullMQ | Code complete | Y | N/A | Redis/FCM | N/A | N/A | processor tests | P0 | INF-005/FCM on VPS |
| S3-014 | LiveKit | All | BLOCKED | UI wired | Y | tokens | Y | Y | N/A | N/A | Player | N/A | live-video tests | P0 | INF-003 |
| S3-015 | Watch SOS linkage | Watch + API | NOT TESTED | SOS hold + poll | Y | smartwatch/sos + tracking | Y | Y | N/A | Enqueue | Admin list | Y | sos_service_test | P0 | Staging device QA |

### Sprint 3 evidence tracker

| Track | IDs | Target status | Staging device QA | Notes |
|-------|-----|---------------|-------------------|-------|
| Report + idempotency | MOB-INCD-012, API-INC-001 | NOT TESTED | Required | Migration + redeploy |
| History + detail | MOB-EMRG-010, MOB-INCD-013/017/018 | NOT TESTED | Required | API wired Sprint 3 |
| Evidence pipeline | MOB-INCD-004–006, API-INC-005, ADM-INC-014 | NOT TESTED / BLOCKED | Required | Needs INF-006 |
| Admin verify/assign | ADM-INC-003/007/012/013 | NOT TESTED | Required | BFF wired |
| Notifications | API-CORE-011/012, S3-013 | BLOCKED | Required | Redis + FCM on VPS |
| Live video | MOB-INCD-007, ADM-INC-009, S3-014 | BLOCKED | Required | LiveKit staging |
| Watch SOS | WCH-SOS-001, WCH-INC-001/002 | NOT TESTED | Required | Idempotency + server poll wired |

---

## SPRINT 4 — Notifications and Broadcasts

**Baseline:** `staging` @ `ca227fc` (Staging RC1)  
**Implementation branch:** `feature/sprint-4-notifications-broadcasts`  
**Sprint 4 verdict:** **IN PROGRESS — PHASES 3, 4, 8, BROADCAST LIFECYCLE, DELIVERY MONITORING CODE COMPLETE — STAGING QA PENDING**

> Terminology rule: **Delivered** applies only to reliable provider delivery confirmation or approved **DeviceReceived** acknowledgement — never to queue insertion, FCM HTTP 200 alone, simulation, or webhook HTTP 200 without receipt proof.

### Sprint 4 gap table (Phase 1 audit @ 2026-07-22)

| ID | Feature | Platform | Current status | UI | Endpoint | Database | Queue | Provider | Device receipt | Audit | Tests | Severity | Blocker | Required change |
|----|---------|----------|----------------|:--:|:--------:|:--------:|:-----:|:--------:|:--------------:|:-----:|:-----:|:--------:|:-------:|-----------------|
| S4-001 | Redis mandatory | Infra | CODE COMPLETE — STAGING INFRASTRUCTURE QA PENDING | N/A | health/ready partial | N/A | PARTIAL | N/A | N/A | N/A | Y | P0 | Y | Enable Redis on VPS; verify fail-closed enqueue + queue/worker diagnostics in staging |
| S4-002 | BullMQ worker pipeline | API | CODE COMPLETE — STAGING INFRASTRUCTURE QA PENDING | N/A | enqueue + worker | Y | Y | N/A | N/A | N | Y | P0 | Y | Deploy worker container; verify idempotency, retries, heartbeat, graceful shutdown on VPS |
| S4-003 | Notification status taxonomy | API + shared | CODE COMPLETE — STAGING QA PENDING | N/A | responses + delivery logs | Y | Y | Y | Y | N | Y | P1 | N | ProviderAccepted vs Delivered mapping enforced; DeviceReceived ack path live |
| S4-004 | FCM real delivery | API | CODE COMPLETE — STAGING FCM QA PENDING | N/A | fcm.provider | Y | Y | Y | Y | N | Y | P0 | Y | Fail-closed simulation; watch_push channel fix; deep links; env isolation; invalid-token cleanup |
| S4-005 | SMS provider | API | CODE COMPLETE — PROVIDER INTEGRATION PENDING | N/A | sms.provider | Y | Y | FAIL-CLOSED | N | N | Y | P0 | Y | Disabled provider throws (no fake Sent); real SMS adapter still required |
| S4-006 | Email provider | API | CODE COMPLETE — PROVIDER INTEGRATION PENDING | N/A | email.provider | Y | Y | FAIL-CLOSED | N | N | Y | P0 | Y | Disabled provider throws (no fake Sent); real email adapter still required |
| S4-007 | Mobile FCM token lifecycle | Mobile | CODE COMPLETE — DEVICE QA PENDING | Background | push-tokens | Y | N/A | FCM | Y | N | Y | P0 | Y | Stable deviceId; appEnvironment; refresh; logout deactivate-all; foreground/open/background ack |
| S4-008 | Watch FCM token lifecycle | Watch | CODE COMPLETE — DEVICE QA PENDING | Background | push-tokens | Y | N/A | FCM | Y | N | Y | P0 | Y | appEnvironment register; unpair deactivate-all; server device-received ack |
| S4-009 | Mobile notification inbox | Mobile | CODE COMPLETE — DEVICE QA PENDING | `/notifications` | GET/PATCH notifications | Y | N/A | N/A | N | N | Y | P1 | Y | Device QA on staging APK; verify pagination, read/unread, offline cache, FCM refresh |
| S4-010 | Mobile broadcast feed | Mobile | CODE COMPLETE — DEVICE QA PENDING | `/broadcasts` | GET broadcasts/nearby | Y | N/A | N/A | N | N | N | P1 | Y | Live API feed + cache + detail; guest login required; staging device QA pending |
| S4-011 | Notification preferences | Mobile + API | NOT IMPLEMENTED | `/settings` | preferences API | N | N/A | N/A | N | N | N | P1 | Y | Server-backed typed prefs; mobile settings UI; audit on change |
| S4-012 | Mobile deep links | Mobile | PASS | Router | payload routes | N/A | N/A | N/A | Y | N | Y | P1 | N | Extend tests for broadcast/incident routes; sync inbox on open |
| S4-013 | Watch alert categories | Watch | CODE COMPLETE — DEVICE QA PENDING | Alert screens | push router | Y | N/A | FCM | Y | N | Y | P1 | N | Server ack on incoming push; notificationId propagation; device QA on staging watch APK |
| S4-014 | Broadcast create | Admin | PARTIAL | `/broadcasts` | POST broadcasts | Y | Y | push only | N | Y | N | P0 | N | Draft save supported; jurisdiction/WKT targeting UI still thin |
| S4-015 | Broadcast approve/dispatch | Admin | CODE COMPLETE — STAGING QA PENDING | Queue table | PATCH approve, POST dispatch | Y | Y | push | N | Y | N | P0 | Y | BFF action routes + queue table controls wired |
| S4-016 | Broadcast schedule/cancel | Admin + API | CODE COMPLETE — STAGING WORKER QA PENDING | Queue actions | schedule/cancel/progress + worker scheduler | Y | N | N/A | N | Y | N | P2 | N | UTC scheduledAt + BullMQ auto-dispatch worker; staging worker QA pending |
| S4-017 | Broadcast multi-channel | Admin + API | FAIL | compose | dispatch | Y | Y | push only | N | Y | N | P0 | Y | SMS/email channel selection + batched dispatch |
| S4-018 | Delivery monitoring | Admin | CODE COMPLETE — STAGING QA PENDING | `/notifications` | admin/delivery-operations | Y | Y | Y | N | N | N | P1 | Y | Live queue/worker/FCM metrics on notifications + broadcasts pages |
| S4-019 | Citizen broadcast nearby | API + Mobile | CODE COMPLETE — DEVICE QA PENDING | feed | GET nearby/detail/read | Y | Y | push | N | N | N | P1 | Y | Jurisdiction + geofence scoped feed; pagination/read/unread; mobile wired |
| S4-020 | Invalid token cleanup | API | CODE COMPLETE — STAGING QA PENDING | N/A | push-tokens deactivate | Y | Y | FCM | N | N | Y | P1 | N | FCM invalid-token deactivate; client logout/unpair deactivate-all paths |
| S4-021 | Retry / dead-letter | API | PARTIAL | N/A | processor | Y | Y | all | N | N | Y | P1 | N | Bounded backoff; poison job handling; admin visibility |
| S4-022 | Rate limiting / abuse | API | PARTIAL | N/A | send + tokens | Y | Y | all | N | N | N | P1 | Y | Rate limit notification send + token register; broadcast approval guards |
| S4-023 | Notification audit trail | API | PARTIAL | N/A | send | Y | Y | all | N | PARTIAL | N | P1 | N | Audit notification send + preference changes (broadcasts already audited) |
| S4-024 | Worker Docker service | Infra | CODE COMPLETE — STAGING DEPLOY PENDING | N/A | compose | N/A | Y | N/A | N/A | N | Y | P0 | Y | Deploy `notification-worker` service on VPS; verify heartbeat healthcheck and rollback |
| S4-025 | Auth delivery webhooks | API | PARTIAL | N/A | auth-delivery | N/A | N/A | webhook | N | Y | Y | P0 | Y | Configure OTP/password-reset webhooks on staging (Sprint 1 dependency) |

### Sprint 4 evidence tracker

| Track | IDs | Target status | Staging runtime QA | Notes |
|-------|-----|---------------|-------------------|-------|
| Queue + worker | S4-001, S4-002, S4-024, API-CORE-011 | BLOCKED/PARTIAL | Required | 2026-07-22: staging still on pre-Sprint-4 deploy; GH deploy blocked on missing `NEXT_PUBLIC_API_BASE_URL`; worker/scheduler heartbeats not observable |
| FCM pipeline | S4-004, S4-007, S4-008, MOB-NOTF-001–004, WCH-PUSH-001 | CODE COMPLETE — STAGING FCM QA PENDING | Required | Staging Firebase creds + device push QA |
| SMS / email | S4-005, S4-006, API-CORE-013/014 | FAIL-CLOSED — PROVIDER INTEGRATION PENDING | Required | Real provider credentials + adapters |
| Mobile inbox + feed | S4-009, S4-010, MOB-NOTF-006/007, MOB-SAFE-007 | PARTIAL | Required | Inbox live; broadcast feed code complete — device QA pending |
| Preferences | S4-011, MOB-NOTF-008 | NOT IMPLEMENTED | Required | Server + mobile UI |
| Admin broadcast lifecycle | S4-014–S4-018, ADM-BRD-001–009 | CODE COMPLETE — STAGING QA PENDING | Required | Approve/dispatch/schedule/monitor wired |
| Watch alerts | S4-013, WCH-PUSH-001 | CODE COMPLETE — DEVICE QA PENDING | Required | Staging watch push + ack QA |

### Sprint 4 checklist row map (existing IDs — statuses unchanged)

| Sprint 4 track | Existing checklist IDs |
|----------------|------------------------|
| Mobile push | MOB-NOTF-001–008 |
| Mobile broadcast feed | MOB-SAFE-007 |
| Watch push | WCH-PUSH-001 |
| Admin broadcasts | ADM-BRD-001–009 |
| API delivery core | API-CORE-011–014 |
| Infrastructure | INF-005, INF-011 |

---

## INFRASTRUCTURE

| ID | Module | Feature | User Role | Platform | Screen/Page | UI Present | Navigation Works | API Endpoint | Backend Implemented | Database Implemented | Authorization Implemented | Uses Real Data | Mock/Demo Removed | Automated Test | Manual Device Test | Staging Verified | Production Config Ready | Status | Severity | Blocker | Root Cause | Files Changed | Deployment Required | Notes |
|----|--------|---------|-----------|----------|-------------|:----------:|:----------------:|--------------|:-------------------:|:--------------------:|:-------------------------:|:--------------:|:-----------------:|:--------------:|:------------------:|:----------------:|:-----------------------:|--------|----------|:-------:|------------|---------------|:-------------------:|-------|
| INF-001 | Infra | Staging API | Ops | Infra | staging-api.theeye.com.ng | N/A | N/A | `/v1/health/ready` | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Documented in STAGING_DEPLOYMENT.md | — | N | — |
| INF-002 | Infra | Staging admin | Ops | Infra | staging-dashboard8jps | N/A | N/A | — | Y | N/A | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | validate-staging workflow | — | N | — |
| INF-003 | Infra | Staging LiveKit | Ops | Infra | staging-livekit | N/A | N/A | WSS | PARTIAL | N/A | Y | PARTIAL | Y | N | N | PARTIAL | N | **BLOCKED** | P0 | Y | Env-dependent | — | Y | — |
| INF-004 | Infra | PostgreSQL | Ops | Infra | Docker | N/A | N/A | — | Y | Y | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Prisma | — | N | — |
| INF-005 | Infra | Redis | Ops | Infra | Docker | N/A | N/A | — | PARTIAL | N/A | Y | Y | Y | Y | N | PARTIAL | N | **BLOCKED** | P0 | Y | Optional; off in some envs | — | Y | Required for notification queue |
| INF-006 | Infra | MinIO/Spaces (S3) | Ops | Infra | Docker/env | N/A | N/A | presign | Y | N/A | Y | Y | Y | N | N | PARTIAL | N | **BLOCKED** | P0 | Y | S3_* must be set | — | Y | — |
| INF-007 | Infra | Nginx | Ops | Infra | docker/nginx | N/A | N/A | — | Y | N/A | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Per-host routing | — | N | — |
| INF-008 | Infra | TLS | Ops | Infra | certbot | N/A | N/A | — | Y | N/A | Y | Y | Y | N | N | Y | N | **PASS** | P0 | N | STAGING_SUBDOMAIN_DEPLOYMENT.md | — | N | — |
| INF-009 | Infra | Certbot renewal | Ops | Infra | cron on VPS | N/A | N/A | — | PARTIAL | N/A | N/A | Y | Y | N | N | PARTIAL | N | **PARTIAL** | P1 | N | Ops procedure documented | — | Y | — |
| INF-010 | Infra | Docker runtime dependencies | Ops | Infra | compose | N/A | N/A | — | Y | N/A | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | test:docker:smoke | — | N | — |
| INF-011 | Infra | Firebase project isolation | Ops | Infra | per flavor | N/A | N/A | — | Y | N/A | Y | Y | Y | Y | N | Y | N | **PASS** | P0 | N | Guards in CI + mobile | — | N | — |
| INF-012 | Infra | GitHub Actions | Ops | Infra | workflows | N/A | N/A | — | Y | N/A | Y | Y | Y | Y | N | Y | N | **PASS** | P1 | N | validate-staging.yml | — | N | — |
| INF-013 | Infra | Backups | Ops | Infra | — | N/A | N/A | — | NOT IMPLEMENTED | N/A | N/A | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | No automated backup evidenced | — | Y | — |
| INF-014 | Infra | Restore test | Ops | Infra | — | N/A | N/A | — | NOT IMPLEMENTED | N/A | N/A | N | N | N | N | N | N | **NOT IMPLEMENTED** | P0 | Y | — | — | Y | — |
| INF-015 | Infra | Logs | Ops | Infra | Docker | N/A | N/A | — | PARTIAL | N/A | N/A | Y | Y | N | N | PARTIAL | N | **PARTIAL** | P1 | N | Container logs only | — | Y | — |
| INF-016 | Infra | Monitoring | Ops | Infra | metrics | N/A | N/A | `/metrics` | PARTIAL | N/A | Y | Y | Y | Y | N | N | N | **PARTIAL** | P1 | N | Prometheus endpoint exists | — | Y | — |
| INF-017 | Infra | Alerts | Ops | Infra | — | N/A | N/A | — | NOT IMPLEMENTED | N/A | N/A | N | N | N | N | N | N | **NOT IMPLEMENTED** | P1 | Y | — | — | Y | — |
| INF-018 | Infra | Rollback | Ops | Infra | deploy.yml | N/A | N/A | — | PARTIAL | N/A | N/A | Y | Y | N | N | PARTIAL | N | **PARTIAL** | P1 | N | Manual workflow_dispatch | — | Y | — |

---

## P0 Blocker Register (must PASS before production)

| ID | Feature | Status | Root cause |
|----|---------|--------|------------|
| MOB-AUTH-003/004 | Phone OTP | PARTIAL | Configure `AUTH_PHONE_OTP_WEBHOOK_URL` on staging |
| MOB-AUTH-007 | Password reset | PARTIAL | Configure `AUTH_PASSWORD_RESET_WEBHOOK_URL` on staging |
| MOB-AUTH-010 | Session restoration | PARTIAL | Staging cold-start device QA pending |
| MOB-PROF-009/010 | Profile completion | NOT TESTED | Staging device QA pending |
| MOB-PROF-004, API-PROF-004 | Emergency contacts | NOT TESTED | Staging device QA pending |
| API-PROF-002 | PATCH /users/me | NOT TESTED | Staging runtime pending |
| API-PROF-005/006, ADM-USR-006 | KYC workflow | PARTIAL/NOT TESTED | Legal docs may BLOCK; staging QA |
| API-PROF-003 | Avatar upload | NOT TESTED | S3 staging (INF-006) required |
| MOB-EMRG-009/010 | Incident status/history | FAIL/NOT IMPL | No mobile fetch |
| MOB-NOTF-001–004 | Push pipeline | BLOCKED | FCM + iOS gap |
| MOB-NW-* / MOB-SAFE-007 | Mock citizen feeds | FAIL | Static UI data |
| API-CORE-011–014 | Notification delivery | BLOCKED/FAIL | Redis/FCM/SMS/email |
| ADM-INC-003/007 | Verification actions | PARTIAL/FAIL | Unwired buttons |
| ADM-USR-003/004 | User suspend/reactivate | NOT IMPL | No API |
| ADM-BRD-008/009 | Broadcast channels | BLOCKED/FAIL | Delivery layer |
| INF-005/006/013/014 | Redis, S3, backups | BLOCKED/NOT IMPL | Ops gaps |

---

## Final Release Gate

| Gate criterion | Met? |
|----------------|:----:|
| All P0 items PASS | **NO** (37 open) |
| All P1 PASS or waived | **NO** (28 open) |
| No demo data in visible features | **NO** |
| No dead visible controls | **NO** |
| Critical flows pass on staging | **PARTIAL** (core SOS/report only) |
| Checklist updated with evidence | **YES** (this document) |

### **VERDICT: NOT READY FOR PRODUCTION**

---

## Maintenance instructions

1. After every fix, update the row's **Status**, **Files Changed**, **Automated Test**, **Manual Device Test**, **Staging Verified**, and add a **Changelog** entry.
2. Do **not** delete failed rows; change status only.
3. Recalculate **Release Dashboard** counts at the top.
4. A feature may move to **PASS** only when all PASS criteria in the header rules are satisfied with cited evidence.
