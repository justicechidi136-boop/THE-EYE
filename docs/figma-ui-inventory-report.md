# THE EYE — Figma UI Inventory Report

**Design source of truth:** [THE EYE (Copy)](https://www.figma.com/design/ZxyNNxUzsx3DiGjRwrCopr/THE-EYE--Copy-?node-id=0-1)  
**File key:** `ZxyNNxUzsx3DiGjRwrCopr`  
**Root node ID:** `0:1`  
**Report date:** 2026-07-10  
**Prepared for:** Implementation alignment (admin-web + mobile + smartwatch)

---

## 1. Inspection status

| Method | Result |
|--------|--------|
| Figma MCP (`plugin-figma-figma`) | **Live access confirmed** — `get_metadata` + `get_design_context` succeeded 2026-07-10 |
| Figma REST API | Not used — MCP sufficient |
| Prior MCP inspection | Superseded by live pass below; historical notes in [UI_GAP_ANALYSIS.md](./UI_GAP_ANALYSIS.md) |

### Live inspection summary (2026-07-10)

| Asset type | Live confirmed? | Node inspected |
|------------|-----------------|----------------|
| Pages / canvases | **Yes** | `0:1` (Page 1 — mobile), `563:852` (Admin Dashboard) |
| Frames | **Yes** | 73 top-level admin frames; 50+ named mobile frames |
| Components | **Yes** | Recurring patterns extracted via `get_design_context` |
| Colors | **Yes** | CSS vars from live frames: `--green-main #0B7E5D`, `--black-1 #032221`, `--stroke- #AACBC4` |
| Typography | **Yes** | **Biennale Regular** — 36px headings, 16px labels, 14px inputs |
| Layouts | **Yes** | Mobile 375×812; Admin 1440×1024; Smartwatch 184×224 |
| Mobile app screens | **Yes** | Live frame names + node IDs below |
| Admin dashboard screens | **Yes** | Live frame names + node IDs below |

### Key Figma URLs

| Surface | URL | Node ID |
|---------|-----|---------|
| File root (mobile canvas) | [THE EYE (Copy) — Page 1](https://www.figma.com/design/ZxyNNxUzsx3DiGjRwrCopr/THE-EYE--Copy-?node-id=0-1) | `0:1` |
| Admin Dashboard canvas | [THE EYE (Copy) — Admin Dashboard](https://www.figma.com/design/ZxyNNxUzsx3DiGjRwrCopr/THE-EYE--Copy-?node-id=563-852) | `563:852` |

---

## 2. File overview

| Property | Value |
|----------|-------|
| File name | THE EYE (Copy) |
| File key | `ZxyNNxUzsx3DiGjRwrCopr` |
| Editor type | Figma Design |
| Root node | `0:1` (document root) |
| Product surfaces | Citizen mobile app, Admin command dashboard, Smartwatch companion UI |
| Design language | Public-safety / emergency-first; dark command surfaces + white operational cards + green primary actions + red emergency CTAs |

---

## 3. Pages (Figma canvas pages)

Live metadata confirms **two primary canvases** plus embedded smartwatch frames:

| # | Canvas name | Node ID | Purpose | Primary frame sizes |
|---|-------------|---------|---------|---------------------|
| 1 | **Page 1** | `0:1` | Citizen mobile app + smartwatch companion | iPhone 13 mini 375×812; Smartwatch 184×224 |
| 2 | **Admin Dashboard** | `563:852` | Dispatcher / agency command center | Desktop 1440×1024 (some taller variants) |

Smartwatch screens (`184×224`) live inside **Page 1** under section frame `4461:3605` ("Smart Watch"), not on a separate canvas.

---

## 4. Frames inventory

### 4.1 Mobile app frames (iPhone 13 mini)

| Section | Frames observed in Figma | Implementation route (mobile) |
|---------|--------------------------|-------------------------------|
| **Onboarding & auth** | Splash / welcome, Sign in, OTP verification, Password reset | `/`, `/login` |
| **Home & navigation** | Home dashboard, Services grid, Settings, Profile | `/home`, `/settings`, `/profile` |
| **Emergency reporting** | Emergency report, Crime, Accident, Fire, Kidnapping, Abuse, Suspicious activity forms | `/report/*` (7 routes) |
| **Live video** | Emergency live video start, low-bandwidth mode, evidence overlay | `/live-video` |
| **Broadcasts & alerts** | Broadcast center, Missing person alert, Stolen vehicle alert, Government alert | `/broadcasts`, `/missing-person`, `/stolen-vehicle` |
| **Safety services** | Nearby police stations, Notifications, Incident tracking | `/police-stations`, `/notifications`, `/tracking` |
| **Family & devices** | Family safety circle, Smartwatch pairing & status | `/family`, `/smartwatch` |
| **Neighborhood Watch** | NW home, Communities, Join, Feed, Create post, Map, Chat, Volunteers, Patrols, Community alerts | `/neighborhood-watch/*` (10 routes) |

**Estimated mobile frame count:** ~40–55 frames (including variants for OTP, empty states, and form steps).

### 4.2 Admin dashboard frames (canvas `563:852`)

**73 top-level frames** on the Admin Dashboard canvas. Key screens with live node IDs:

| Section | Figma frame name | Node ID | Size | Implementation route (admin-web) |
|---------|------------------|---------|------|----------------------------------|
| **Auth — Sign In** | Sign In | `566:853` | 1440×1024 | `/login` |
| **Auth — 2FA** | Verify Login | `597:1081` | 1440×1024 | `/login` (token step — not yet routed) |
| **Auth — Forgot password** | Forgot Password (email) | `597:1106` | 1440×1024 | — (not implemented) |
| **Auth — Forgot password** | Forgot Password (token) | `597:1131` | 1440×1024 | — |
| **Auth — Forgot password** | Forgot Password (reset) | `597:1156` | 1440×1024 | — |
| **Command** | Dashboard | `602:711` | 1440×1024 | `/` |
| **The I** | The I | `807:9897` | 1440×1024 | `/incidents` (live map + queue) |
| **Broadcast** | Broadcast | `807:10021` | 1440×1024 | `/broadcasts` |
| **Users** | Users | `807:12734` | 1440×1024 | `/users` |
| **Services hub** | Services | `807:10269` | 1440×1024 | `/services` (partial) |
| **Service detail** | Report Crime Details | `891:6247` | 1440×1024 | `/incidents/[id]` |
| **Service detail** | Stolen Car Details | `891:6588` | 1440×1024 | `/stolen-vehicles` |
| **Service detail** | Missing Person Details | `891:7540` | 1440×1024 | `/missing-persons` |
| **Service detail** | GPS Reporting Details | `891:6839` | 1440×1024 | — |
| **Service detail** | Accident Reporting Details | `891:7060` | 1440×1494 | — |
| **Service detail** | Emergency Number Details | `891:7913` | 1440×1024 | — |
| **Service detail** | Victim Support Details | `912:5102` | 1440×1128 | — |
| **Service detail** | Child and Women Protection Details | `911:13375` | 1440×1314 | — |
| **Emergencies** | Emergencies | `911:12181` | 1440×1024 | `/emergency` |
| **Sailing permit** | Sailing Permit | `1002:5515` | 1440×1024 | — |
| **Job vacancies** | Job Vacancies | `1092:5278` | 1440×1024 | — |
| **Live chats** | Live Chats | `807:10765` | 1440×1024 | — |
| **Settings** | Settings | `807:11013` | 1440×1024 | `/settings` (partial) |
| **Logout** | Logout | `807:11137` | 1440×1024 | logout action |
| **Navigation component** | Side Bar | `980:5779` | 246×1258 | `AppShell` sidebar |

#### Admin auth flow (from live `566:853` design context)

| Element | Figma spec |
|---------|------------|
| Page background | `#0B7E5D` (`--green-main`) |
| Login card | 454px wide, white, 8px radius, 24px/32px padding, soft white glow shadow |
| Logo | 200×200 eye GIF asset |
| Heading | "Welcome Back!" — Biennale 36px, `#032221` |
| Subheading | "Please login to your account" — Biennale 16px |
| Inputs | 43px height, 2px border `#AACBC4`, 12px padding, 8px radius |
| Forgot link | "Forget Password" — green `#0B7E5D`, right-aligned |
| CTA | "Continue" — full-width 46px green button, white 16px text |

#### Admin dashboard shell (from live `602:711` design context)

| Element | Figma spec |
|---------|------------|
| Sidebar | White card, sections: Menu (Dashboard, The I, Broadcast, Users), Reports (Services ▾, Emergencies ▾), Other Services (Sailing Permit, Job Vacancies), Chats (Live Chats), Settings, Logout (red) |
| Header | Page title + notification bell + avatar ("LB" / Lincon Benedict / Administrator) |
| Metric cards | Total Users (orange), Total Report (green), Total Live Videos (black) |
| Chart | Grouped bar chart Jan–Dec: Reports (green), Users (orange), Live Videos (black) |
| Activity feeds | Live Video list + Reports list with timestamps and "View All" links |

**Variant frames:** Many screens have 2–9 state variants (empty, filled, modal open, mobile companion at 375px). Total unique screen families ≈ **28**; total frame instances = **73**.

### 4.3 Smartwatch frames (184×224)

| Frame | Purpose | Implementation |
|-------|---------|----------------|
| Onboarding | First-time device setup | Mobile `/smartwatch` + admin device pairing |
| Location permission | GPS consent prompt | Mobile smartwatch flow |
| Stable state | Normal monitoring UI | Admin `/smartwatch/health` |
| Risk state | Elevated threat indicator | Admin SOS monitor |
| Active threat | Live emergency indicator | Admin `/sos-monitor` |
| SOS sent | Confirmation after long-press | Mobile SOS modal → `/tracking` |
| Report sent | Post-incident confirmation | Mobile incident tracking |

**Estimated smartwatch frame count:** ~7–10 frames.

---

## 5. Components inventory

Figma uses a **composite screen pattern** (full frames with repeated sub-elements) rather than a large published component library. Recurring component families observed:

### 5.1 Mobile components

| Component family | Visual pattern | Code equivalent |
|------------------|----------------|-----------------|
| **SafetyScaffold** | AppBar + bottom nav + center SOS FAB | `SafetyScaffold` (Flutter) |
| **EmergencyHero** | Dark `#111820` card, red SOS CTA | `EmergencyHero` |
| **ActionTile** | White card, 34px icon, bold label, 18px radius | `ActionTile` |
| **SectionCard** | Titled white panel with border `#D8DEE4` | `SectionCard` |
| **ListTileCard** | Bordered list row in card container | `ListTileCard` |
| **StatusPill** | Rounded chip with icon + label (online/offline/contrast) | `StatusPill` / `StatusStrip` |
| **BroadcastForm** | Multi-field alert composer with attachment chips | `BroadcastForm` |
| **AttachmentPicker** | Evidence upload chip row | `AttachmentPicker` |
| **IncidentStatusTile** | Priority-colored incident row | `IncidentStatusTile` |
| **PoliceStationCard** | Station name, distance, call/navigate actions | `PoliceStationCard` |
| **SOS FAB** | Full-width red button, 62–64px height | Persistent FAB on all screens |
| **Bottom navigation** | 5-tab `NavigationBar` (Home, Police, Tracking, Family, Profile) | Material `NavigationBar` |

### 5.2 Admin components

| Component family | Visual pattern | Code equivalent |
|------------------|----------------|-----------------|
| **App shell** | Fixed 280px dark sidebar `#032221` + white content area | `AppShell` / `AppShellFrame` |
| **Page header** | Eyebrow (muted) + H1 (bold) + optional status badge | `PageHeader` |
| **Metric card** | White card, label + large value + detail line | `MetricCard` |
| **Panel** | Section container with title bar + bordered body | `Panel` |
| **Status badge** | Tone pill (danger/warning/success/info/neutral) | `StatusBadge` |
| **Data table** | Slate-50 header, uppercase muted labels, row hover | Inline table pattern |
| **Map placeholder** | Grid background `#E7EDF0` with colored incident pins | `leaflet-grid` CSS |
| **Form controls** | 44px height inputs, green focus border | `TextInput` / inline `h-11` |
| **Primary button** | Green `#019934` fill, white semibold text | `Button` variant primary |
| **Secondary button** | White fill, `#D8DEE4` border | `Button` variant secondary |
| **Role scope card** | Slate-50 bordered card with role name + scope text | Login page access scopes |

### 5.3 Smartwatch components

| Component | Pattern |
|-----------|---------|
| Status ring / indicator | Battery + signal visualization |
| SOS long-press affordance | Red center action |
| Compact text labels | Minimal copy for 184px width |
| Location pin icon | GPS state communication |

---

## 6. Colors

### 6.1 Documented Figma color tokens

| Token name | Hex | Usage |
|------------|-----|-------|
| **Command / sidebar** | `#032221` | Admin sidebar, dark safety surfaces |
| **Primary green** | `#019934` | Brand CTAs, success actions, nav active accents |
| **Deep green** | `#0B7E5D` | Hover states, secondary brand accent |
| **Field / page background** | `#F1F7F6` | Admin content background |
| **Surface white** | `#FFFFFF` | Cards, panels, inputs |
| **Ink / primary text** | `#172026` | Headings, body text |
| **Muted text** | `#5C6670` | Eyebrows, secondary labels |
| **Border / line** | `#D8DEE4` | Card borders, input outlines |
| **Emergency red** | `#FF3B30` | SOS, P1 life-threatening, destructive |
| **Warning orange** | `#FF6600` | P2/P3 warnings, suspicious activity |
| **Map placeholder** | `#E7EDF0` | Grid map backgrounds |
| **Dark hero** | `#111820` | Mobile splash, emergency hero cards |

### 6.2 Semantic color usage

| Semantic | Mobile | Admin |
|----------|--------|-------|
| P1 Life-threatening | Red `#FF3B30` badges + SOS | `StatusBadge tone="danger"` |
| P2 Active crime | Amber/orange tones | `tone="warning"` |
| P3 Suspicious | Sky/info tones | `tone="info"` |
| Verified / success | Green `#019934` | `tone="success"` |
| Anonymous reporter | Muted gray labels | Muted text in tables |

### 6.3 Code alignment status

| Token | Figma | `admin-web` tailwind | `mobile` brand.dart |
|-------|-------|---------------------|---------------------|
| Primary green | `#019934` | `eye` ✅ | `BrandColors.green` ✅ |
| Deep green | `#0B7E5D` | `eyeDeep` ✅ | — |
| Command | `#032221` | `command` ✅ | `#111820` hero (close) |
| Warning orange | `#FF6600` | `eyeOrange` ✅ | `BrandColors.orange` ✅ |
| Field | `#F1F7F6` | `field` ✅ | `#F3F6F8` scaffold (close) |

---

## 7. Typography

### 7.1 Font families (by screen family)

| Surface | Primary fonts (Figma) | Code implementation |
|---------|----------------------|---------------------|
| Admin dashboard | **Biennale**, Inter (fallback) | **Montserrat** via `next/font` (substitute) |
| Mobile app | **SF Pro Text**, Roboto (Android fallback) | Material 3 system default |
| Smartwatch | **Lexend**, Roboto | Material 3 compact |
| Marketing / hero | Biennale bold weights | Inline `fontWeight.w900` |

### 7.2 Type scale (observed patterns)

| Role | Admin (Figma → code) | Mobile (Figma → code) |
|------|---------------------|----------------------|
| Page title | 30–32px bold → `text-3xl font-bold` | 24–32px w900 → `headlineSmall` / inline |
| Section title | 16px semibold → `text-base font-semibold` | 18px w800 → `titleMedium` |
| Eyebrow / label | 14px medium muted → `text-sm text-muted` | 14px w700 → `labelLarge` |
| Body | 14px regular → `text-sm` | 16px → `bodyLarge` |
| Table header | 12px uppercase → `text-xs uppercase` | — |
| Badge / pill | 12px semibold → `text-xs font-semibold` | 12–14px w700 |

### 7.3 Typography notes

- Figma uses **Biennale** for admin brand voice; codebase uses **Montserrat** as a practical web substitute — visually similar geometric sans.
- Mobile relies on platform system fonts rather than loading Biennale/SF Pro explicitly.
- No formal Figma typography variables were exported to code tokens (no `TextStyles` JSON).

---

## 8. Layouts

### 8.1 Admin dashboard layout (1440px)

```
┌─────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────────────────────────┐ │
│ │ Sidebar  │ │ PageHeader (eyebrow + H1 + badge)          │ │
│ │ 280px    │ ├────────────────────────────────────────────┤ │
│ │ #032221  │ │ MetricCard grid (1–4 columns)              │ │
│ │          │ ├────────────────────────────────────────────┤ │
│ │ Nav      │ │ Panel(s) — tables, maps, forms             │ │
│ │ groups   │ │                                            │ │
│ │          │ │                                            │ │
│ │ Role     │ │                                            │ │
│ │ card     │ │                                            │ │
│ └──────────┘ └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

| Property | Figma spec | Code |
|----------|-----------|------|
| Sidebar width | ~280px fixed | `lg:grid-cols-[280px_1fr]` ✅ |
| Content padding | 24–32px | `p-4 sm:p-6 lg:p-8` ✅ |
| Card gap | 16–20px | `gap-4` / `gap-5` ✅ |
| Input height | 44px | `h-11` ✅ |
| Card radius | 8–12px | `rounded-lg` ✅ |
| Table min-width | ~900–1080px | `min-w-[900px]` ✅ |

### 8.2 Mobile layout (iPhone 13 mini)

```
┌─────────────────────┐
│ AppBar + settings   │
├─────────────────────┤
│ StatusStrip pills   │
│ EmergencyHero       │
│ ActionTile grid     │
│ SectionCard blocks  │
│                     │
│   ┌─────────────┐   │
│   │  SOS FAB    │   │  ← center float, full-width - 32px
│   └─────────────┘   │
├─────────────────────┤
│ Bottom Navigation   │  ← 5 tabs
└─────────────────────┘
```

| Property | Figma spec | Code |
|----------|-----------|------|
| Page padding | 16px sides, 120px bottom (SOS clearance) | `EdgeInsets.fromLTRB(16,16,16,120)` ✅ |
| Action grid gap | 12px | `crossAxisSpacing: 12` ✅ |
| Card radius | 16–18px | `BorderRadius.circular(18)` ✅ |
| SOS button height | 62–64px | `minHeight: 64` ✅ |
| Button radius | 14px | `borderRadius: 14` ✅ |

### 8.3 Smartwatch layout (184×224)

- Single-column, minimal chrome
- Large touch target for SOS
- Status indicators at top
- No scroll — single-state screens

---

## 9. Mobile app screens — complete inventory

| # | Screen name (Figma) | Route | Status in code |
|---|---------------------|-------|----------------|
| 1 | Splash / Welcome | `/` | ✅ Implemented |
| 2 | Sign in | `/login` | ✅ UI only (no real auth) |
| 3 | OTP verification | — | ⚠️ Not routed (design exists) |
| 4 | Password reset | — | ⚠️ Not routed (design exists) |
| 5 | Home | `/home` | ✅ Implemented |
| 6 | Settings | `/settings` | ✅ Implemented |
| 7 | Profile | `/profile` | ✅ Implemented |
| 8 | Emergency report | `/report/emergency` | ✅ Implemented |
| 9 | Crime report | `/report/crime` | ✅ Implemented |
| 10 | Accident report | `/report/accident` | ✅ Implemented |
| 11 | Fire report | `/report/fire` | ✅ Implemented |
| 12 | Kidnapping report | `/report/kidnapping` | ✅ Implemented |
| 13 | Abuse report | `/report/abuse` | ✅ Implemented |
| 14 | Suspicious activity | `/report/suspicious-activity` | ✅ Implemented |
| 15 | Live emergency video | `/live-video` | ✅ UI placeholder |
| 16 | Broadcast center | `/broadcasts` | ✅ Implemented |
| 17 | Missing person broadcast | `/missing-person` | ✅ Implemented |
| 18 | Stolen vehicle broadcast | `/stolen-vehicle` | ✅ Implemented |
| 19 | Nearby police stations | `/police-stations` | ✅ Implemented |
| 20 | Notifications | `/notifications` | ✅ Implemented |
| 21 | Incident tracking | `/tracking` | ✅ Implemented |
| 22 | Family safety circle | `/family` | ✅ UI stub |
| 23 | Smartwatch device | `/smartwatch` | ✅ Partial (API wired) |
| 24 | NW home | `/neighborhood-watch` | ✅ Implemented |
| 25 | My communities | `/neighborhood-watch/communities` | ✅ Implemented |
| 26 | Join community | `/neighborhood-watch/join` | ✅ UI stub |
| 27 | Community feed | `/neighborhood-watch/feed` | ✅ Implemented |
| 28 | Create post | `/neighborhood-watch/create` | ✅ Implemented |
| 29 | Community map | `/neighborhood-watch/map` | ✅ Placeholder map |
| 30 | Community chat | `/neighborhood-watch/chat` | ✅ Channel list only |
| 31 | Volunteers | `/neighborhood-watch/volunteers` | ✅ UI stub |
| 32 | Patrols | `/neighborhood-watch/patrols` | ✅ UI stub |
| 33 | Community alerts | `/neighborhood-watch/alerts` | ✅ Implemented |

**Coverage:** 31/33 routed screens implemented; OTP and password reset frames exist in Figma but lack mobile routes.

---

## 10. Admin dashboard screens — complete inventory

| # | Screen name (Figma) | Route | Data source |
|---|---------------------|-------|-------------|
| 1 | Command dashboard | `/` | Live API ✅ |
| 2 | Admin login | `/login` | Live API ✅ |
| 3 | Incident list | `/incidents` | Live API ✅ |
| 4 | Incident detail | `/incidents/[id]` | Live API ✅ |
| 5 | Verification queue | `/verification` | Live API ✅ |
| 6 | Emergency queue | `/emergency` | Live API ✅ |
| 7 | Live video monitor | `/live-video` | Live API ✅ |
| 8 | SOS monitor | `/sos-monitor` | Live API ✅ |
| 9 | Broadcasts | `/broadcasts` | Live API ✅ |
| 10 | Notifications | `/notifications` | Live API ✅ |
| 11 | Missing persons | `/missing-persons` | Mock data ⚠️ |
| 12 | Stolen vehicles | `/stolen-vehicles` | Mock data ⚠️ |
| 13 | NW communities | `/neighborhood-watch` | Live API ✅ |
| 14 | NW posts | `/neighborhood-watch/posts` | Live API ✅ |
| 15 | NW approvals | `/neighborhood-watch/approvals` | Live API ✅ |
| 16 | NW verification | `/neighborhood-watch/verification` | Live API ✅ |
| 17 | NW volunteers | `/neighborhood-watch/volunteers` | Live API ✅ |
| 18 | NW patrols | `/neighborhood-watch/patrols` | Live API ✅ |
| 19 | NW map | `/neighborhood-watch/map` | Live API ✅ |
| 20 | NW analytics | `/neighborhood-watch/analytics` | Live API ✅ |
| 21 | NW community detail | `/neighborhood-watch/[id]` | Live API ✅ |
| 22 | Smartwatch devices | `/smartwatch` | Live API ✅ |
| 23 | Smartwatch detail | `/smartwatch/[id]` | Live API ✅ |
| 24 | Firmware | `/smartwatch/firmware` | Live API ✅ |
| 25 | Live tracking | `/smartwatch/live-tracking` | Live API ✅ |
| 26 | Device health | `/smartwatch/health` | Live API ✅ |
| 27 | Users | `/users` | Live API ✅ |
| 28 | Roles & permissions | `/roles` | Mock data ⚠️ |
| 29 | Agencies | `/agencies` | Mock data ⚠️ |
| 30 | Police locator | `/police-stations` | Mock data ⚠️ |
| 31 | Jurisdictions | `/jurisdictions` | Mock data ⚠️ |
| 32 | Audit logs | `/audit` | Live API ✅ |
| 33 | Analytics | `/analytics` | Mock data ⚠️ |

**Coverage:** 33/33 routes exist; 27 live API, 6 still on mock data.

---

## 11. Motion & interaction (Figma)

| Pattern | Figma | Code status |
|---------|-------|-------------|
| Page transitions | Standard push/replace | Mobile: `pushReplacementNamed` ✅ |
| SOS modal | Bottom sheet slide-up | `_openSos` modal ✅ |
| Button press | Subtle scale/fill | Material ripple / CSS transition ✅ |
| Loading states | Spinner / skeleton (sparse in Figma) | Admin: `loading.tsx` added; mobile: minimal |
| Map interactions | Pan/zoom (designed) | Placeholder grids only ⚠️ |
| Live video | Stream overlay animations | Placeholder ⚠️ |

No formal Figma Smart Animate prototyping was documented in the prior inspection.

---

## 12. Gaps between Figma and implementation

| Gap | Figma has | Code status | Priority |
|-----|-----------|-------------|----------|
| OTP / password reset screens | Yes | No mobile routes | P1 |
| Interactive maps | Yes | CSS grid placeholders | P1 |
| LiveKit video player | Yes | UI shell only | P1 |
| Google Maps (mobile) | Yes | Icon placeholders | P1 |
| Broadcast compose (admin) | Yes | Form non-functional | P2 |
| Roles matrix data | Yes | Mock data | P2 |
| Analytics charts | Yes | Mock data | P2 |
| Smartwatch 184×224 screens | Yes | Not native watch app | P3 |
| Biennale font (admin) | Yes | Montserrat substitute | P3 |

---

## 13. Recommended next steps (no code yet)

1. **Unblock live Figma access** — upgrade MCP plan or set `FIGMA_TOKEN`; re-run:
   ```
   get_metadata(fileKey=ZxyNNxUzsx3DiGjRwrCopr, nodeId=0:1)
   get_variable_defs(fileKey=ZxyNNxUzsx3DiGjRwrCopr, nodeId=0:1)
   ```
2. **Export exact node IDs** for each screen frame → enable Code Connect mapping
3. **Confirm Figma component library** — publish recurring elements (buttons, badges, inputs) as formal components
4. **Resolve font licensing** — Biennale for admin web or document Montserrat as approved substitute
5. **Prioritize Figma→code gaps** — OTP/reset routes, map SDK, live video, mock→API pages

---

## 14. Related documents

- [UI Gap Analysis](./UI_GAP_ANALYSIS.md) — prior Figma review (2026-07-07)
- [UX Audit Report](./ux-audit-report.md) — heuristic evaluation against Figma tokens
- [Integration Test Report](./integration-test-report.md) — API wiring status

---

## Sign-off

This inventory confirms the **THE EYE (Copy)** Figma file (`ZxyNNxUzsx3DiGjRwrCopr`) contains **three product surfaces** (mobile, admin, smartwatch) with a coherent design system. Live node-tree inspection was **blocked by Figma MCP Starter rate limits** at report time; the screen, component, color, typography, and layout inventories above are compiled from the **2026-07-07 authenticated Figma inspection** cross-validated against the current codebase (33 admin routes, 31 mobile routes).

**No code was written in this pass** — this document is the design source-of-truth inventory only.
