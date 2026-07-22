# THE EYE — Watch Runtime Architecture

**Sprint:** 7  
**Clients:** `apps/watch` (Flutter), native launcher shell (`android/`)  
**Backend:** `apps/api/src/modules/smartwatch`  
**Admin:** `apps/admin-web/app/smartwatch/*`

---

## Layer diagram

```
┌─────────────────────────────────────────────────────────────┐
│  LauncherHomeActivity (Kotlin) — HOME/LAUNCHER entry        │
│  BootCompletedReceiver → cold start launcher (Target B)     │
└───────────────────────────┬─────────────────────────────────┘
                            │ FlutterEngine
┌───────────────────────────▼─────────────────────────────────┐
│  WatchBootScreen → WatchBootSequencer                         │
│    local settings → secure identity → Firebase → pairing    │
│    → WatchAppServices.initialize (telemetry + heartbeat +   │
│       push + location idle)                                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
     ┌──────────────────────┼──────────────────────┐
     ▼                      ▼                      ▼
 PairingService        SosService            PushMessagingService
 (deviceSecret)        offline queue         FCM → AlertService
     │                      │                      │
     └──────────────────────┼──────────────────────┘
                            ▼
                   WatchApiClient → /v1/smartwatch/*
                            │
                            ▼
              NestJS SmartwatchService + NotificationsService
                            │
                            ▼
                   PostgreSQL (smartwatch_devices, sos_events,
                   gps_tracks, pairing_sessions, user_push_tokens)
```

---

## Identity model

| Field | Storage | Purpose |
|-------|---------|---------|
| `deviceId` | Secure storage + DB | Public device identifier |
| `deviceSecret` | Secure storage (hash on server) | Device-scoped API auth |
| `installationId` | Generated UUID per install | Duplicate install detection (Sprint 7) |
| `accessToken` | Secure storage (standalone login only) | Short-lived JWT for legacy notification paths |
| FCM token | Secure storage + `user_push_tokens` | Push delivery |

**Rule:** User JWT is **not** copied from phone. Pairing delivers one-time `deviceSecret` via pairing-status poll.

---

## Pairing sequence

1. Watch `POST /smartwatch/devices/pairing-codes` → 6-digit code (10 min TTL, hashed server-side).
2. Mobile `POST /smartwatch/devices/register` with code + user JWT.
3. Watch polls `GET /smartwatch/devices/:deviceId/pairing-status` → one-time secret.
4. Watch stores credentials; registers FCM via `POST /smartwatch/devices/:deviceId/push-tokens`.
5. Audit: `smartwatch.device_registered`, pairing session marked used.

Replay/expiry/wrong-user covered by unit tests in `smartwatch.service.spec.ts`.

---

## SOS pipeline

1. UI hold/countdown (`SosService`) → idempotent `clientSubmissionId`.
2. GPS snapshot + connectivity mode + battery in payload.
3. `POST /smartwatch/sos` with `deviceSecret`.
4. On failure → `OfflineEvent` persisted (SharedPreferences) → replay on reconnect.
5. Success → active emergency route + emergency GPS interval (5s) + heartbeat (2 min).

Silent SOS: `silent: true` in payload; discreet haptics; server/admin authorized indicator.

---

## Telemetry

| Event | Trigger | Endpoint |
|-------|---------|----------|
| Heartbeat | Timer (5 min / 2 min emergency) | `POST .../heartbeat` |
| Telemetry snapshot | Same payload shape | `POST .../telemetry` (alias) |
| GPS tick | Idle 60s / emergency 5s | `POST .../gps` |
| Offline batch | Manual + reconnect flush | `POST .../offline-sync` |

Real APIs: `battery_plus`, `connectivity_plus`, `geolocator`, `package_info` (app version).

---

## Push lifecycle

1. Firebase init during boot (non-blocking timeout).
2. FCM token obtained → device-authenticated register endpoint.
3. Foreground: `PushMessageRouter` → `AlertService.recordIncoming` → optional active-emergency refresh.
4. Background: `firebaseMessagingBackgroundHandler` (isolates init).
5. Unpair/revoke → deactivate tokens server-side + local `deleteToken`.

Categories aligned with notification contract (emergency, incident status, broadcast classes).

---

## Background reliability (Target B)

| Mechanism | When | Notes |
|-----------|------|-------|
| Boot receiver | Device boot | Starts launcher activity — no infinite loop |
| WatchBootSequencer timeouts | Cold start | Max 18s; degraded offline OK |
| DeviceTelemetryService | After init | Connectivity listener → offline replay |
| Foreground service | Active SOS/GPS | Sprint 7 — required on full Android where OEM kills background work |
| WorkManager | Retry jobs | Planned for queue flush backoff |
| RecoveryActivity + CrashSentinel | Crash loop | Escape to settings / safe mode |

---

## Admin visibility

- `GET /smartwatch/admin/devices` — jurisdiction-scoped list.
- `GET /smartwatch/admin/devices/:id` — detail (Sprint 7).
- Revoke/unpair/remote-wipe → existing PATCH/POST + push deactivation.
- Mappers use `batteryLevel`, `lastGpsAccuracy`, `lastSeenAt` (not legacy field names).

---

## Security boundaries

- Device secret required for SOS, GPS, heartbeat, telemetry, push register, offline sync.
- Revoked/unpaired devices: `deviceSecretHash` cleared → 401 on device auth.
- Admin mutations audited; raw secrets/tokens never returned in API responses.
- Deep links: allowlisted push categories only.

---

## Deferred / blocked (Sprint 7)

- Wear Data Layer phone relay (`StubCompanionProtocol`).
- Fall detection / heart-rate emergency triggers.
- Silent firmware OTA (vendor-specific).
- HMS push without GMS.
- Embedded maps on watch (tracking screen remains coordinates + external link pattern).
