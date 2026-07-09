# THE EYE UI Gap Analysis

Date: 2026-07-07

## Figma Source Reviewed

File: `THE EYE Copy`

Observed design patterns:
- Mobile-first iPhone 13 mini screens for onboarding, sign in, OTP, password reset, home, live video, broadcast, police stations, services, reporting forms, settings, profile, Neighborhood Watch, and live chat.
- Desktop admin dashboard at 1440px with fixed dark sidebar, white operational cards, charts, tables, login/verification flows, broadcast, users, services, emergencies, live chats, and settings.
- Smartwatch mini screens at 184x224 for onboarding, location permission, stable/risk state, active threat, SOS sent, and report sent.
- Primary colors: `#019934`, `#0B7E5D`, `#032221`, `#FFFFFF`, `#F1F7F6`, emergency red `#FF3B30`, warning orange `#FF6600`.
- Typography: mostly Biennale, Inter, SF Pro Text, Roboto, and Lexend depending on screen family.
- UI language: compact cards, rounded buttons, high-contrast emergency actions, dark command/safety surfaces, white content cards, concise labels, and location-first safety alerts.

## Current Codebase Coverage

Admin web already included:
- Login, role-based shell, live incident map, incident list/detail, verification queue, emergency queue, broadcasts, missing persons, stolen vehicles, live video viewer, users, agencies, jurisdictions, audit logs, analytics, police locator, notifications, Neighborhood Watch modules, and smartwatch modules.

Mobile app already included:
- Splash, login/register, home, persistent SOS action, emergency/crime/accident reports, live emergency video, broadcasts, nearby police stations, notifications, incident tracking, family safety circle, profile, settings, Neighborhood Watch, smartwatch, offline drafts, low-data mode, and high-contrast mode.

## Gaps Found And Updates Made

1. Emergency Reporting
- Gap: Mobile app exposed Emergency, Crime, and Accident, but Fire, Kidnapping, Abuse, and Suspicious Activity were not first-class routes.
- Updated: Added report routes and home action tiles for Fire, Kidnapping, Abuse, and Suspicious Activity using the existing large-card mobile pattern.

2. Incident Verification
- Existing: Admin verification queue shows confidence score, GPS accuracy, evidence count, and reporter status.
- Remaining UI TODO: Duplicate cluster drilldown and nearby witness response detail can be expanded once backend returns richer verification signal payloads.

3. Live Video Reporting
- Existing: Admin live video page includes permanent evidence overlay, date/time, GPS, accuracy, reporter ID/anonymous ID, Open Location, Copy Coordinates, movement trail, latest GPS, and map marker.
- Remaining UI TODO: Replace placeholder video/map panels with LiveKit and map SDK components after production keys are available.

4. Neighborhood Watch
- Existing: Admin and mobile both include communities, approvals, posts, verification, volunteers, patrols, map, analytics, feed, chat, alerts, and join flows.
- Remaining UI TODO: Add richer moderation detail panels when backend membership/post audit endpoints are finalized.

5. Broadcast System
- Existing: Admin broadcast queue supports emergency, crime, accident, missing person, stolen vehicle, government alert, and community warning with approval/geofence state.
- Updated: Added a consolidated citizen Safety Broadcasts route covering emergency, missing person, stolen vehicle, crime, accident, and government alerts using the established mobile list-card pattern.
- Remaining UI TODO: Add broadcast preview templates once final public alert copy rules are approved.

6. Smartwatch / SOS Device
- Existing: Admin and mobile expose pairing, modes, battery, signal, firmware, live tracking, SOS events, health, and firmware pages.
- Remaining UI TODO: Add real firmware upload/progress states after storage endpoint is wired.

7. Admin Dashboard
- Existing: Command dashboard includes live map, emergency queue, incident list, verification, broadcast, Neighborhood Watch, live video, smartwatch, audit, analytics, and role-scoped shell.
- Updated: Added `Roles and permissions` admin page and reorganized the complete sidebar into responsive Operations, Public Alerts, Neighborhood Watch, Smartwatch, and Administration groups.

8. Roles and Permissions
- Gap: `Community Moderator` was missing from the mock role model and no dedicated RBAC matrix page existed.
- Updated: Added Community Moderator to role scope data and created the `/roles` access matrix page.

9. Audit and Accountability
- Existing: Admin audit page shows append-only hash chain, reasons, actors, entities, and chain status.
- Remaining UI TODO: Add evidence access log detail drawer once evidence access endpoint returns per-file access events.

10. Notifications
- Existing: Admin notifications page covers FCM, SMS/email placeholders, in-app, location targeting, priority, read status, and delivery logs.
- Remaining UI TODO: Add user-facing alert preference management after profile notification settings are finalized.

## Figma-To-Code Alignment

Updated code now uses Figma-derived admin colors:
- `command`: `#032221`
- `eye`: `#019934`
- `eyeDeep`: `#0B7E5D`
- `field`: `#F1F7F6`

Existing component patterns preserved:
- `AppShell`
- `PageHeader`
- `Panel`
- `MetricCard`
- `StatusBadge`
- Mobile `SafetyScaffold`
- Mobile `ActionTile`
- Mobile `SectionCard`
- Mobile `ListTileCard`

No existing working pages were removed.

## Verification Report

- Monorepo lint and TypeScript checks: passed.
- Admin production build: passed, 33 generated routes.
- Admin build smoke test: passed.
- Mobile route/screen smoke test: passed.
- Backend regression tests: passed, 37/37.
- Local admin startup: Next.js reached ready state at `http://localhost:3000`.
- Flutter SDK validation: not run because Flutter is not installed or available on this machine.
- Live Figma re-inspection: blocked after the connected Starter account reached its MCP call limit; the existing inspected design inventory above remained the implementation reference.
