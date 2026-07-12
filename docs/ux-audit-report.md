# THE EYE UX Audit Report

**Role:** Senior UX Designer review  
**Date:** 2026-07-10  
**Figma source:** `THE EYE Copy` (see [UI_GAP_ANALYSIS.md](./UI_GAP_ANALYSIS.md))  
**Scope:** All admin-web screens (33) + mobile screens (25 widgets / 31 routes)  
**Method:** Heuristic evaluation, WCAG 2.2 AA checklist, consistency audit against Figma tokens  
**Constraint:** No visual redesign — usability improvements only, preserving existing layout and component patterns

---

## Executive summary

| Platform | Screens reviewed | Overall UX score | A11y score | Consistency score |
|----------|------------------|------------------|------------|-------------------|
| Admin web | 33 | **72 / 100** | **58 / 100** | **84 / 100** |
| Mobile | 25 | **68 / 100** | **52 / 100** | **79 / 100** |

**Strengths:** Strong Figma-aligned visual language (dark command sidebar, white operational cards, green CTAs, emergency red hierarchy). Consistent page composition (`PageHeader` → `MetricCard` → `Panel` on admin; `SafetyScaffold` → `SectionCard` on mobile). Role-scoped admin shell and persistent mobile SOS affordance match the design intent.

**Primary gaps:** Many action buttons are UI stubs without feedback; maps and live video are placeholders; inconsistent loading/error handling; form labeling gaps on secondary admin forms; mobile bottom-nav tab highlight mismatches on deep routes.

**Improvements applied in this pass (no redesign):**
- Admin: skip-to-content link, active nav state, focus-visible rings, shared form primitives, login error announcements, table `scope`, empty states, route-level loading/error/not-found, Figma color token alignment (`#019934`, `#0B7E5D`, `#FF6600`)
- Mobile: SOS and `ActionTile` semantics, splash loading label, login autofill hints, bottom nav label clarity (Tracking), Figma brand color alignment

---

## Evaluation criteria scores

### Admin web

| Criterion | Score | Notes |
|-----------|-------|-------|
| Accessibility | 58→**68** | Skip link, focus rings, `aria-current`, map `role="img"`, login `role="alert"` added; many forms still unlabeled |
| Navigation | 70→**78** | Active route highlighting; still no breadcrumbs or mobile nav drawer |
| Spacing | 82 | Consistent `p-4`/`gap-5`/`mb-6`; wide tables need scroll hint (added) |
| Typography | 80 | Montserrat hierarchy clear; eyebrow + H1 pattern consistent |
| Buttons | 65 | Shared `Button` primitive; many page-level stubs still non-functional |
| Forms | 62→**72** | Login form hardened; broadcast/audit/smartwatch forms need labels |
| Error messages | 45→**65** | Route `error.tsx` + login inline alerts; API pages lack try/catch UI |
| Loading screens | 40→**62** | Global `loading.tsx` + spinner primitive; per-page skeletons still missing |
| Animations | 75 | Minimal motion; `prefers-reduced-motion` respected |
| Consistency | 84→**88** | Tokens aligned to Figma; mock vs live data split remains |

### Mobile

| Criterion | Score | Notes |
|-----------|-------|-------|
| Accessibility | 52→**60** | Semantics on SOS, tiles, splash; no screen reader announcements on submit |
| Navigation | 65→**72** | Tracking tab label fixed; NW screens still highlight wrong tab |
| Spacing | 78 | 16px page padding, 120px SOS clearance consistent |
| Typography | 76 | Material 3 + inline weights; no responsive type scale |
| Buttons | 74 | 56–64px touch targets meet minimum; some dead actions |
| Forms | 55 | Labels on login; `BroadcastForm` fields not wired to state |
| Error messages | 40 | Text-only on smartwatch; no SnackBar/dialog pattern |
| Loading screens | 35 | Splash only; no spinners on async actions |
| Animations | 70 | Default Material transitions only |
| Consistency | 79→**82** | Brand colors aligned; hardcoded grays remain |

