# Phase 7 — Field Tablet Physical QA Plan

**Status:** Prepared — not executed in CI. Physical tablet QA remains pending evidence.

**Branch:** `feature/field-operations-tablet`  
**Target:** Staging field-test readiness after Sprint 3 code complete.

## Preconditions

- Approved field tablet enrolled and paired
- Staging API reachable (Wi‑Fi and LTE profiles)
- Officer account with active agency assignment
- Supervisor/admin access for monitoring verification

## Test matrix

| # | Scenario | Pass criteria |
|---|----------|---------------|
| 1 | Device approval | Tablet shows approved; heartbeat accepted |
| 2 | Login | Field JWT issued; session bound to device |
| 3 | Start shift | Active shift visible on dashboard + admin monitoring |
| 4 | Start patrol | Patrol session active; map loads layers |
| 5 | GPS / map | Unit marker, layer toggles, recenter, distance labels |
| 6 | Assignment | Assignment appears in list + map assigned-incident layer |
| 7 | Accept | Status updates server-authoritatively |
| 8 | Navigate | Map fit/recenter toward incident |
| 9 | En route | Responder status + timeline update |
| 10 | Arrive | On-scene status; map reflects location |
| 11 | Communicate | Incident-scoped message send/receive; unread badge |
| 12 | Backup | Backup request created; admin monitoring shows open request |
| 13 | Panic | Panic alert under 3 taps; idempotent; admin alert visible |
| 14 | Add evidence | Evidence reference queued or uploaded per policy |
| 15 | Resolve | Terminal incident state; comms scope closes |
| 16 | End patrol | Patrol ended; route history persisted |
| 17 | Start checkpoint | Checkpoint session active |
| 18 | BOLO search | Plate/name search returns scoped results |
| 19 | Private sighting | Sighting stored; witness identity not exposed |
| 20 | Offline | Actions queue locally; UI shows queued not confirmed |
| 21 | Reconnect | `/field/sync/batch` partial success; cursor advances |
| 22 | Sync conflict | Explicit conflict message (assignment closed, device revoked) |
| 23 | Drone view | Read-only mission telemetry; no flight controls |
| 24 | Device health | Telemetry flags low battery/GPS/sync backlog in admin |
| 25 | Revocation | Revoked device lockout on next sync/login |
| 26 | Landscape | Nav rail + map + action panel usable on 10-inch tablet |
| 27 | Portrait | No clipped critical actions; panic reachable |
| 28 | 30-minute battery | No runaway GPS/network loops; acceptable drain |
| 29 | Wi‑Fi | Full workflow including map tiles and sync |
| 30 | LTE | Patrol + panic + backup on cellular |

## Evidence to capture

- Screen recording for panic, backup, offline/reconnect
- Admin monitoring screenshots (backup + safety + device health)
- APK hash and build flavor
- Logcat excerpt for sync conflict handling

## Sign-off blockers

- Hardware-backed Android Keystore for production key material
- FCM on staging tablet (`google-services.json` per flavor)
- Physical device QA sign-off by Field Ops QA Lead
