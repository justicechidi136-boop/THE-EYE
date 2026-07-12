# THE EYE — UI Gap Analysis & Implementation Report

**Date:** 2026-07-10  
**Figma source:** [THE EYE (Copy)](https://www.figma.com/design/ZxyNNxUzsx3DiGjRwrCopr/THE-EYE--Copy-)  
**Nodes:** `0:1` (mobile), `563:852` (admin)  
**Brand:** `#009933` green, `#FF9933` orange, Montserrat typography  
**Principle:** Extend existing Figma-aligned UI — no redesign, no brand change

---

## 1. UI Gap Analysis (Figma vs Feature Requirements)

| # | Feature area | Figma / prior code | Gap before this pass | Status after update |
|---|--------------|-------------------|----------------------|---------------------|
| 1 | Emergency Reporting | 7 report routes + SOS FAB | API wiring pending | **Complete UI** — all 7 types + SOS preserved |
| 2 | Incident Verification | Confidence % only | Missing badges, duplicate, witness panels | **Added** Verified/Pending/Disputed/False Information badges, duplicate + witness panels |
| 3 | Live Video | Overlay + GPS links | No trail map, no session picker | **Added** session picker, movement trail map, Open Location |
| 4 | Neighborhood Watch | 10 mobile + 9 admin routes | Nav orphans, no API | **Nav complete** — all NW modules in sidebar |
| 5 | Broadcast | 6 mobile types | Community warning missing on mobile | **Added** community warning; admin compose form |
| 6 | Smartwatch | Pair/modes/battery | No SOS history route | **Added** `/smartwatch/sos-history` + mobile SOS history list |
| 7 | Admin Dashboard | Broad modules | Orphan routes, “The I” label, no RBAC nav | **Fixed** nav labels, all modules linked, role-scoped nav |
| 8 | Roles (9) | All in `roleScope` | No UI enforcement | **Added** `nav-access.ts` role filtering |
| 9 | Audit | Hash chain ledger | No evidence access logs | **Added** evidence access log panel on incident detail |
| 10 | Notifications | Partial samples | Missing 6-type catalog | **Added** 6 notification types in mobile seed + admin type selector |

### Backend-dependent gaps (TODO preserved)

- LiveKit real video player
- Map SDK (Leaflet/Google) — CSS trail placeholder used
- `POST /incidents/report`, `POST /broadcasts`, `POST /notifications/send` wiring
- Verification duplicate/witness API endpoints
- Phone OTP / Google SSO

---

## 2. Updated Screens

### Admin (`apps/admin-web`)

| Screen | Changes |
|--------|---------|
| `/` | Figma dashboard metrics, chart, activity feeds |
| `/login` | Figma centered auth card |
| `/verification` | Verification badges, duplicate + witness panels, GPS links |
| `/incidents`, `/incidents/[id]` | Verification column, status history, evidence access logs, trail map |
| `/live-video` | Session picker, movement trail map |
| `/audit` | Client-side filter component |
| `/broadcasts` | Interactive create form |
| `/notifications` | Type selector (6 alert types) |
| `/smartwatch` | Device detail links |
| Sidebar | Full module nav + role filtering |

### Mobile (`apps/mobile`)

| Screen | Changes |
|--------|---------|
| `/login`, `/otp-verification` | Figma auth cards |
| `/live-video` | Timestamp overlay, clickable GPS |
| `/broadcasts` | 7 broadcast types incl. community warning |
| `/notifications` | 6 notification type samples + timestamps |
| `/tracking` | Verification status badges on incidents |
| `/smartwatch` | Mode cards, companion preview, SOS history |

---

## 3. New Screens Created

| App | Route | Purpose |
|-----|-------|---------|
| Admin | `/login/verify` | Email token verification (Figma `597:1081`) |
| Admin | `/login/forgot-password` | 3-step password reset |
| Admin | `/settings` | Account preferences |
| Admin | `/live-chats` | Citizen support threads |
| Admin | `/sailing-permit` | Maritime permits |
| Admin | `/job-vacancies` | Public recruitment |
| Admin | `/smartwatch/sos-history` | SOS event history table |
| Mobile | `/otp-verification` | OTP/token screen |

---

## 4. Reusable Components Created

| Component | Path | Used for |
|-----------|------|----------|
| `AuthLayout` | `components/auth-layout.tsx` | Figma admin auth shell |
| `VerificationStatusBadge` | `components/verification-ui.tsx` | Verified/Pending/Disputed/False Information |
| `DuplicateReportPanel` | `components/verification-ui.tsx` | Duplicate cluster detection |
| `WitnessConfirmationPanel` | `components/verification-ui.tsx` | Nearby witness confirmation |
| `EvidenceAccessLog` | `components/verification-ui.tsx` | Evidence access audit trail |
| `LocationTrailMap` | `components/location-trail-map.tsx` | GPS trail + live marker |
| `DashboardChart` | `components/dashboard-widgets.tsx` | Figma bar chart |
| `DashboardActivityFeeds` | `components/dashboard-widgets.tsx` | Live Video + Reports feeds |
| `AuditFilter` | `components/audit-filter.tsx` | Ledger filtering |
| `BroadcastCreateForm` | `components/broadcast-create-form.tsx` | Broadcast composer |
| `NotificationComposeForm` | `components/notification-compose-form.tsx` | Notification composer |
| `_ModeCard` | `main.dart` | Paired vs standalone mode |
| `SmartwatchCompanionPreview` | `main.dart` | 184×224 watch UI |

**Utilities:** `lib/verification.ts`, `lib/nav-access.ts`

---

## 5. Updated Routing / Navigation

### Mobile routes (31 + OTP)

All prior routes preserved. Added: `/otp-verification`

### Admin routes (39)

Added: `/login/verify`, `/login/forgot-password`, `/settings`, `/live-chats`, `/sailing-permit`, `/job-vacancies`, `/smartwatch/sos-history`

### Admin sidebar groups

Menu → Reports → Other Services → Chats → Neighborhood Watch → Smartwatch → Administration → Settings → Logout

Role-scoped via `lib/nav-access.ts` (Community Moderator, Oversight Auditor, Agency Admin, etc.)

---

## 6. Mobile Responsiveness

- Existing `SafetyScaffold` + responsive grids preserved
- Admin: `sm:` / `md:` / `lg:` / `xl:` breakpoints on all updated pages
- Auth cards: `max-w-[454px]` centered layout
- Tables: `overflow-x-auto` + `TableScrollHint` pattern

---

## 7. Admin Dashboard Layout

Figma-aligned structure retained:
- Dark command sidebar (`#032221`)
- White operational cards on field background (`#F1F7F6`)
- Green primary CTAs (`#009933`)
- Orange accent metrics (`#FF9933`)
- Montserrat typography

---

## 8. Build / Test Report

| Check | Result |
|-------|--------|
| `pnpm run lint` | Pass |
| TypeScript (`tsc --noEmit`) | Pass |
| `pnpm run build` | Pass — 39 admin routes |
| `pnpm run test:backend` | 88/88 pass |
| `pnpm run test:admin:smoke` | Pass |
| `pnpm run test:mobile:smoke` | Pass |

**Local run:**
- Admin: `pnpm run dev:admin` → http://localhost:3000
- API: `pnpm run dev:api` → http://localhost:4000
- Mobile: Flutter required for device run; smoke test validates routes

---

## Design Token Reference

| Token | Value | Usage |
|-------|-------|-------|
| `eye` / `BrandColors.green` | `#009933` | CTAs, success, nav active |
| `eyeOrange` / `BrandColors.orange` | `#FF9933` | Metrics, warnings |
| `command` | `#032221` | Sidebar, ink headings |
| `eyeDeep` | `#0B7E5D` | Auth background |
| `field` | `#F1F7F6` | Page background |
| `stroke` | `#AACBC4` | Input borders |
| Font | Montserrat | Admin + mobile |