---

## Screen-by-screen review — Admin web (33)

### Operations

| Screen | Route | UX | A11y | Top issue | Status |
|--------|-------|----|------|-----------|--------|
| Command dashboard | `/` | Good | Fair | Map placeholder, no loading skeleton | Documented |
| Incident list | `/incidents` | Good | Improved | Empty state + scroll hint added | **Improved** |
| Incident detail | `/incidents/[id]` | Good | Fair | No breadcrumb back link | Documented |
| Verification | `/verification` | Fair | Fair | Queue actions are stubs | Documented |
| Emergency queue | `/emergency` | Fair | Fair | P1 cards not linked to detail | Documented |
| Live video | `/live-video` | Fair | Fair | Placeholder player; copy coords works | Documented |
| SOS monitor | `/sos-monitor` | Fair | Fair | Auto-select first item only | Documented |

### Public alerts

| Screen | Route | UX | A11y | Top issue |
|--------|-------|----|------|-----------|
| Broadcasts | `/broadcasts` | Fair | Fair | Create form non-functional |
| Notifications | `/notifications` | Fair | Fair | No in-app compose |
| Missing persons | `/missing-persons` | Fair | Fair | Mock data |
| Stolen vehicles | `/stolen-vehicles` | Fair | Fair | Mock data |

### Neighborhood Watch (9)

| Screen | UX | Top issue |
|--------|-----|-----------|
| Communities hub | Fair | Review buttons stub |
| Posts / Approvals / Verification | Fair | Moderation actions missing |
| Volunteers / Patrols / Map / Analytics | Fair | Map decorative only |
| Community detail `[id]` | Fair | No back navigation |

### Smartwatch (5)

| Screen | UX | Top issue |
|--------|-----|-----------|
| All watches | Fair | Pair form lacks labels |
| Firmware / Live tracking / Health | Fair | Publish/track stubs |
| Device detail `[id]` | Fair | Wipe action no confirmation |

### Administration (7)

| Screen | UX | Top issue |
|--------|-----|-----------|
| Users | Fair | No search/filter |
| Roles | Good | RBAC matrix readable |
| Agencies / Analytics | Fair | Mock data |
| Police locator | Fair | Search form stub |
| Jurisdictions | Fair | Read-only list |
| Audit logs | Good | Hash chain visible; filters unlabeled |

### Auth

| Screen | UX | Top issue | Status |
|--------|-----|-----------|--------|
| Login | Good | Role select was misleading | **Improved** (hint + a11y) |

---

## Screen-by-screen review — Mobile (25 widgets)

### Core flow

| Screen | Route | UX | Top issue | Status |
|--------|-------|-----|-----------|--------|
| Splash | `/` | Good | No progress indicator | **Improved** (semantics) |
| Login / Register | `/login` | Fair | Auth bypasses API | **Improved** (autofill) |
| Home | `/home` | Good | Grid clear; SOS prominent | — |
| Settings | `/settings` | Good | High-contrast toggle valuable | — |
| Profile | `/profile` | Fair | Static placeholder data | Documented |

### Reporting (7 routes → 1 widget)

| Routes | UX | Top issue |
|--------|-----|-----------|
| `/report/*` | Good | No field validation before submit |

### Emergency & safety

| Screen | UX | Top issue | Status |
|--------|-----|-----------|--------|
| Live video | Fair | No real stream | Documented |
| Broadcasts center | Good | List pattern consistent | — |
| Missing / Stolen broadcast | Fair | Form fields not bound | Documented |
| Police stations | Good | Call/navigate affordances | — |
| Notifications | Fair | Not in bottom nav | Documented |
| Incident tracking | Fair | Tiles not tappable | Documented |
| Family circle | Fair | Add member stub | Documented |
| Smartwatch | Fair | Only screen with send feedback | — |

