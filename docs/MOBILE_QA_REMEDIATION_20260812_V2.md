# Mobile QA Remediation — 2026-08-12 v2

**Branch:** `fix/mobile-qa-remediation-20260812-v2`  
**Base staging SHA:** `2aea0fb0c3b98abf2949ba5086d6fb57cf9c1224`  
**PR:** (opened after push)  
**Status:** QA REMEDIATION IN PROGRESS  

Source of truth: updated physical-device QA list in the remediation sprint brief (IDs below only).

Do **not** mark `DEVICE_QA_PASS` without physical Android evidence.

## Defect matrix

| ID | Priority | Reproduced | Root Cause | Mobile | API | DB/Storage | Fix | Automated Test | Device Retest | Status |
| -- | -------- | ---------- | ---------- | ------ | --- | ---------- | --- | -------------- | ------------- | ------ |
| UI-014 | P1 | Code audit | Secondary headers inconsistent on some screens | Y | N | N | Shared secondary header family | Widget header tests | Align Active Emergency pattern on listed screens | OPEN |
| UI-017 | P0 | Code audit | Multiple title mappers; description used as title | Y | Y | N | Canonical citizen incident title mapper | Presentation unit/widget | Home vs Status same title | OPEN |
| AUTH-007 | P0 | Code audit | Reset success links to Admin `/login` | N | Y | N | Citizen success copy; no admin login CTA | Recovery URL + page tests | Forgot→email→reset→app | OPEN |
| UX-007 | P0 | Prior QA | AE may omit description/evidence projection | Y | Y | S3 | Ensure AE contract + UI show server evidence | AE evidence tests | Restart still shows media | OPEN |
| UX-016 | P1 | Code audit | Friendly copy exists; verify inbox visuals | Y | Y | N | Citizen notification presenter + read state | Copy + inbox tests | Push inbox format | OPEN |
| UX-023 | P1 | Code audit | Evidence cards too tall on compose | Y | N | N | Compact shared evidence rows | Widget card tests | Compose density | OPEN |
| UX-024 | P1 | Code audit | Video thumb/duration often missing | Y | N | N | Metadata + compact video row | Duration/thumb tests | Gallery video card | OPEN |
| UX-025 | P1 | Code audit | Selected audio duration not always set | Y | N | N | Shared media metadata | Audio duration tests | Gallery audio card | OPEN |
| UX-026 | P1 | Code audit | AE type label inconsistent | Y | N | N | Canonical type on AE header | AE type widget test | AE type visible | OPEN |
| UX-027 | P1 | Code audit | Last-seen time may be 24h | Y | N | N | 12h AM/PM display helpers | Format unit tests | MP last seen | OPEN |
| FUNC-002 | P0 | Prior QA | content:// + upload lifecycle gaps | Y | Y | S3 | Evidence coordinator + retry | Evidence suite | Camera/gallery/video/audio | OPEN |
| FUNC-004 | P0 | Code audit | Single-flight not wired into API client | Y | Y | N | Authorized session client + retry | Auth refresh tests | Background/resume | OPEN |
| FUNC-008 | P0 | Prior QA | Detail may omit persisted evidence | Y | Y | S3 | Detail reads attachments from API | Broadcast detail tests | Other device sees media | OPEN |
| FUNC-014 | P0 | Code audit | Standalone stop skips AE navigation | Y | N | N | Stop → replace to AE | Live video lifecycle tests | Standalone stop path | OPEN |
| FUNC-015 | P1 | Code audit | Capture options incomplete on some paths | Y | N | N | Shared picker photo/video/audio | Capture service tests | All 6 options | OPEN |
| FUNC-016 | P0 | Code audit | Same as UI-017 | Y | Y | N | Canonical titles | Presentation tests | Status ≠ description | OPEN |
| FUNC-017 | P0 | Code audit | Verify category→notification path | N | Y | N | Eligibility + enqueue audit | Verification tests | Nearby push | OPEN |
| FUNC-018 | P0 | Prior QA | MP+evidence publish failure path | Y | Y | S3 | Upload then activate; recoverable errors | MP evidence publish tests | MP + photo publish | OPEN |
| FUNC-019 | P1 | Code audit | Limits not centralized/UI capacity | Y | Y | N | EvidencePolicy + server enforce | Limits tests | Multi-select caps | OPEN |
| FUNC-021 | P1 | Code audit | Active incident cards may not route AE | Y | N | N | Tap → `/active-emergency/:id` | Nav widget test | Card tap | OPEN |
| FUNC-022 | P0 | Code audit | Success uses pushNamed (form remains) | Y | N | N | pushReplacementNamed + clear state | Nav regression | Back ≠ form | OPEN |
| FUNC-023 | P0 | Code audit | My Broadcasts spinner on auth failure | Y | Y | N | LOADING/SUCCESS/EMPTY/ERROR | My Broadcasts state tests | Empty/error/retry | OPEN |
| FUNC-024 | P0 | Code audit | Structured SV not rendered on detail | Y | Y | N | Persist + detail hierarchy | SV structured tests | Detail sections | OPEN |
| FUNC-025 | P0 | Code audit | My Cars = single local profile | Y | Y | Y | Multi-vehicle garage API+UI | Garage suite | Add 2+ vehicles | OPEN |
| NAV-002 | P0 | Code audit | Same as FUNC-022 | Y | N | N | Replace nav after publish | Nav regression | Back to center | OPEN |

## Physical retest steps (summary)

### AUTH-007
1. Mobile Forgot Password → receive email → open link → reset → confirm no Admin Dashboard login.  
2. Confirm success instructs return to THE EYE app.

### FUNC-004
1. Sign in → wait past access TTL (or force short TTL in staging) → use app without re-login.  
2. Background 10m → resume → create report.

### FUNC-002 / UX-007 / FUNC-015 / FUNC-019 / UX-023–025
1. Emergency report with photo (camera+gallery), video (record+gallery), audio (record+gallery).  
2. Confirm Active Emergency shows description + all evidence after restart.  
3. Confirm compact cards, video duration/thumb, audio duration, capacity labels.

### FUNC-018 / FUNC-008 / FUNC-022 / NAV-002 / FUNC-023
1. Missing Person with evidence publishes; detail shows media on second device.  
2. Back does not reopen completed form.  
3. My Broadcasts: empty, populated, airplane-mode error + Retry.

### FUNC-024 / UX-027 / FUNC-025
1. Stolen Vehicle structured fields + AM/PM last seen + evidence.  
2. My Cars: add 3 vehicles, primary, edit, delete primary rule.

### FUNC-014
1. Standalone Live Emergency Video → Stop → lands Active Emergency same incident.

### FUNC-017 / UX-016 / UI-017 / UX-026 / FUNC-021 / UI-014
1. Create Fire/Accident near second eligible device → verification notification format.  
2. Canonical titles Home/Status/AE match; Active Incidents cards open AE; headers aligned.

## APK

Record after build (no deploy):

| Field | Value |
| ----- | ----- |
| Path | TBD |
| Package ID | `com.theeye.app.staging` |
| SHA-256 | TBD |
| Source commit | TBD |
