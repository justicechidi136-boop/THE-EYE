# Staging Runtime Blockers

Branch: `fix/staging-runtime-stabilization`  
Environment: staging  
Last updated: 2026-07-23  

Statuses: `OPEN` | `ROOT CAUSE CONFIRMED` | `CODE FIXED` | `DEPLOYED` | `DEVICE VERIFIED` | `BLOCKED BY PROVIDER`

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
| **Runtime evidence** | Pending device QA after deploy |
| **Status** | CODE FIXED |

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
| **Runtime evidence** | Pending OTP receipt on device / formal provider block |
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
| **Runtime evidence** | Pending device QA |
| **Status** | CODE FIXED |

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
| **Runtime evidence** | Pending device QA |
| **Status** | CODE FIXED |

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
| **Runtime evidence** | Pending device QA |
| **Status** | CODE FIXED |

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
| **Runtime evidence** | Pending device QA per report type |
| **Status** | CODE FIXED |

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
| **Status** | CODE FIXED |

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
| **Runtime evidence** | Pending DNS/TLS/room join QA |
| **Status** | CODE FIXED |

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
| **Fix** | API `GET /police-stations`; mobile `PoliceStationsService` + screen |
| **Automated test** | Police stations service tests (pending expansion) |
| **Runtime evidence** | Pending QA against verified station dataset |
| **Status** | CODE FIXED |

Note: If staging seed lacks verified nationwide police data, empty results must be shown honestly — not demo stations as real.

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
| **Status** | CODE FIXED |

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
| **Status** | CODE FIXED |

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
| **Runtime evidence** | Pending manual admin QA |
| **Status** | CODE FIXED |

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
| Password reset email received | Pending deploy + device QA |
| OTP received or blocked by sender ID only | BLOCKED BY PROVIDER |
| Profile image uploads | Pending device QA |
| Notifications load | Pending device QA |
| SOS creates incident | Pending device QA |
| All report types terminate correctly | Pending device QA |
| Broadcasts load | Pending device QA |
| Police filters vs verified data | Pending data + device QA |
| Admin logout without 405 | Pending device QA |
| Theme text readable | Pending device QA |
| LiveKit works or honestly disabled | Pending device QA |

---

## Final status

**PARTIALLY BLOCKED**

Code fixes are on branch `fix/staging-runtime-stabilization`. Staging is **not** `STAGING RUNTIME STABILIZED` until deploy, CI green, fresh APK, and manual device QA update this matrix.

Remaining provider blocker: **Termii Sender ID approval** (SRB-002).