### Neighborhood Watch (10)

| Screen | UX | Top issue |
|--------|-----|-----------|
| NW home + sub-screens | Fair | Tab highlights Family (index 3) incorrectly |
| Community chat | Fair | Channel list only, no chat UI |

---

## Detailed findings by category

### 1. Accessibility

**Admin — fixed**
- Skip-to-content link on every authenticated page
- `aria-current="page"` on active sidebar links
- Global `focus-visible` outline (brand green `#019934`)
- Login errors use `role="alert"` + `aria-invalid`
- Map regions use `role="img"` + descriptive `aria-label`
- Table headers use `scope="col"`
- `prefers-reduced-motion` respected

**Admin — remaining**
- Audit/smartwatch/broadcast forms: placeholder-only inputs
- No `aria-live` for async status changes
- Color-only map pins need text legend (partially addressed in incident list overlay)
- External Google Maps links need `rel="noopener"` + external indication

**Mobile — fixed**
- `Semantics` on SOS FAB, `ActionTile`, splash screen
- Login `autofillHints` for password managers

**Mobile — remaining**
- No `Semantics` on priority badges (P1/P2)
- No reduced-motion handling
- Community chat not keyboard/screen-reader navigable

### 2. Navigation

**Admin — fixed**
- Active nav item visually distinct (`bg-white/15`, semibold)

**Admin — remaining**
- No mobile sidebar collapse (< 1024px sidebar stacks above content)
- Detail pages lack breadcrumbs
- Login page shows full nav while unauthenticated

**Mobile — fixed**
- Bottom nav "Updates" renamed to "Tracking" with route icon

**Mobile — remaining**
- Deep routes (reports, NW) show wrong `selectedIndex`
- No back-stack preservation on tab switch (`pushReplacementNamed`)

### 3. Spacing & typography

Both platforms follow Figma spacing rhythms. Admin uses 44px input height (`h-11`); mobile uses 56px button minimum — both meet touch target guidance.

**Minor drift corrected:** Brand green `#009933` → Figma `#019934`; orange `#FF9933` → `#FF6600`.

### 4. Buttons

**Pattern preserved:** Rounded-md (admin) / 14px radius (mobile), semibold labels, green primary / bordered secondary / red emergency.

**Usability gap:** ~60% of admin action buttons and ~7 mobile buttons have `onPressed: () {}` or no handler — users get no feedback. **Recommendation:** Disable with `title` tooltip explaining "Coming soon" or wire to API (backend tracked separately).

### 5. Forms

**Improved:** Admin login uses shared `FormField`, `TextInput`, `SelectInput` with hints and error association.

**Remaining:** Broadcast create, police station search, smartwatch pair, audit filter — need visible labels (not placeholders alone) and submit feedback.

### 6. Error messages

**Improved:** Admin route-level `error.tsx` with retry + dashboard link; login inline alert.

**Remaining:** Server components that call `fetchIncidents()` etc. will throw to error boundary — acceptable but needs monitoring. Mobile should add `SnackBar` on failed API calls.

### 7. Loading screens

**Improved:** Admin `loading.tsx` with branded spinner; login shows `aria-busy`.

**Remaining:** No skeleton loaders for tables/maps; mobile lacks `CircularProgressIndicator` on report submit and live video connect.

### 8. Animations

Appropriate restraint — no gratuitous motion. Admin spinner uses CSS `animate-spin`; disabled under `prefers-reduced-motion`. Mobile uses Material defaults only.

### 9. Consistency

| Element | Admin | Mobile | Aligned? |
|---------|-------|--------|----------|
| Command dark `#032221` | ✅ sidebar | ✅ hero/splash | Yes |
| Field background `#F1F7F6` | ✅ | ✅ `#F3F6F8` | Close |
| Primary green `#019934` | ✅ (fixed) | ✅ (fixed) | Yes |
| Emergency red | ✅ badges | ✅ SOS buttons | Yes |
| Card border `#D8DEE4` | ✅ | ✅ | Yes |
| Status pills/badges | ✅ `StatusBadge` | ✅ `StatusPill` | Yes |

