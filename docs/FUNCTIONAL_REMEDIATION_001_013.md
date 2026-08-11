# Functional Remediation FUNC-001 … FUNC-013

**Branch:** `fix/mobile-functional-001-013`  
**Status:** CODE COMPLETE — DEVICE QA PENDING  
**Do not mark device-gated IDs PASS without physical Android retest.**

## Reproduction matrix (summary)

| QA ID | Module | Root cause | Ownership | Runtime blocker |
|---|---|---|---|---|
| FUNC-001 | Live Emergency Video | Start disabled while lifecycle=`preparing` (preview); GPS not the hard-block | Mobile | Device camera/mic |
| FUNC-002 | Evidence upload | Abort-on-first-failure; soft-fail treated as success; no shared coordinator | Mobile | Staging S3 |
| FUNC-004 | Auth session | No single-flight refresh; most APIs lack 401 retry | Mobile | — |
| FUNC-007 | Broadcast detail | Duplicate status UI; metadata missing on citizen detail | Mobile + API | — |
| FUNC-008 | Broadcast evidence | Form evidence never uploaded; detail placeholders only | Mobile + API | Staging S3 |
| FUNC-009 | Audio preview | `EyeEvidenceCard.onPlay` was no-op | Mobile | — |
| FUNC-010 | Gallery prep | Assumed filesystem path; gallery `content://` failed File.copy | Mobile | Device gallery |
| FUNC-011 | Broadcast detail load | Auth early-return left `_loading=true`; chained `listMine` | Mobile + API | — |
| FUNC-012 | Google sign-in | Logout never called Google disconnect/signOut | Mobile | Firebase SHA |
| FUNC-013 | Empty upload | Wrong copy; no a11y announce | Mobile | — |

## Device QA gate

Do **not** mark PASS for FUNC-001, FUNC-002, FUNC-004, FUNC-010, FUNC-011, FUNC-012 until physical Android QA:

1. Capture APK SHA-256, device model, Android version  
2. Follow flows in the sprint brief  
3. Record incident/broadcast IDs and screenshots  

## Staging APK

Build after CI green (DevOps/release owns deploy). Package: `com.theeye.app.staging`.
