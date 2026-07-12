# THE EYE Brand & Dark Theme Update Report

Date: 2026-07-10

## Summary

Official THE EYE logo assets were deployed across admin web, mobile, and shared public brand paths. A centralized theme system now defaults to **Dark Mode** while preserving Light Mode and system preference support with persisted user settings.

## Brand Assets Deployed

| Asset | Paths |
| --- | --- |
| Logo lockup (dark bg) | `public/brand/`, `apps/admin-web/public/brand/`, `apps/mobile/assets/images/brand/` |
| Logomark (transparent) | Same roots |
| App icon (dark green) | Same roots + admin favicon metadata |
| App icon (white) | Same roots + `apple-touch-icon.png` |

**Note:** Icon sizes reuse the official source asset with preserved aspect ratio. A dedicated logomark crop generator was not added to avoid redesigning the lockup artwork.

## Theme System

### Admin Dashboard (`apps/admin-web`)

- **Tokens:** `lib/theme/tokens.ts`
- **CSS variables:** `app/styles.css` (`data-theme="dark"` default)
- **Tailwind mapping:** `tailwind.config.ts` (`surface`, `ink`, `eye`, etc.)
- **Provider:** `components/theme-provider.tsx` (dark default, localStorage `the-eye-theme`, system listener)
- **Settings UI:** `components/theme-settings-panel.tsx` on `/settings`

### Mobile App (`apps/mobile`)

- **Tokens:** `lib/brand.dart`
- **Theme helpers:** `lib/theme/the_eye_theme.dart`
- **Persistence:** `lib/theme/theme_preferences.dart` (`the_eye_theme_preference`, dark default)
- **Material themes:** `buildTheme()` / `buildDarkTheme()` in `lib/main.dart`
- **Settings UI:** Appearance section on Settings screen (dark / light / system)

## Default Theme

| Surface | Default |
| --- | --- |
| Admin Dashboard | Dark |
| Mobile App | Dark |
| Public brand static files | Dark palette documented in `public/brand/README.md` |

Light mode remains available via Settings on both clients.

## Screens & Surfaces Updated

### Admin Dashboard — Authentication

| Screen | Logo | Theme |
| --- | --- | --- |
| Login (`/login`) | Lockup in `AuthLayout` | Dark default, token surfaces |
| OTP verify (`/login/verify`) | Lockup in `AuthLayout` | Dark default |
| Forgot password (`/login/forgot-password`) | Lockup in `AuthLayout` | Dark default |

### Admin Dashboard — Shell & Navigation

| Screen | Logo | Theme |
| --- | --- | --- |
| Sidebar (`AppShellFrame`) | Lockup | Command green sidebar tokens |
| Skip link / header frame | — | `bg-field`, `bg-surface` |
| Settings (`/settings`) | — | Theme picker panel |

### Admin Dashboard — Operations (all `AppShell` pages)

| Screen | Theme tokens applied |
| --- | --- |
| Dashboard `/` | Panel, cards, tables |
| Incidents `/incidents`, `/incidents/[id]` | Status badges, overlays |
| Broadcasts `/broadcasts` | Cards, tables |
| Users `/users` | Tables, forms |
| Emergencies `/emergency` | Incident widgets |
| Verification `/verification` | Review panels |
| Live Video `/live-video` | Player chrome, overlays |
| SOS Monitor `/sos-monitor` | Monitor cards |
| Missing Persons `/missing-persons` | Broadcast cards |
| Stolen Vehicles `/stolen-vehicles` | Broadcast cards |
| Sailing Permit `/sailing-permit` | Forms |
| Job Vacancies `/job-vacancies` | Tables |
| Live Chats `/live-chats` | Chat panels |
| Roles `/roles` | Admin tables |
| Agencies `/agencies` | Admin tables |
| Police Locator `/police-stations` | Map/list |
| Jurisdictions `/jurisdictions` | Admin tables |
| Audit `/audit` | Log tables |
| Analytics `/analytics` | Charts containers |
| Notifications `/notifications` | Alert lists |

### Admin Dashboard — Neighborhood Watch

| Screen | Notes |
| --- | --- |
| Communities `/neighborhood-watch` | Token surfaces |
| Community detail `/neighborhood-watch/[id]` | Role chips, post cards |
| Posts `/neighborhood-watch/posts` | Feed cards |
| Approvals `/neighborhood-watch/approvals` | Review tables |
| Verification `/neighborhood-watch/verification` | Queue panels |
| Volunteers `/neighborhood-watch/volunteers` | Roster tables |
| Patrols `/neighborhood-watch/patrols` | Schedule cards |
| Map `/neighborhood-watch/map` | Map overlay `bg-surface/95` |
| Analytics `/neighborhood-watch/analytics` | Chart panels |

