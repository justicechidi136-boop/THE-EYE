# Mobile QA Remediation — 2026-08-07

Branch: `fix/mobile-qa-remediation-20260807`  
Target: `staging`  
Status: **QA REMEDIATION CODE COMPLETE — DEVICE QA PENDING**

## Defect matrix

| QA ID | Module | Sev | Repro (before) | Root cause | Owner | Fix summary | Tests | Device QA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-001 / FUNC-001 | Auth delivery / infra | P0 | Recovery/reset links → Cloudflare 526 | Staging origin TLS / DNS / Cloudflare SSL mode mismatch; HTTP or missing link bases | DevOps + API guard | HTTPS-only link base validation; fail-closed when bases missing; friendly email timestamps | `validate-env.recovery.spec.ts` | **PENDING** |
| AUTH-003 | Google Sign-In | P0 | Sign-in fails on staging Android | Firebase SHA/OAuth config + raw error surfacing; GenericIdp fallback path | Mobile + Firebase ops | Sanitized errors; native picker + `google_sign_in` fallback retained | `social_auth_service_test.dart` | **PENDING** |
| AUTH-002 | Apple Sign-In | P1 | Misleading network error on Android | Apple shown on unsupported Android builds | Mobile | Hide Apple on Android (`iOS/macOS` only) | `mobile_qa_remediation_test.dart` (policy) | **PENDING** |
| AUTH-004 | Google profile | P1 | Names default to Google/Account | Server used placeholder email parsing when Firebase name missing | API | `givenName`/`familyName` from token; empty names instead of placeholders | `citizen-presentation.spec.ts` | **PENDING** |
| UI-006 | Auth UI | P1 | Raw AUTH-GOOGLE codes shown | Client mapped codes into user-visible strings | Mobile | `_sanitizeUserFacingAuthMessage` + friendly copy | `social_auth_service_test.dart` | **PENDING** |
| UI-007 / UI-009 | Incident status | P1 | UUIDs/enums/confidence exposed | No citizen presentation layer on list/detail | API + Mobile | Shared citizen mapper + public reference + friendly tiles | `mobile_qa_remediation_test.dart` | **PENDING** |
| UI-010 / FUNC-002 | Active Emergency | P0 | Blank ID, SOS defaults, raw metadata | Contract rendered internal fields; missing server evidence projection | API + Mobile | `publicReference`, `categoryLabel`, evidence items, friendly labels | contract + presentation tests | **PENDING** |
| FUNC-003 | Live video | P0 | Stuck Connecting / no preview | Permission/GPS/LiveKit startup chain (runtime) | Mobile + API | `userDisplayState` on API card; existing startup trace retained | live video tests (existing) | **PENDING** |
| FUNC-004 | Evidence upload | P0 | Report succeeds, evidence fails | Upload/finalize partial failure messaging routed to tracking | Mobile | Retry copy points to Active Emergency | submission path | **PENDING** |
| FUNC-005 | Resubmission | P0 | Completed form reusable | Compose draft not cleared; push navigation | Mobile | `deleteComposeDraft` on success + replacement nav | navigation contract | **PENDING** |
| NAV-001 | Navigation | P0 | Back returns to submitted form | `pushNamed` after submit | Mobile | `openAfterSubmission(..., replace: true)` | `ActiveEmergencyNavigation` | **PENDING** |
| UX-005 | Evidence preview | P1 | No photo thumbnails | Preview tile icon-only | Mobile | `Image.file` thumbnail in `EvidencePreviewTile` | manual/widget | **PENDING** |
| UX-006 | Audio dedupe | P1 | Duplicate voice UI | Voice recorder + attachment list both visible | Mobile | Hide recorder when audio attachment exists | manual | **PENDING** |
| UX-007 / UX-008 | AE evidence | P1 | Submitted evidence not shown / duplicate controls | API omitted evidence list; combined add/upload UI | API + Mobile | `evidenceItems` + separate sections | contract tests | **PENDING** |
| UI-001 | Home safe area | P2 | Header under status bar | Missing top safe inset on Figma home shell | Mobile | `SafeArea(bottom: false)` on home body | layout manual | **PENDING** |
| UI-002 | Service cards | P2 | Description overflow | Fixed 150px card height | Mobile | Flexible min-height + 4-line description | widget manual | **PENDING** |
| UI-003 | Online indicator | P2 | Overlapped cards | Status strip below service grid | Mobile | Moved strip under header, removed duplicate | manual | **PENDING** |
| UI-004 / UI-005 | Create account / auth chrome | P2 | Light surfaces in dark mode | Hardcoded white inputs / low-contrast “Or” | Mobile | `EyeInputTheme` on registration; semantic “Or” text | theme tests (existing) | **PENDING** |
| UX-002 | Recovery success | P2 | Weak confirmation | Plain secondary text only | Mobile | Success banner with anti-enumeration copy | manual | **PENDING** |
| UX-003 | Recovery email dates | P2 | ISO timestamps in email | Raw `toISOString()` in templates | API | `formatCitizenEmailTimestamp` | `citizen-presentation.spec.ts` | **PENDING** |
| UX-004 | Notifications | P2 | Dense/technical cards | Partial metadata exposure | Mobile | Further polish deferred | existing tests | **DEFERRED** |
| UX-001 | Native Google UX | P2 | Browser fallback | OEM GenericIdp failures | Mobile | Native path first; plugin fallback documented | existing auth tests | **PENDING** |
| Phase 28 | Public reference | P1 | UUID shown to citizens | No public reference field | API + shared | Deterministic `EYE-YYMMDD-XXXX` | shared + mobile tests | **PENDING** |

## Physical QA checklist

Record when executed on device: Git SHA, APK SHA-256, device, Android version, before/after screenshot, request ID, PASS/FAIL.

Do **not** mark runtime P0 items PASS from unit tests alone.
