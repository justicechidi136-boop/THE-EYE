# Mobile QA Remediation — Latest Physical Device Sprint

**Branch:** `fix/mobile-qa-remediation-latest`  
**Starting staging SHA:** `846c553b4c82c46c7f1b30b9fdcf6a35bd574671`  
**Status:** CODE COMPLETE — CI PENDING — PHYSICAL DEVICE QA PENDING  
**PR:** _(see GitHub after open)_  

Source of truth: latest physical-device QA list in the remediation sprint brief (IDs below only).  
Do **not** mark `DEVICE_QA_PASS` without physical Android evidence.

## ID mapping note

| Source QA ID | Tracker / notes |
| --- | --- |
| FUNC-0XX | **Vehicle Details Cannot Be Saved** — retained as `FUNC-0XX` (source). Root cause addressed: orphan API client without refresh + gallery `content://` prepare + opaque errors. |
| FUNC-026 | **Use Saved Vehicle** (this sprint). Prior tracker used FUNC-026 for vehicle photos — garage multi-photo remains under FUNC-025. |
| FUNC-027 | **Report Sighting** (this sprint). Prior tracker numbered sightings as FUNC-028. |

## Defect matrix

| QA ID | Priority | Reproduced | Root Cause | Mobile | API | DB/Storage | Fix | Automated Test | CI | Device Retest |
| ----- | -------- | ---------- | ---------- | ------ | --- | ---------- | --- | -------------- | -- | ------------- |
| UI-014 | P2 | Code audit | Shared secondary header exists | Y | N | N | EyePageHeader.secondary (retain AE treatment) | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| UI-016 | P2 | Code audit | Cancel sheet not scrollable under keyboard | Y | N | N | ScrollView + viewInsets + maxHeight | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| UI-017 | P2 | Code audit | Canonical mapper | Y | Y | N | citizenIncidentCategoryLabel (Emergency ≠ Live Emergency Video) | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| AUTH-007 | P1 | Staging merged | Was admin /login CTA | Y | Y | N | Deep link return (already on staging) | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| UX-007 | P1 | Prior | AE evidence projection | Y | Y | S3 | evidenceItems + cards (prior + shared client) | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| UX-016 | P2 | Prior | Typed notification copy | Y | Y | N | citizen-notification-copy | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| UX-024 | P1 | Prior | Vehicle-details style evidence | Y | N | N | ManagedEvidenceSection pattern | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| UX-027 | P2 | Code audit | Last seen 12h display | Y | N | N | formatCitizenTimeOfDay + showCitizenTimePicker | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| UX-028 | P2 | Code audit | My Cars label | Y | N | N | Rename My Vehicles | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| UX-029 | P2 | Code audit | Notes label | Y | N | N | Label Vehicle Description | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| UX-030 | P2 | Code audit | Service card overflow | Y | N | N | Flexible ActionTile + aspect ratio | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| UX-031 | P2 | Code audit | LOCAL overlay | Y | N | N | Removed citizen LOCAL tag | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| FUNC-002 | P0 | Prior | Evidence upload lifecycle | Y | Y | S3 | Coordinator + shared refresh client | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-004 | P0 | Code audit | Orphan clients skipped 401 refresh | Y | Y | N | AppController shared authorized apiClient | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| FUNC-008 | P1 | Prior | Broadcast detail attachments | Y | Y | S3 | metadata.attachments + shared client | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-010 | P0 | Code audit | Vehicle gallery File.copy on content:// | Y | N | N | persistPickedVehicleImage bytes fallback | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| FUNC-017 | P0 | Prior | Verification eligibility + copy | Y | Y | N | Type-aware issue path (prior) | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-018 | P0 | Code audit | MP media + orphan client | Y | Y | S3 | Shared BroadcastMediaUploadService client | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-019 | P1 | Prior | Multi-select + limits | Y | Y | N | EvidencePolicy + pickers | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-020 | P1 | Code audit | TimePicker input constraints | Y | N | N | showCitizenTimePicker hardened | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |
| FUNC-024 | P1 | Prior | Structured SV fields | Y | Y | N | Structured detail (prior) | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-025 | P1 | Prior | Multi-vehicle garage | Y | Y | Y | CitizenVehicle 0..N | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-026 | P1 | Prior | Saved vehicle selector | Y | Y | N | Explicit Use Saved / Manual | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-027 | P1 | Prior | Sighting workflow | Y | Y | Y | BroadcastSighting + citizen time picker | CODE_FIXED | OPEN | DEVICE_QA_PENDING |
| FUNC-0XX | P0 | Code audit | Orphan client + content:// + opaque errors | Y | Y | Y | Authorized client + prep + mapped errors + “Vehicle saved.” | AUTOMATED_TEST_PASS | OPEN | DEVICE_QA_PENDING |

## Staging migrations (DevOps)

Apply if not already on staging (additive; no destructive reset):

1. `20260812223000_func025_citizen_vehicle_garage`
2. `20260812233000_func026_citizen_vehicle_photos`

## Local validation (this branch)

| Suite | Result |
| --- | --- |
| API lint | pass |
| API test | **770/770** |
| Admin-web test | **33/33** |
| Mobile test | **454/454** |

## Physical retest (required before PASS)

Especially: vehicle save on staging APK, gallery `content://` photos, cancel keyboard on small phones, Last Seen input mode, AUTH-007 email→Return to THE EYE, multi-media Missing Person publish, Active Emergency evidence after restart.
