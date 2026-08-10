# Mobile UI QA remediation — UI-007 / UI-010 / UI-012 / UI-013 / UI-014 / UI-015 / UI-016

Branch: `fix/mobile-ui-qa-007-016` → PR into `staging` (do not auto-merge).

## Audit summary (Phase 1)

| Area | Before | Shared fix |
| --- | --- | --- |
| Headers | Mixed `AppBar` + `EyePageBackHeader` (often duplicated) | `EyePageHeader.root` / `.secondary` |
| Incident cards | Extra location; long status strings | `EyeIncidentSummaryCard` + compact status mapper |
| Date/time | Multiple helpers; some ISO leaks | `CitizenDateTimeFormatter` |
| Broadcast expiry | Status + expiry lines could contradict | `BroadcastExpiryPresenter` |
| Evidence | 56px thumbs; UUID/`fileName` titles | `EvidencePresentationMapper` + `EyeEvidenceCard` |

## Root cause — UI-013

When backend `status` remains `Active` while `expiresAt` is already past (worker lag / stale flag), the UI previously could show **Active** alongside an expiry-relative line. Relative “just now” wording for past times belongs to age formatting, not expiry.

Fix: `BroadcastExpiryPresenter` renders a single non-contradictory citizen state (`Expired` + “Expired … ago”), logs a sanitized diagnostic, and does **not** mutate backend status from Flutter.

## Device QA (required before PASS)

Do not mark these IDs PASS from widget tests alone. Retest on a physical device with the staging APK:

| ID | Path |
| --- | --- |
| UI-007 | Tracking → Incident Status cards |
| UI-010 | Services / Broadcast / Settings (no back) |
| UI-012 | Missing Person → Broadcast Details timestamps |
| UI-013 | Active / near-expiry / expired broadcasts |
| UI-014 | Broadcast Detail / Notifications / Emergency Case / Incident Details (back present) |
| UI-015 | Emergency evidence Photo/Audio labels + preview size |
| UI-016 | Missing Person Photo/Video/Audio labels |

## Status

Code complete pending physical-device retest.