### Admin Dashboard — Smartwatch

| Screen | Notes |
| --- | --- |
| All Watches `/smartwatch` | Battery track `bg-surfaceMuted` |
| Device detail `/smartwatch/[id]` | Health cards |
| SOS History `/smartwatch/sos-history` | Timeline |
| Live Tracking `/smartwatch/live-tracking` | Map overlay tokens |
| Firmware `/smartwatch/firmware` | OTA tables |
| Device Health `/smartwatch/health` | Metrics |

### Admin Dashboard — Shared Components

| Component | Changes |
| --- | --- |
| `Button`, `TextInput`, `SelectInput` | Token colors, focus rings |
| `InlineAlert` | Semantic danger/success/warning/info |
| `EmptyState` | Official logomark |
| `LoadingSpinner` | Official logomark + spinner |
| `StatusBadge` (`ui.tsx`) | Semantic tones |
| `AuthLayout` | Official lockup |
| `AppShellFrame` | Sidebar lockup |
| `incident-widgets.tsx` | Overlay surfaces |
| `location-trail-map.tsx` | Overlay surfaces |
| `livekit-admin-player.tsx` | Existing layout preserved |

### Mobile App — Branding Surfaces

| Screen / Route | Logo | Theme |
| --- | --- | --- |
| Splash `/` | Lockup on dark background | `BrandColors.darkBackground` |
| Login `/login` | Lockup | Accent header + themed card |
| OTP `/otp-verification` | Lockup | Accent header + themed card |
| Home `/home` | — | `ThemeMode` from preferences |
| Emergency report `/report/emergency` | — | Theme tokens |
| Crime/Accident/Fire/etc. reports | — | Theme tokens |
| Live Video `/live-video` | — | Preview pane tokens |
| Broadcasts `/broadcasts` | — | Cards |
| Missing Person `/missing-person` | — | Forms |
| Stolen Vehicle `/stolen-vehicle` | — | Forms |
| Notifications `/notifications` | — | Theme-aware alert cards |
| Police Stations `/police-stations` | — | Map placeholder tokens |
| Family `/family` | — | Circle cards |
| Smartwatch `/smartwatch` | — | Companion preview `commandSurface` |
| Neighborhood Watch `/neighborhood-watch` | — | Community cards |
| Settings `/settings` | — | Appearance picker |
| About (within settings) | — | Brand colors note |

### Mobile Shared Widgets

| Widget | Changes |
| --- | --- |
| `ConnectivityBanner` | `context.eyeWarningSurface` |
| `LocationDeniedBanner` | `context.eyeDangerSurface` |
| `SosHeroCard` | `BrandColors.commandSurface` |
| `BroadcastAlertCard` | Theme-aware surface/border/text |
| `ActionTile`, `SectionCard`, `InfoRow` | Border/surface tokens |
| Snackbars | `BrandColors.green` / `BrandColors.danger` |

### Browser / PWA

| Item | Path |
| --- | --- |
| Favicon | `apps/admin-web/public/favicon.png` |
| Apple touch icon | `apps/admin-web/public/apple-touch-icon.png` |
| Next metadata icons | `apps/admin-web/app/layout.tsx` |

### Not Found / Out of Scope

- Dedicated public marketing website (only shared `public/brand/` assets)
- Email HTML templates with embedded logos
- Push notification image payloads
- Native Android/iOS launcher icon pipelines (Flutter platform folders not generated in repo)

## Accessibility

- Focus-visible outlines use `--focus-ring` (`#009933`)
- Semantic text pairs: `#FFFFFF` on `#161B22`, `#172026` on `#FFFFFF`
- Reduced-motion media query in global CSS
- Montserrat retained for readable typography
- Disabled states use `opacity-60` on controls

## Verification

Run from repo root:

```bash
pnpm run lint
pnpm run build
pnpm run test:brand:theme
pnpm run test:integration
```

Flutter (when SDK available):

```bash
cd apps/mobile && flutter analyze && flutter build apk --debug
```

## Design Tokens Reference

| Token | Dark | Light |
| --- | --- | --- |
| Background | `#0B0F14` | `#F1F7F6` |
| Surface | `#161B22` | `#FFFFFF` |
| Surface muted | `#1E252D` | `#E7EDF0` |
| Text | `#FFFFFF` | `#172026` |
| Text muted | `#B8C2CC` | `#5C6670` |
| Border | `#2C3440` | `#D8DEE4` |
| Brand green | `#009933` | `#009933` |
| Brand orange | `#FF9933` | `#FF9933` |
| Danger | `#FF4D4F` | `#B42318` |
| Success | `#00C853` | `#00C853` |
| Warning | `#FFB300` | `#B54708` |
| Info | `#29B6F6` | `#0284C7` |