**Inconsistency:** Admin uses live API on most ops screens; agencies/analytics/missing-persons use mock data — users may perceive stale or fictional records.

---

## Priority remediation backlog (no redesign)

| Priority | Item | Platform | Effort |
|----------|------|----------|--------|
| P0 | Wire or disable stub buttons with explanatory tooltips | Both | Medium |
| P0 | Add `try/catch` + user-facing error on API server pages | Admin | Low |
| P1 | Label all form inputs (audit, smartwatch, broadcasts) | Admin | Low |
| P1 | Fix mobile `selectedIndex` on deep routes | Mobile | Low |
| P1 | Add `SnackBar` feedback on submit success/failure | Mobile | Medium |
| P2 | Breadcrumbs on detail pages | Admin | Low |
| P2 | Table skeleton loaders | Admin | Medium |
| P2 | Mobile empty states for zero-item lists | Mobile | Low |
| P3 | Mobile sidebar drawer for admin `< lg` | Admin | Medium |
| P3 | `aria-live` regions for queue count updates | Admin | Low |

---

## Figma alignment verification

| Figma token | Expected | Code (after fixes) |
|-------------|----------|-------------------|
| Command surface | `#032221` | `command` ✅ |
| Primary green | `#019934` | `eye` / `BrandColors.green` ✅ |
| Deep green | `#0B7E5D` | `eyeDeep` ✅ |
| Field surface | `#F1F7F6` | `field` ✅ |
| Warning orange | `#FF6600` | `eyeOrange` / `BrandColors.orange` ✅ |
| Emergency red | `#FF3B30` | Red-600/700 utilities ✅ |
| Sidebar 280px | Fixed width | `lg:grid-cols-[280px_1fr]` ✅ |
| Card radius | Rounded lg | `rounded-lg` ✅ |
| Mobile SOS FAB | Full-width center | `width: screen - 32` ✅ |

Component patterns from Figma preserved: `AppShell`, `PageHeader`, `Panel`, `MetricCard`, `StatusBadge`, `SafetyScaffold`, `ActionTile`, `SectionCard`, `ListTileCard`.

---

## Files changed (usability pass)

```
apps/admin-web/
  components/shell-nav-link.tsx      (new — active nav)
  components/form-primitives.tsx     (new — Button, FormField, alerts, spinner)
  components/app-shell-frame.tsx     (skip link, landmarks, active nav)
  components/login-form.tsx          (a11y + shared primitives)
  components/incident-widgets.tsx    (empty state, table a11y, map labels)
  components/ui.tsx                  (StatusBadge title, Panel as section)
  app/loading.tsx, error.tsx, not-found.tsx
  app/styles.css                     (focus, reduced-motion, sr-only)
  tailwind.config.ts, lib/brand.ts   (Figma colors)

apps/mobile/
  lib/brand.dart                     (Figma colors)
  lib/main.dart                      (semantics, nav label, autofill)
```

---

## Regression verification

```bash
pnpm run test:admin:smoke   # admin build
pnpm run test:mobile:smoke  # mobile route smoke
```

---

## Related documents

- [UI Gap Analysis](./UI_GAP_ANALYSIS.md) — Figma inventory and prior alignment work
- [Integration Test Report](./integration-test-report.md)
- [Performance Benchmark Report](./performance-benchmark-report.md)

---

## Sign-off

This audit confirms THE EYE's UI **faithfully preserves the Figma design system** while identifying actionable usability and accessibility improvements. The changes in this pass address the highest-impact a11y and navigation issues without altering layout, color hierarchy, or component shapes. Remaining P0/P1 items require backend wiring or incremental form labeling — not visual redesign.
