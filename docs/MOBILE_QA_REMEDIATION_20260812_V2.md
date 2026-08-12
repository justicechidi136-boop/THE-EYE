# Mobile QA Remediation — 2026-08-12 v2

**Branch:** `fix/mobile-qa-remediation-20260812-v2`  
**Base staging SHA:** `2aea0fb0c3b98abf2949ba5086d6fb57cf9c1224`  
**Status:** CODE COMPLETE — CI PENDING → then PHYSICAL DEVICE QA PENDING  

Source of truth: updated physical-device QA list in the remediation sprint brief (IDs below only).

Do **not** mark `DEVICE_QA_PASS` without physical Android evidence.

## Defect matrix

| ID | Priority | Reproduced | Root Cause | Mobile | API | DB/Storage | Fix | Automated Test | Device Retest | Status |
| -- | -------- | ---------- | ---------- | ------ | --- | ---------- | --- | -------------- | ------------- | ------ |
| UI-014 | P1 | Code audit | Secondary headers inconsistent | Y | N | N | EyePageHeader.secondary aligned to AE family | Header widget tests | Align listed screens | AUTOMATED_TEST_PASS |
| UI-017 | P0 | Code audit | Multiple title mappers | Y | Y | N | Canonical citizenIncidentCategoryLabel | Presentation tests | Home vs Status same title | AUTOMATED_TEST_PASS |
| AUTH-007 | P0 | Code audit | Reset success → Admin `/login` | N | Y | N | Citizen return-to-app copy; no admin login CTA | auth-recovery-citizen-routing + URL tests | Forgot→email→reset→app | AUTOMATED_TEST_PASS |
| UX-007 | P0 | Prior QA | AE evidence/description gaps | Y | Y | S3 | AE overview + evidence cards from server | AE evidence tests | Restart still shows media | AUTOMATED_TEST_PASS |
| UX-016 | P1 | Code audit | Friendly copy + read state | Y | Y | N | citizen-notification-copy + presenter | Copy/inbox tests | Push inbox format | AUTOMATED_TEST_PASS |
| UX-023 | P1 | Code audit | Oversized evidence cards | Y | N | N | Compact EyeEvidenceCard rows | Card widget tests | Compose density | AUTOMATED_TEST_PASS |
| UX-024 | P1 | Code audit | Video duration/thumb weak | Y | N | N | Duration labels + play thumb | Duration tests | Gallery video card | AUTOMATED_TEST_PASS |
| UX-025 | P1 | Code audit | Selected audio duration unset | Y | N | N | Shared media metadata | Audio duration tests | Gallery audio card | AUTOMATED_TEST_PASS |
| UX-026 | P1 | Code audit | AE type label inconsistent | Y | N | N | Canonical type on AE | AE type tests | AE type visible | AUTOMATED_TEST_PASS |
| UX-027 | P1 | Code audit | Last-seen 24h ambiguity | Y | N | N | 12h AM/PM formatters | Format + detail tests | MP last seen | AUTOMATED_TEST_PASS |
| FUNC-002 | P0 | Prior QA | Evidence upload lifecycle | Y | Y | S3 | EvidencePolicy + coordinator + DTO limits | Evidence suite | Camera/gallery/video/audio | AUTOMATED_TEST_PASS |
| FUNC-004 | P0 | Code audit | Single-flight not on HTTP | Y | Y | N | onUnauthorizedRefresh + resume refresh | auth_session_restore_test | Background/resume | AUTOMATED_TEST_PASS |
| FUNC-008 | P0 | Prior QA | Detail evidence gaps | Y | Y | S3 | Detail reads metadata.attachments | Broadcast detail tests | Other device sees media | AUTOMATED_TEST_PASS |
| FUNC-014 | P0 | Code audit | Standalone stop skipped AE | Y | N | N | resolveLiveVideoStopRouting → AE replace | live_video_lifecycle_test | Standalone stop path | AUTOMATED_TEST_PASS |
| FUNC-015 | P1 | Code audit | Capture options incomplete | Y | N | N | Shared picker photo/video/audio | Capture tests | All 6 options | AUTOMATED_TEST_PASS |
| FUNC-016 | P0 | Code audit | Same as UI-017 | Y | Y | N | Canonical titles | Presentation tests | Status ≠ description | AUTOMATED_TEST_PASS |
| FUNC-017 | P0 | Code audit | Verification category copy | N | Y | N | Type-aware verification notifications | verification + copy tests | Nearby push | AUTOMATED_TEST_PASS |
| FUNC-018 | P0 | Prior QA | MP+evidence publish path | Y | Y | S3 | Upload then activate; clear errors | Broadcast submit tests | MP + photo publish | AUTOMATED_TEST_PASS |
| FUNC-019 | P1 | Code audit | Limits not centralized | Y | Y | N | EvidencePolicy + server DTO | Limits tests | Multi-select caps | AUTOMATED_TEST_PASS |
| FUNC-021 | P1 | Code audit | Active cards navigation | Y | N | N | Tap → AE with semantics | Card/nav tests | Card tap | AUTOMATED_TEST_PASS |
| FUNC-022 | P0 | Code audit | Success used pushNamed | Y | N | N | pushReplacementNamed + clear draft | Nav regression | Back ≠ form | AUTOMATED_TEST_PASS |
| FUNC-023 | P0 | Code audit | My Broadcasts spinner stuck | Y | Y | N | Explicit LOADING/EMPTY/ERROR states | My Broadcasts tests | Empty/error/retry | AUTOMATED_TEST_PASS |
| FUNC-024 | P0 | Code audit | SV detail not structured | Y | Y | N | Structured detail hierarchy + year payload | SV detail tests | Detail sections | AUTOMATED_TEST_PASS |
| FUNC-025 | P0 | Code audit | Single local car | Y | Y | Y | CitizenVehicle garage + `/me/vehicles` | Garage suite | Add 2+ vehicles | AUTOMATED_TEST_PASS |
| FUNC-026 | P0 | Device QA | Garage allowed only one photo | Y | Y | Y | CitizenVehiclePhoto + multi-select upload (max 8) | Vehicle photo suite | Multi photo add/edit/retry | CODE_FIXED |
| FUNC-027 | P0 | Device QA | Auto-prefill primary no longer valid | Y | Y | N | Explicit Use Saved / Manual + snapshot metadata | Selector + draft tests | Multi-vehicle select + return | CODE_FIXED |
| FUNC-028 | P0 | Device QA | Sighting stubs / incomplete workflow | Y | Y | Y | Full BroadcastSighting + evidence + notify + list | Sighting API/mobile tests | Active SV report sighting | CODE_FIXED |
| NAV-002 | P0 | Code audit | Same as FUNC-022 | Y | N | N | Replace nav after publish | Nav regression | Back to center | AUTOMATED_TEST_PASS |

