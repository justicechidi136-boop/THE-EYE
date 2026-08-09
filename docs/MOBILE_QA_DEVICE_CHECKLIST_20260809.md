# Mobile QA device checklist — 2026-08-09

Use with staging APK built from `fix/mobile-qa-remediation-20260809` (or merged `staging`).

For each ID: record **PASS / FAIL / BLOCKED**, device model, APK SHA-256, and screenshot path.

## Build

- [ ] Staging APK installed from CI artifact or local `flutter build apk --flavor staging`
- [ ] APK SHA-256: `________________`
- [ ] Device: `________________`
- [ ] API base: `https://staging-api.theeye.com.ng/v1`

## PR1 — Auth chrome, home, navigation, notifications

| ID | Check | Result | Notes |
| --- | --- | --- | --- |
| UI-002 | Home service cards: no overflow/clipped title or description | | |
| UI-004 | Create account: dark theme readable (inputs, labels, CTA) | | |
| UI-005 | Login: “Or” / “New user?” readable in dark mode | | |
| UI-011 | Services / Broadcast / Settings: title only, no back chevron | | |
| UI-012 | Notification tap opens detail once (no stacked routes on rapid tap) | | |
| UX-004 | Unread vs read: weight/dot vs muted after open / mark-all | | |
| UX-009 | Card shows body/preview when API provides it | | |
| FUNC-005 | Stay signed in across mid-session; no false “session expired” after idle | | |
| AUTH-004 | Google profile names are real (not “Google” / “Account”) when provider sends them | | |
| AUTH-003 | Google sign-in | BLOCKED until ops SHA + web client | See ops gates |
| AUTH-001 | Password reset link | BLOCKED until Cloudflare 526 fixed | See ops gates |

## PR2 — Incident status + Active Emergency + evidence

| ID | Check | Result | Notes |
| --- | --- | --- | --- |
| UI-007 | Incident list: title, EYE-… id, human status, time, location | | |
| UI-008 | No UUID / LowConfidence / CancelledByReporter / triage internals on cards | | |
| UI-009 | Live video: no “NotStarted” / “Not connected” / “Participants: 0” when idle | | |
| FUNC-002 | Start live video enabled when permissions OK (unless hard-blocked) | | |
| UI-010 | Active emergency: single title (no duplicate body back header) | | |
| UX-006 | Single voice control on AE (no duplicate recorder) | | |
| UX-007 | After record: playable attachment with duration / delete / re-record | | |
| UX-008 / FUNC-003 | Evidence upload surfaces step failure; items visible after submit/refresh | | |

## PR3 — Missing person form + broadcast detail

| ID | Check | Result | Notes |
| --- | --- | --- | --- |
| UX-010 / FUNC-007 | Form: age, gender, last-seen date/time/location | | |
| UX-011 / FUNC-008 | Form: physical description, clothing, additional info | | |
| FUNC-012 / FUNC-013 | Submit sends real field values (not Unknown / now-only defaults) | | |
| FUNC-009 / FUNC-014 | Detail does not repeat the same description in every section | | |
| UI-013 | Timestamps: human format (e.g. 8 Aug 2026, 5:53 PM) | | |
| UI-014 | Active broadcast expiry never shows “Just now”; shows “Expires in …” | | |
| UX-013 / UX-014 | Detail sections: Person → Photo → Age/Gender → Last seen → Physical → Clothing → Additional | | |
| UX-012 | Form media: video thumbnail / audio preview before submit | | |
| FUNC-006 | One inbox/push notification per broadcast per user (no dupes on redispatch) | | |

## Ops (parallel — do not mark PASS from app alone)

See [MOBILE_QA_OPS_GATES_20260809.md](./MOBILE_QA_OPS_GATES_20260809.md).

## Sign-off

| Role | Name | Date | Verdict |
| --- | --- | --- | --- |
| Device QA | | | |
| Mobile eng | | | |
