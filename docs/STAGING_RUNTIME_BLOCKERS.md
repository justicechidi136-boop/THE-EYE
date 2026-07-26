# Staging Runtime Blockers

Branch: `staging` (merged PR #19 at `841d96a`)  
Environment: staging  
Last updated: 2026-07-23  

Statuses: `OPEN` | `ROOT CAUSE CONFIRMED` | `CODE FIXED` | `CI VERIFIED` | `DEPLOYED` | `DEVICE VERIFIED` | `BLOCKED BY PROVIDER` | `FAILED`

Do not mark `DEVICE VERIFIED` from code inspection alone.

---

## SRB-001 — Password reset email not delivered

| Field | Value |
|---|---|
| **Platform** | API / Mobile |
| **User flow** | Forgot password → email queued → inbox receives link → reset completes |
| **Severity** | P0 |
| **Reproduction** | Request password reset for staging citizen account |
| **Expected** | SMTP accepts message; test inbox receives reset link; token single-use |
| **Actual** | No email when `AUTH_*_WEBHOOK_URL` pointed at missing `staging-delivery.theeye.com.ng` |
| **Frontend route** | Mobile auth / forgot password |
| **API request** | `POST /v1/auth/password-reset/request` |
| **Backend endpoint** | `AuthService` → `AuthDeliveryService.sendPasswordResetEmail` |
| **Database dependency** | `password_reset_tokens` |
| **Infrastructure** | SMTP (configured), legacy delivery webhook (not deployed) |
| **Root cause** | Auth delivery depended on external webhook app instead of direct SMTP adapter |
| **Fix** | `SmtpEmailProvider` + `AuthDeliveryService` prefers SMTP; webhook optional fallback |
| **Automated test** | `smtp-email.provider.spec.ts`, `auth-delivery.service.spec.ts` |
| **Runtime evidence** | CI run 29991834750 + Validate Staging 29991936821 green; SMTP E2E pending VPS deploy + inbox QA |
| **Status** | CI VERIFIED |

---

## SRB-002 — Phone OTP SMS not delivered

| Field | Value |
|---|---|
| **Platform** | API / Mobile |
| **User flow** | Phone login/register OTP |
| **Severity** | P0 |
| **Reproduction** | Request OTP to test handset |
| **Expected** | Termii API accepts SMS; handset receives OTP within TTL |
| **Actual** | Webhook-only delivery path failed; production sender pending approval |
| **Frontend route** | Mobile auth OTP screens |
| **API request** | `POST /v1/auth/phone-otp/request` |
| **Backend endpoint** | `AuthDeliveryService.sendPhoneOtp` |
| **Database dependency** | `phone_otps` |
| **Infrastructure** | Termii API, `TERMII_SENDER_ID` approval |
| **Root cause** | Webhook-only delivery; sender ID `THE EYE` pending Termii approval |
| **Fix** | `TermiiSmsProvider` direct adapter; fail closed when unconfigured |
| **Automated test** | `termii-sms.provider.spec.ts`, `auth-delivery.service.spec.ts` |
| **Runtime evidence** | CI verified; Termii sender ID `THE EYE` pending approval — SMS receipt blocked |
| **Status** | BLOCKED BY PROVIDER |

---

## SRB-003 — Notification inbox error

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **User flow** | Open notifications tab |
| **Severity** | P0 |
| **Reproduction** | Sign in on staging APK → Notifications |
| **Expected** | `GET /v1/notifications` returns paginated inbox |
| **Actual** | "Error loading notifications" — client called `http://localhost:4000/v1` |
| **Frontend route** | `/notifications` |
| **API request** | `GET /v1/notifications?limit=25` |
| **Backend endpoint** | `NotificationsController.list` |
| **Database dependency** | `notifications` |
| **Infrastructure** | Staging API reachable from device |
| **Root cause** | `NotificationInboxService` defaulted to compile-time localhost base URL |
| **Fix** | Use `TheEyeApiClient()` → `TheEyeApiConfig.resolveBaseUrl()`; dark-mode card contrast |
| **Automated test** | Mobile contract tests; manual inbox load |
| **Runtime evidence** | CI/mobile tests green; device inbox load pending VPS deploy + APK install |
| **Status** | CI VERIFIED |

---

## SRB-004 — Broadcasts unable to load

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **User flow** | Safety broadcasts feed + detail |
| **Severity** | P0 |
| **Reproduction** | Open broadcasts on staging device |
| **Expected** | `GET /v1/broadcasts/nearby` with profile location |
| **Actual** | Failed requests to localhost; detail screen used separate client instance |
| **Frontend route** | `/broadcasts` |
| **API request** | `GET /v1/broadcasts/nearby` |
| **Backend endpoint** | `BroadcastsController` nearby list |
| **Database dependency** | `broadcasts`, profile jurisdiction |
| **Infrastructure** | Staging API, GPS permission |
| **Root cause** | Same localhost default in `BroadcastFeedService` / detail fetch |
| **Fix** | Resolved base URL; detail uses controller `broadcastFeedService` |
| **Automated test** | Mobile contract tests |
| **Runtime evidence** | CI/mobile tests green; device feed load pending VPS deploy + APK install |
| **Status** | CI VERIFIED |

---

## SRB-005 — Profile avatar upload failure

| Field | Value |
|---|---|
| **Platform** | Mobile / API / Storage |
| **User flow** | Profile → pick avatar → upload → confirm |
| **Severity** | P0 |
| **Reproduction** | Upload JPEG/PNG from gallery on staging device |
| **Expected** | Presign → Spaces PUT → confirm → avatar URL visible |
| **Actual** | Upload errors reported in manual QA |
| **Frontend route** | Profile screen |
| **API request** | `POST /users/me/avatar/presign`, `POST /users/me/avatar/confirm` |
| **Backend endpoint** | `UsersService.presignAvatar` / `confirmAvatar` |
| **Database dependency** | `profiles.avatarUrl` |
| **Infrastructure** | DigitalOcean Spaces credentials, CORS, bucket policy |
| **Root cause** | MIME/extension mismatch for `.jpeg`/uppercase names; possible S3 env gaps on staging |
| **Fix** | `EvidenceValidation.normalizeMimeType` in avatar upload; avatar-specific presign validation |
| **Automated test** | `s3-presign.ts` avatar path; manual device upload |
| **Runtime evidence** | CI/API presign tests green; device upload pending VPS deploy + Spaces QA |
| **Status** | CI VERIFIED |

---

## SRB-006 — SOS / incident reports hang or fail silently

| Field | Value |
|---|---|
| **Platform** | Mobile / API |
| **User flow** | SOS, emergency, crime, fire, kidnapping, abuse, suspicious, missing person, stolen vehicle |
| **Severity** | P0 |
| **Reproduction** | Submit each report type on device |
| **Expected** | Loading terminates ≤45s; incident persisted; navigate to tracking/active emergency |
| **Actual** | Infinite loading; SOS routed without `emergencyCategory`; unhandled submit exceptions |
| **Frontend route** | `/report/*`, SOS sheet |
| **API request** | `POST /v1/incidents/report`, `POST /v1/incidents/sos` |
| **Backend endpoint** | `IncidentsService.report` / `reportSos` |
| **Database dependency** | `incidents`, related report tables |
| **Infrastructure** | API, optional notification queue (must not block create) |
| **Root cause** | Missing timeouts/try-catch on client; SOS draft missing category; localhost API on some services |
| **Fix** | Submission timeouts, error codes, SOS `emergencyCategory: "Other"`; API persists incident before async notifications |
| **Automated test** | Incident submission tests; mobile smoke |
| **Runtime evidence** | CI/mobile timeout tests green; per-report-type device QA pending deploy |
| **Status** | CI VERIFIED |

---

## SRB-007 — Incident media UI advertises unavailable live video

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **User flow** | Attach evidence on report forms |
| **Severity** | P1 |
| **Reproduction** | Open evidence section on report screen |
| **Expected** | Copy matches available actions (photos only) |
| **Actual** | Previously claimed "Upload Images or live video" while only photos implemented |
| **Frontend route** | Report compose screens |
| **API request** | `POST /incidents/:id/media/presign` |
| **Backend endpoint** | `IncidentsService.presignMedia` |
| **Root cause** | Misleading UI copy |
| **Fix** | Updated copy to "Upload photos (JPEG, PNG, WEBP)" |
| **Automated test** | Evidence validation tests |
| **Runtime evidence** | Copy fix in CI build; device UI verification pending |
| **Status** | CI VERIFIED |

---

## SRB-008 — LiveKit live video start failure

| Field | Value |
|---|---|
| **Platform** | Mobile / Admin / Infra |
| **User flow** | Start SOS live video / emergency stream |
| **Severity** | P0 |
| **Reproduction** | Tap live video on staging device |
| **Expected** | Join `wss://staging-livekit.theeye.com.ng` or honest disable message |
| **Actual** | Generic "Unable to start live video right now" / spinner |
| **Frontend route** | `/live-video` |
| **API request** | `POST /v1/live-video/incidents/:id/start` |
| **Backend endpoint** | Live video module + LiveKit credentials |
| **Infrastructure** | `LIVEKIT_URL`, TLS/WSS, Nginx websocket headers |
| **Root cause** | Staging LiveKit configuration not verified end-to-end |
| **Fix** | Honest unavailable messaging on 503/generic failure; timeout on start path |
| **Automated test** | `validate-env.livekit.spec.ts`, live video API tests |
| **Runtime evidence** | Honest-unavailable messaging in CI build; DNS/TLS/room join pending staging infra QA |
| **Status** | CI VERIFIED |

Note: If staging seed lacks verified nationwide police data, empty results must be shown honestly — not demo stations as real.

---

## SRB-009 — Police station search broken / demo data

| Field | Value |
|---|---|
| **Platform** | Mobile / API |
| **User flow** | Search by state/LGA/location; call station |
| **Severity** | P1 |
| **Reproduction** | Open nearest police; filter by state/LGA |
| **Expected** | `GET /v1/police-stations` with server filters + PostGIS distance |
| **Actual** | Hardcoded Ikeja demo list; filters non-functional |
| **Frontend route** | `/police-stations` |
| **API request** | `GET /v1/police-stations?state=&lga=&latitude=&longitude=` |
| **Backend endpoint** | `PoliceStationsController.list` |
| **Database dependency** | `police_stations`, PostGIS, verified seed data |
| **Root cause** | Mobile used static demo data; API list endpoint missing |
| **Fix** | Hybrid locator: verified `police_stations` + server-side Google Places fallback; mobile `/police-stations/nearby` with source labels and attribution |
| **Automated test** | `police-locator.service.spec.ts`, `police_locator_test.dart` |
| **Runtime evidence** | PR #24 merged @ `131e125` (2026-07-24); Validate Staging [30104553344](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30104553344) green. Live API @ 2026-07-24T15:28Z: HTTP 200, `googlePlacesEnabled:true`, `googleProviderStatus:"ok"`, `googleCount:10`, `dataSource:googlePlaces`, `verificationStatus:GoogleMapsResult`, attribution + navigation URLs present, no API key in response. Invalid lat → HTTP 400. Radius cap clamps to 50000. **Automated Deploy [30104864524](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30104864524) failed** (DEP-003 deploy-gate). VPS SHA + migration `20260723230000_police_station_verification` **not SSH-verified**. **Mobile device QA NOT DONE**. |
| **Status** | CODE FIXED — **CI VERIFIED** — **API RUNTIME VERIFIED (HTTP)** — **DEVICE QA PENDING** |

Note: Nationwide verified official police dataset remains incomplete. Google supplemental results are labelled `googlePlaces` and are not official THE EYE verification. Empty/honest results must still be shown outside seeded areas.

---

## SRB-010 — Job Vacancies routes to Broadcasts

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **User flow** | Home → Job Vacancies card |
| **Severity** | P2 |
| **Reproduction** | Tap Job Vacancies on home grid |
| **Expected** | Job feature or "Coming soon" |
| **Actual** | Previously navigated to `/broadcasts` |
| **Frontend route** | Home grid |
| **Root cause** | Incorrect navigation target |
| **Fix** | Snackbar "Job vacancies are coming soon." |
| **Runtime evidence** | Verified in mobile CI tests; device tap pending APK install |
| **Status** | CI VERIFIED |

---

## SRB-011 — Theme contrast (light/dark)

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **User flow** | Report form switches; notification inbox |
| **Severity** | P1 |
| **Reproduction** | Toggle dark mode; open report form + notifications |
| **Expected** | WCAG-readable labels in both themes |
| **Actual** | Low contrast on manual location / anonymous / notify contact; notification cards hardcoded light green |
| **Root cause** | Hardcoded `EyeTokens` colors on themed surfaces |
| **Fix** | `Theme.of(context).textTheme` on switches; `EyeNotificationCard` uses `ColorScheme` |
| **Runtime evidence** | CI analyze/tests green; light/dark device pass pending |
| **Status** | CI VERIFIED |

---

## SRB-012 — Admin logout 405

| Field | Value |
|---|---|
| **Platform** | Admin Web |
| **User flow** | Logout → login |
| **Severity** | P0 |
| **Reproduction** | Expire session → visit protected route → login with `next=/api/auth/logout` |
| **Expected** | POST logout clears cookies → `/login` |
| **Actual** | HTTP 405 on GET to POST-only logout route |
| **Frontend route** | `/api/auth/logout`, `/login` |
| **Root cause** | Middleware redirected unauthenticated users to login with API path in `next` |
| **Fix** | `/api/auth/logout` public in middleware; sanitize `next` in login form |
| **Automated test** | `admin-auth-validation-test.cjs` |
| **Runtime evidence** | `admin-auth-validation-test.cjs` green in CI; live admin session QA pending VPS deploy |
| **Status** | CI VERIFIED |

---

## Home route matrix

| Displayed title | Intended route | Previous route | Implemented? | Action |
|---|---|---|---|---|
| Emergency Case | `/report/emergency` | same | Yes | Keep |
| Accident Reporting | `/report/accident` | same | Yes | Keep |
| Nearest Police Station | `/police-stations` | demo screen | Yes | API wired |
| Job Vacancies | Coming soon | `/broadcasts` | No | Snackbar only |
| Live emergency video | `/live-video` | same | Partial | Honest unavailable if LiveKit down |
| Safety broadcasts | `/broadcasts` | same | Yes | Base URL fixed |
| All other report tiles | `/report/*` | same | Yes | Timeouts added |

---

## Release gate checklist

| Gate | Status |
|---|---|
| PR #19 merged to staging | PASS (`841d96a`) |
| CI + Validate Staging green | PASS (runs 29991834750, 29991936821) |
| VPS deploy (API/worker/admin) | **PENDING** — manual VPS step not executed this session |
| Password reset email received | Pending deploy + inbox QA |
| OTP received or blocked by sender ID only | BLOCKED BY PROVIDER |
| Profile image uploads | Pending deploy + device QA |
| Notifications load | Pending deploy + device QA |
| SOS creates incident | Pending deploy + device QA |
| All report types terminate correctly | Pending deploy + device QA |
| Broadcasts load | Pending deploy + device QA |
| Police filters vs verified data | Pending deploy + data/device QA |
| Admin logout without 405 | Pending deploy + admin QA |
| Theme text readable | Pending device QA |
| LiveKit works or honestly disabled | Pending deploy + infra/device QA |
| Fresh staging APK built | PASS (local build from `841d96a`) |
| Physical device QA | **BLOCKED** — no ADB/device in session |
| RC1 tag | **NOT CREATED** — release gate not passed |

---

## SRB-020 — Mobile location permission not requested

| Field | Value |
|---|---|
| **Platform** | Mobile (Android) |
| **User flow** | Nearby Police, SOS, incident reporting, broadcasts, live tracking |
| **Severity** | P0 |
| **Reproduction** | Install staging APK → Settings → Apps → Permissions → Location — THE EYE not listed; SOS/police fail without GPS |
| **Expected** | Manifest declares location; runtime prompt on feature entry; factual errors; SOS submits with pending location policy |
| **Actual (pre-fix)** | `AndroidManifest.xml` missing `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`; runtime Geolocator calls ineffective |
| **Root cause** | Missing manifest permissions; no centralized permission lifecycle; SOS blocked on GPS failure; generic network errors |
| **Fix** | Manifest permissions; `location_permission_service.dart` typed states; SOS pending-location policy; Settings location section; police/settings recovery UI |
| **Automated test** | `location_permission_service_test.dart`, `sos_location_policy_test.dart`, `sos_actions_test.dart` |
| **Runtime evidence** | PR #22 merged @ `cd13a80`; Validate Staging [30048619870](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30048619870) green; local APK @ `cd13a80` SHA-256 `E1501B3E…53D6E`; **physical phone QA NOT DONE** (no ADB) |
| **Status** | CI VERIFIED — **DEVICE QA PENDING** |

---

## SRB-021 — Watch location permission and GPS lifecycle not verified

| Field | Value |
|---|---|
| **Platform** | Watch (Android / Wear OS) |
| **User flow** | SOS, silent SOS, emergency tracking, offline replay, reboot recovery |
| **Severity** | P0 |
| **Reproduction** | Watch SOS at 0,0 without permission; no foreground service; fake GPS UI; GPS ticks dropped offline |
| **Expected** | Watch-side permission prompt; factual SOS without fix; foreground emergency service; offline GPS queue; real diagnostics |
| **Actual (pre-fix)** | Permission onboarding skippable; SOS used `latitude ?? 0`; timer-only tracking; hardcoded GPS status |
| **Root cause** | No typed watch permission service; no `EmergencyTrackingService`; offline GPS never queued; no location settings diagnostics |
| **Fix** | Watch `location_permission_service.dart`; `EmergencyTrackingService` + boot receiver; SOS pending policy; location settings screen; device status reads real state |
| **Automated test** | `location_permission_service_test.dart`, `sos_service_test.dart` |
| **Runtime evidence** | PR #22 merged @ `cd13a80`; Validate Staging [30048619870](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30048619870) green; **physical watch QA NOT DONE** |
| **Status** | CI VERIFIED — **WATCH QA PENDING** |

---

## SRB-022 — Live video jurisdiction resolution failure

| Field | Value |
|---|---|
| **Platform** | Mobile / API / LiveKit |
| **User flow** | Start Live Video → incident creation → jurisdiction lookup → LiveKit join |
| **Severity** | P0 |
| **Reproduction** | Start Live Video on staging with GPS enabled |
| **Expected** | Server resolves jurisdiction from coordinates/profile fallback; incident persists; LiveKit session starts |
| **Actual (pre-fix)** | `findJurisdiction` threw 400 when staging DB lacked fallback row or polygon; mobile showed jurisdiction error before LiveKit |
| **Root cause** | Hard-fail jurisdiction lookup; citizen JWT lacks country/state/lga; staging jurisdictions seeded without polygons |
| **Fix** | `JurisdictionResolutionService` with polygon/nearest/profile/default/global fallback; incident metadata records resolution status; admin diagnose endpoint; staging seed adds Ikeja polygon |
| **Automated test** | `jurisdiction-resolution.service.spec.ts` |
| **Runtime evidence** | PR #22 merged @ `cd13a80`; Validate Staging [30048619870](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30048619870) green; VPS deploy blocked (DEP-002); jurisdiction seed not applied on VPS; **Live Video device QA NOT DONE** |
| **Status** | CI VERIFIED — **DEVICE QA PENDING** (depends on SRB-020 + VPS deploy) |

---

## SRB-023 — Police locator missing back navigation

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **User flow** | Home/Services → Nearby Police → return to previous screen |
| **Severity** | P1 |
| **Reproduction** | Open Nearby Police; no reliable back control when opened as tab root |
| **Expected** | AppBar/back header; Android back; safe fallback to `/home` |
| **Actual (pre-fix)** | Plain AppBar with title only; no explicit back fallback |
| **Root cause** | Screen not using Figma back header pattern or PopScope fallback |
| **Fix** | `EyePageBackHeader` + `PopScope` with `/home` fallback in `police_stations_screen.dart` |
| **Automated test** | `police_navigation_test.dart` |
| **Runtime evidence** | PR #22 merged @ `cd13a80`; Validate Staging [30048619870](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30048619870) green; local APK @ `cd13a80`; **device navigation QA NOT DONE** |
| **Status** | CI VERIFIED — **DEVICE QA PENDING** |

---

## SRB-024 — Google-linked account recovery unavailable

| Field | Value |
|---|---|
| **Platform** | Mobile / API |
| **User flow** | Login → Recover account → email + security push → Google re-auth → restored session |
| **Severity** | P0/P1 |
| **Reproduction** | Google-only user loses device access; password reset ineffective |
| **Expected** | Provider-aware recovery with generic anti-enumeration response, SMTP email, security push, Google re-auth completion |
| **Actual (pre-fix)** | Only password reset request existed; no Google recovery flow or completion UI |
| **Root cause** | No `AccountRecoveryChallenge` model/endpoints; no mobile recovery screens |
| **Fix** | Account recovery API + SMTP delivery + security push + mobile Recover Account flow |
| **Automated test** | `account-recovery.service.spec.ts` |
| **Runtime evidence** | PR #22 merged @ `cd13a80`; Validate Staging [30048619870](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30048619870) green; migration `20260723210000_account_recovery_challenges` **not deployed** (Deploy [30048809537](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30048809537) failed); **email/push/device recovery QA NOT DONE** |
| **Status** | CI VERIFIED — **DEVICE QA PENDING** |

---

## SRB-025 — Dark-mode green text accessibility

| Field | Value |
|---|---|
| **Platform** | Mobile / Watch |
| **User flow** | Dark theme across auth, settings, smartwatch pairing, police, notifications, and watch pairing screens |
| **Severity** | P1 |
| **Reproduction** | Enable Dark Mode; open auth links, smartwatch pairing method cards, settings status text, watch connection labels |
| **Expected** | Interactive/link text uses accessible orange (`#FF9933` semantic tokens); success states keep green icons/borders with readable foreground text |
| **Actual (pre-fix)** | Hardcoded `BrandColors.green`, `BrandColors.accentHover`, and `EyeColors.green` used for small body/link text on `#0B0F14` |
| **Root cause** | No typed semantic color layer; feature widgets referenced brand constants directly |
| **Fix** | `EyeSemanticColors` ThemeExtension (mobile + watch); theme registration in `buildTheme`/`buildDarkTheme`/`buildEyeWatchTheme`; auth links, pairing `_ModeCard`, settings status, verification chips, watch interactive labels migrated to semantic tokens |
| **Automated test** | `eye_semantic_colors_test.dart` (mobile 7 tests, watch 3 tests); full mobile 158/158, watch 63/63 |
| **Runtime evidence** | PR #24 merged @ `131e125`; Validate Staging [30104553344](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30104553344) green (mobile 159/159, watch 63/63 incl. semantic tests). Deploy [30104864524](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30104864524) **failed** — VPS app deploy not confirmed. **No certification APK** (prior local APK hashes discarded). **Physical device dark-mode pass NOT DONE**. |
| **Status** | CODE FIXED — **CI VERIFIED** — **DEVICE QA PENDING** (extended fix branch adds home/services/broadcast/smartwatch/profile semantic migration) |

---

## SRB-026 — Start SOS Live Video app shutdown (P0)

| Field | Value |
|---|---|
| **Platform** | Mobile / Android |
| **User flow** | SOS sheet → Start SOS live video → incident + LiveKit + GPS |
| **Severity** | P0 |
| **Reproduction (code-inferred)** | Tap Start SOS live video on staging APK with active session |
| **Expected** | Incident created; LiveKit starts when available; app stays running; factual errors with reference IDs |
| **Actual (reported)** | App crashes or shuts down |
| **Root cause (confirmed in code)** | Double `startLocalPreview` on auto-start path; unsafe `accessToken!`; missing `activateActiveEmergency`; `dispose()` used `appOf(context)` after unmount |
| **Fix** | Skip duplicate preview when already previewing; guard null session token (`LIVE-VIDEO-AUTH-001`); activate active emergency after incident; safe dispose via cached `AppController`; stop location tracking on exit |
| **Automated test** | `live_video_session_test.dart` livekit nesting; manual/device logcat pending |
| **Runtime evidence** | Code fix on branch `fix/runtime-stabilization-srb025-030`; device logcat + APK verification pending |
| **Status** | ROOT CAUSE CONFIRMED → **CODE FIXED** |

---

## SRB-027 — Google Sign-In fails after uninstall/reinstall

| Field | Value |
|---|---|
| **Platform** | Mobile / Firebase / API |
| **User flow** | Clean install → Continue with Google |
| **Severity** | P0 |
| **Reproduction (reported)** | Uninstall staging APK, reinstall, Google sign-in shows generic failure |
| **Expected** | Firebase token exchange succeeds or stable diagnostic code |
| **Actual** | "Sign in failed. Try again later." |
| **Root cause** | Release SHA-1/SHA-256 may be missing in Firebase `the-eye-2stg` for `com.theeye.app.staging`; generic Firebase/platform error mapping |
| **Fix** | Stable codes `AUTH-GOOGLE-001`…`005`; configuration mismatch and exchange failure surfaced without raw Firebase exceptions |
| **Automated test** | `social_auth_service_test.dart` (cancellation, config, exchange codes) |
| **Runtime evidence** | Ops must register staging release cert fingerprints in Firebase; clean reinstall device QA pending |
| **Status** | ROOT CAUSE CONFIRMED → **CODE FIXED** (config verification + device QA pending) |

---

## SRB-028 — Account recovery email delivery not configured

| Field | Value |
|---|---|
| **Platform** | API / Mobile |
| **User flow** | Recover Account → email queued → inbox |
| **Severity** | P0 |
| **Reproduction** | Request account recovery on staging |
| **Expected** | SMTP accepts; inbox receives recovery link |
| **Actual** | "Account recovery email delivery is not configured." (`AUTH_DELIVERY_UNAVAILABLE`) |
| **Root cause** | Staging VPS API/worker missing `SMTP_*` env vars; falls through to unset webhook |
| **Fix (code)** | `AuthDeliveryService` already prefers `SmtpEmailProvider`; mobile maps `AUTH-DELIVERY-001` |
| **Infrastructure** | Apply `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SECURE`, `SMTP_FROM_EMAIL=security@theeye.com.ng` on staging API |
| **Automated test** | `auth-delivery.service.spec.ts` |
| **Runtime evidence** | Controlled inbox test pending VPS SMTP configuration |
| **Status** | ROOT CAUSE CONFIRMED → **BLOCKED BY PROVIDER** (ops SMTP config) |

---

## SRB-029 — Forgot password authentication delivery fails

| Field | Value |
|---|---|
| **Platform** | API / Mobile |
| **User flow** | Forgot password → email → reset |
| **Severity** | P0 |
| **Reproduction** | Request password reset on staging |
| **Expected** | SMTP accepts; inbox receives reset link |
| **Actual** | "Authentication delivery failed. Try again shortly." (`AUTH_DELIVERY_FAILED`) or delivery-not-configured |
| **Root cause** | Same SMTP gap as SRB-028; legacy webhook path or SMTP rejection on VPS |
| **Fix (code)** | Direct SMTP path verified; mobile maps `AUTH-DELIVERY-002` |
| **Infrastructure** | Same SMTP env as SRB-028 + `PASSWORD_RESET_LINK_BASE_URL` staging deep link |
| **Automated test** | `auth-delivery.service.spec.ts` |
| **Runtime evidence** | Controlled inbox test pending VPS SMTP configuration |
| **Status** | ROOT CAUSE CONFIRMED → **BLOCKED BY PROVIDER** (ops SMTP config) |

---

## SRB-030 — Add Family Members button does not respond

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **User flow** | Family Circle → Add family member |
| **Severity** | P1 |
| **Reproduction** | Open `/family`, tap Add family member |
| **Expected** | Navigate to member form / emergency contacts workflow |
| **Actual** | `onPressed: () {}` empty handler with placeholder list |
| **Root cause** | Stub screen never wired to existing `/profile/emergency-contacts` API |
| **Fix** | Button navigates to `EmergencyContactsScreen` (`GET/POST /users/me/emergency-contacts`) |
| **Automated test** | Widget/navigation test pending; manual device QA pending |
| **Runtime evidence** | Code fix on branch `fix/runtime-stabilization-srb025-030` |
| **Status** | ROOT CAUSE CONFIRMED → **CODE FIXED** |

---

## SRB-031 — Dark-mode theme and text-field contrast regressions

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **Severity** | P0 |
| **Root cause** | Hardcoded `Colors.white` / light surfaces on auth, home figma shell, service cards, and form widgets; `InputDecorationTheme` not wired to semantic tokens |
| **Fix** | `EyeInputTheme`, `EyeThemeBuilder`, semantic `buildDarkTheme`/`buildTheme` extensions; `SafetyScaffold` uses `#0B0F14` background; login/account recovery/profile inputs use semantic colors; SOS live video action uses orange |
| **Automated test** | `runtime_srb031_037_test.dart` |
| **Status** | **CODE FIXED** — device QA pending |

---

## SRB-032 — Google Sign-In AUTH-GOOGLE-003

| Field | Value |
|---|---|
| **Platform** | Mobile / Firebase / API |
| **Root cause** | Over-broad AUTH-GOOGLE-003 mapping; config errors not classified as AUTH-GOOGLE-001 |
| **Fix** | Narrow `_firebaseAuthMessage` / `_googlePlatformMessage` to stable codes AUTH-GOOGLE-001–005 |
| **Infrastructure** | Release SHA-1/256 in Firebase `the-eye-2stg` still required for physical verification |
| **Status** | **CODE FIXED** — device + Firebase console QA pending |

---

## SRB-033 — Account recovery email missing link

| Field | Value |
|---|---|
| **Platform** | API / SMTP |
| **Root cause** | `ACCOUNT_RECOVERY_LINK_BASE_URL` unset → linkless fallback email sent |
| **Fix** | Fail closed with `AUTH_RECOVERY_LINK_BASE_MISSING`; HTML button + plain-text URL; `.env.staging.example` updated |
| **Infrastructure** | Set `ACCOUNT_RECOVERY_LINK_BASE_URL` on staging VPS |
| **Automated test** | `auth-delivery.service.spec.ts` |
| **Status** | **CODE FIXED** — inbox QA pending |

---

## SRB-034 — Start SOS Live Video crash (P0)

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **Root cause** | Double camera preview init on auto-start path; async callbacks after dispose |
| **Fix** | Skip `_preparePreview` when `autoStartStream`; `_disposed` guard; safe finally in `_startStream` |
| **Status** | **CODE FIXED** — physical logcat QA pending |

---

## SRB-035 — Neighborhood Watch runtime failures

| Field | Value |
|---|---|
| **Platform** | Mobile / API seed |
| **Root cause** | `NeighborhoodWatchService` defaulted to `localhost:4000`; staging seed lacked citizen membership + active patrol |
| **Fix** | `TheEyeApiConfig.resolveBaseUrl()`; patrol checkpoint filters `Active` status; improved no-schedule UX; seed adds approved membership + active patrol |
| **Automated test** | `neighborhood_watch_service_test.dart` |
| **Status** | **CODE FIXED** — device QA pending |

---

## SRB-036 — Family Circle relationship persistence

| Field | Value |
|---|---|
| **Platform** | Mobile / API |
| **Root cause** | Free-text relationship field; backend accepted any string |
| **Fix** | Canonical enum dropdown + `EmergencyContactRelationships.normalize()`; API `@IsIn` validation |
| **Automated test** | `runtime_srb031_037_test.dart` |
| **Status** | **CODE FIXED** — device QA pending |

---

## SRB-037 — SOS device simulation in staging

| Field | Value |
|---|---|
| **Platform** | Mobile |
| **Root cause** | Hardcoded battery/signal/device ID; no `GET /smartwatch/devices` client |
| **Fix** | `listSmartwatchDevices` API client; load paired device on screen open; telemetry only from API; optional battery/signal in payloads |
| **Status** | **CODE FIXED** — physical watch QA pending |

---

## SRB-032 — Google Sign-In remains broken

| Field | Value |
|---|---|
| **Platform** | Mobile / Firebase / API |
| **Installed APK (2026-07-25)** | `com.theeye.app.staging` v0.1.0 code 1 @ `9e156a6` — SHA-256 `58E80E96…` |
| **Physical evidence** | Sign-in attempt logcat **PENDING** on certification APK; Firebase config verified (`the-eye-2stg`, debug SHA-1 `5da2e2eb…` in `google-services.json`) |
| **Code fix** | Layered `AuthDiagnostics` (layers 1–8), reference IDs on user messages, Settings → Build diagnostics (version, SHA, cert suffix) |
| **Failure layer** | **PENDING** — requires physical Google tap on new APK |
| **Status** | **PARTIALLY BLOCKED** — CODE FIXED — DEVICE QA PENDING |

---

## SRB-034 — Live SOS Video continues to crash (P0)

| Field | Value |
|---|---|
| **Platform** | Mobile (Android FGS) |
| **Physical logcat (confirmed 2026-07-25)** | `ForegroundServiceDidNotStartInTimeException` on `EmergencyLocationForegroundService` during `/active-emergency` restore @ 17:51 |
| **Root cause (log-matched)** | `startForeground()` not reached within Android deadline when FGS starts on active-emergency restore |
| **Code fix** | `onCreate()` immediate `startForeground`; `ic_notification.xml`; fallback icon + try/catch; `LiveVideoStartupPhase` state machine; incident-first ordering |
| **Artifact** | `artifacts/mobile/logcat-fgs-crash-9e156a6-sanitized.txt` |
| **Status** | **CODE FIXED — DEVICE QA PENDING** |

---

## SRB-038 — Neighborhood Watch Dark Mode incomplete

| Field | Value |
|---|---|
| **Platform** | Mobile UI |
| **Physical evidence** | White/light surfaces on NW sub-screens reported on APK @ `9e156a6` |
| **Code fix** | `EyeScaffold` semantic surfaces; NW routes in `main.dart`; post/report/members screens; map card dark surfaces; orange interactive icons in dark mode |
| **Automated test** | `neighborhood_watch_dark_mode_test.dart` (source guard + main.dart NW section), `neighborhood_watch_theme_widgets_test.dart` |
| **Status** | **CODE FIXED — DEVICE QA PENDING** |

---

## Final status (SRB-032 / SRB-034 / SRB-038)

**PARTIALLY BLOCKED — CODE FIXED — DEVICE QA PENDING**

| Milestone | Evidence |
|---|---|
| Prior installed APK | `9e156a6` — FGS crash **log-confirmed**; does not include SRB-032/034/038 fixes |
| Fix branch | `fix/runtime-srb032-034-038` @ `7e7af0c` |
| Mobile tests | **179/179 PASS** (includes new auth/theme/runtime tests) |
| Certification APK | **BUILD IN PROGRESS** — requires `--dart-define=THE_EYE_BUILD_SHA=7e7af0c` |
| Physical QA | **NOT PASS** — Google sign-in layer, NW dark mode sweep, Live Video no-crash |

**Remaining before DEVICE VERIFIED:**
1. Merge PR to `staging`; configure DEP-004 deploy secrets
2. Build certification APK from merged SHA; clean-uninstall → install
3. Phase 5 physical QA: Google (8 steps), NW dark mode (all routes), Live Video (14 steps)

**Sprint 8:** NOT AUTHORIZED until SRB-032/034/038 reach DEVICE VERIFIED.

---

## Final status (SRB-031–037)

**CI VERIFIED — DEPLOY BLOCKED (DEP-004) — DEVICE QA PENDING**

| Milestone | Evidence |
|---|---|
| Feature branch | `fix/runtime-srb031-037` @ `75c11b3` |
| PR | [#26](https://github.com/justicechidi136-boop/THE-EYE/pull/26) merged to `staging` @ `c59d837` (2026-07-25) |
| CI (PR) | [30159904843](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30159904843) — API 346/346, mobile 170/170, watch 63/63 |
| Validate Staging (post-merge) | [30160196196](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30160196196) green @ `c59d837` |
| Deploy | **BLOCKED** — [30161689343](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30161689343) failed **DEP-004**: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` not configured in GitHub `staging` environment |
| VPS HEAD | **NOT SSH-VERIFIED** — cannot confirm `git rev-parse HEAD` = `origin/staging` |
| Certification APK | **NOT BUILT** — feature-branch artifact classified **VALIDATION ARTIFACT — NOT CERTIFICATION BUILD** (SHA-256 `C3EDA053…`) |
| Physical QA | **NOT TESTED** — no `adb` on release controller host |

**SRB progression:** CODE FIXED → **CI VERIFIED** → *(DEPLOY blocked)* → DEVICE VERIFIED pending.

Remaining before **DEVICE VERIFIED**:
1. Configure GitHub `staging` secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`
2. Run Deploy workflow (`--ref staging`) targeting merge SHA `c59d837` (or current `origin/staging`)
3. SSH-verify VPS: `git rev-parse HEAD`, `docker compose ps`, migrations, idempotent NW seed
4. Set VPS `ACCOUNT_RECOVERY_LINK_BASE_URL=https://staging-app.theeye.com.ng/account-recovery` + SMTP vars
5. Register staging release SHA-1/SHA-256 in Firebase `the-eye-2stg`
6. Build **CERTIFICATION STAGING APK** from deployed SHA only; clean-install; Phase 12 QA

**Sprint 8:** NOT AUTHORIZED until SRB-031–037 reach DEVICE VERIFIED.

---

## DEP-005 — Nginx stale upstream after container recreation

| Field | Value |
|---|---|
| **Symptom** | After `docker compose up -d --force-recreate api admin-web`, staging returns **502** until nginx is manually restarted |
| **Root cause** | Nginx resolves Compose service names (`api`, `admin-web`, `livekit`) at startup/reload only; static `/healthz` still returns 200 while proxied routes hit stale container IPs. GitHub Deploy workflow recreated backends but did not reload nginx or probe proxied `/v1/health/ready` with `Host:` headers |
| **Fix branch** | `fix/deploy-nginx-api-tools` |
| **Code fix** | Docker embedded DNS `resolver 127.0.0.11`; upstream `resolve` + variable `proxy_pass`; `scripts/reload-nginx-upstreams.sh`; `scripts/staging-smoke-check.sh`; `scripts/deploy-staging.sh`; Deploy workflow reload + smoke |
| **Automated test** | `scripts/ci/validate-nginx-deploy-lifecycle.cjs`, `docker-compose-smoke.cjs`, `validate-nginx-config.cjs` |
| **Status** | **RUNTIME VERIFIED** — Deploy [30196034966](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30196034966) @ `f6f6dee`: HTTPS smoke PASS, nginx recreate + reload, public API/admin OK after container recreate |

| Field | Value |
|---|---|
| **Symptom** | Docs referenced `api-tools` Compose service; only `api-seed-staging` existed |
| **Fix** | Added generic `api-tools` service (`profile: tools`, image `the-eye-api-tools`, entrypoint `tsx`) |
| **Canonical command** | `docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-tools prisma/seed-staging-test-accounts.ts` |
| **Verify command** | `… api-tools scripts/verify-staging-certification-data.ts` |
| **Seed hardening** | Idempotent staging police station (`staging-cert-ikeja-gate-001`), active patrol, community membership; production guard unchanged |
| **Automated test** | `scripts/ci/validate-api-tools-compose.cjs` |
| **Status** | **RUNTIME VERIFIED** — Deploy [30196034966](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30196034966) @ `f6f6dee`: seed ×2 + verify script PASS via `api-tools` |

---

## SRB-032 — Firebase release certificate (staging)

| Field | Value |
|---|---|
| **Package** | `com.theeye.app.staging` |
| **Firebase project** | `the-eye-2stg` |
| **Current staging release signing** | **Migrating to dedicated keystore** — see [STAGING_ANDROID_SIGNING.md](./STAGING_ANDROID_SIGNING.md) |
| **Deprecated debug APK fingerprints** | SHA-1 `5da2e2eb…` / SHA-256 `a6e66ccc…` — do **not** register as final identity |
| **Dedicated staging fingerprints** | SHA-1 `9b03f499…` / SHA-256 `de758a04…` — keystore generated 2026-07-26; **Firebase registration OPS PENDING** |
| **Registration** | **OPS ACTION REQUIRED** — add fingerprints in Firebase Console → `the-eye-2stg` → `com.theeye.app.staging` |
| **Status** | **BLOCKED BY PROVIDER** — dedicated keystore exists; `google-services.json` still references debug OAuth client |

---

## AUTH-001 — Staging citizen login 401

| Field | Value |
|---|---|
| **Symptom** | `POST /v1/auth/login` for controlled citizen returns **401 Invalid credentials** when probed with example `.env.staging.example` password |
| **Root cause** | Operator probes used example credentials while VPS `STAGING_TEST_CITIZEN_PASSWORD` is authoritative; optional env whitespace could also desync hash until seed re-run |
| **Fix** | Normalize/trim `STAGING_TEST_*` credentials in seed; case-insensitive login lookup; idempotent password hash refresh; deploy runs `verify-staging-test-accounts.ts` against public API |
| **Status** | **CODE FIXED — DEPLOY PENDING** (after push to `staging`) |

---

## RC-APK-001 / RC-QA-001 — Certification artifact & device QA

| ID | Status |
|---|---|
| RC-APK-001 | **INTERIM BUILT** — prior `THE-EYE-staging-0.1.0-f6f6dee.apk` @ dedicated release cert; **must not be reused** for final Google Sign-In certification |
| RC-QA-001 | **NOT TESTED** — final APK rebuild blocked on Firebase OPS + PR #29 merge |

---

## Final status (staging certification — 2026-07-26)

**PARTIALLY BLOCKED**

| Milestone | Evidence |
|---|---|
| PR #28 merge | **MERGED** @ `01cd1ed` (2026-07-26T07:58:37Z); post-merge hotfixes through `f6f6dee` |
| Deployed VPS SHA | **`f6f6dee071a19f206b2fc5fd78da4df056a1131f`** — Deploy [30196034966](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30196034966) SUCCESS |
| DEP-005 Nginx upstream | **RUNTIME VERIFIED** — HTTPS smoke PASS; nginx recreate; public `/v1/health/ready` OK |
| DEP-006 api-tools seed | **RUNTIME VERIFIED** — seed ×2 + verify JSON PASS |
| Staging signing | **KEY GENERATED** — dedicated keystore + GitHub `STAGING_ANDROID_*` secrets configured |
| Firebase fingerprints | **NOT REGISTERED** (OPS) — canonical SHA-1/SHA-256 awaiting Console registration |
| Certification APK | **INTERIM ONLY** — prior build @ dedicated release cert; final rebuild **BLOCKED** on Firebase OPS |
| Physical device QA | **NOT TESTED** — do not certify Google Sign-In on interim APK |
| Gradle signing hotfix | **PR #29 OPEN** @ `1bd50e6` — CI in progress; await approval before merge |

**Sprint 8:** NOT AUTHORIZED.

**Overall:** `PARTIALLY BLOCKED` — **FIREBASE OPS ACTION REQUIRED**

---

## Final status

**PARTIALLY BLOCKED**

PR #24 merged to `staging` at `131e1256e8fbd5a18d10084132e53b630afbed0b` (2026-07-24T15:16:10Z). Post-merge Validate Staging [30104553344](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30104553344) green. **Automated Deploy [30104864524](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30104864524) failed** at staging preflight: `vars.NEXT_PUBLIC_API_BASE_URL=https://staging-api.theeye.com.ng/v1` is rejected because deploy gate substring-matches production host `api.theeye.com.ng` (**DEP-003**). SSH deploy job skipped — **VPS SHA not certified** against `131e125`.

Live staging API @ 2026-07-24T15:28Z: Google Places hybrid locator **HTTP-verified** (`googlePlacesEnabled:true`, attribution present). **No certification APK built**; **no physical device QA** for SRB-009 or SRB-025.

Remaining blockers:
- **DEP-003** — fix staging deploy gate to accept `staging-api.theeye.com.ng/v1`, then rerun Deploy workflow with `DEPLOY_*` secrets.
- **VPS SSH verification** — confirm `git rev-parse HEAD` = `131e125`, migration applied, API container env.
- **Certification APKs** — build only from deployed staging SHA after successful Deploy.
- **Physical device QA** — SRB-009 police locator + SRB-025 dark-mode sweep.
- **Termii Sender ID approval** (SRB-002).
- **Nationwide verified police dataset** incomplete (data-quality gate separate from hybrid locator).

**Gate documents (2026-07-24):**
- `docs/SPRINT_8_ENTRY_GATE.md`
- `docs/RELEASE_CANDIDATE_TEST_MATRIX.md`
- `docs/SPRINT_8_AUTHORIZATION_REPORT.md` → **SPRINT 8 NOT AUTHORIZED**