### ID normalization note (original QA wording preserved)

The physical QA packet accidentally reused `FUNC-026` for two distinct requirements (multi vehicle photos **and** saved-vehicle selection). This tracker normalizes:

| Tracker ID | Original QA wording |
| ---------- | ------------------- |
| FUNC-026 | My Vehicles supports multiple vehicle photo selection/upload |
| FUNC-027 | Stolen Vehicle supports explicit selection from multiple saved vehicles |
| FUNC-028 | Complete Report Sighting workflow |

Original QA prose for both photo and selector requirements remains the product source of truth; only the tracker IDs are disambiguated.

## Primary vehicle delete rule

When the primary `CitizenVehicle` is deleted, promote the most recently updated remaining vehicle. If none remain, zero primary is allowed.

## Staging migration

Apply in order (DevOps owns deploy — do not run destructive resets):

1. `20260812223000_func025_citizen_vehicle_garage`
2. `20260812233000_func026_citizen_vehicle_photos`

### FUNC-026 / FUNC-027 / FUNC-028 physical retest
1. My Vehicles: add vehicle with 3–5 photos; remove one; retry a failed upload; edit and add more (max 8).  
2. Stolen Vehicle: no auto-select; Use Saved Vehicle → pick second car; Add Vehicle empty-state return preserves draft.  
3. Active Stolen Vehicle: Report Sighting with GPS/manual/skip, mixed evidence, success → detail; owner notification.

## Physical retest steps (summary)

### AUTH-007
1. Mobile Forgot Password → email → open link → reset → confirm no Admin Dashboard login.  
2. Success instructs return to THE EYE app.

### FUNC-004
1. Sign in → wait past access TTL → continue using app.  
2. Background 10m → resume → create report.

### FUNC-002 / UX-007 / FUNC-015 / FUNC-019 / UX-023–025
1. Emergency report with photo/video/audio (camera+gallery+record).  
2. Active Emergency shows description + evidence after restart.  
3. Compact cards, durations, capacity labels.

### FUNC-018 / FUNC-008 / FUNC-022 / NAV-002 / FUNC-023
1. Missing Person with evidence publishes; detail shows media on second device.  
2. Back does not reopen completed form.  
3. My Broadcasts empty / populated / error + Retry.

### FUNC-024 / UX-027 / FUNC-025
1. Stolen Vehicle structured fields + AM/PM last seen + evidence.  
2. My Cars: add 3 vehicles, primary, edit, delete primary promotion.

### FUNC-014
1. Standalone Live Emergency Video → Stop → Active Emergency same incident.

### FUNC-017 / UX-016 / UI-017 / UX-026 / FUNC-021 / UI-014
1. Create Fire/Accident near eligible device → verification notification format.  
2. Canonical titles; Active Incidents → AE; headers aligned.

## APK

| Field | Value |
| ----- | ----- |
| Path | TBD after build |
| Package ID | `com.theeye.app.staging` |
| SHA-256 | TBD |
| Source commit | TBD |

## Local validation (pre-PR)

| Check | Result |
| ----- | ------ |
| API lint (`tsc`) | PASS (after prisma generate) |
| Prisma validate/generate | PASS |
| API tests | **732/732** |
| Mobile analyze (CI flags) | PASS (0 errors; warnings non-fatal) |
| Mobile tests | **416/416** |
