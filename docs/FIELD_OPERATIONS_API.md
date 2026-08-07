# Field Operations API

**Project:** THE EYE — Phase 7  
**Base path:** `/v1`

Sprint 1 covers device registration and auth. Sprint 2 adds operational workflows below.

---

## Operational dashboard

| Method | Path | Permission |
|--------|------|------------|
| GET | `/field/dashboard` | `field:session:operate` |
| POST | `/field/dashboard/telemetry` | `field:session:operate` |

---

## Shift management

See `docs/FIELD_SHIFT_WORKFLOW.md`.

| Method | Path |
|--------|------|
| GET | `/field/shifts/active` |
| POST | `/field/shifts/start` |
| POST | `/field/shifts/pause` |
| POST | `/field/shifts/resume` |
| POST | `/field/shifts/end` |
| POST | `/admin/field-operations/shifts/:id/approve` |

---

## Patrol / checkpoint / assignments / BOLO / drone / sync

| Area | Prefix |
|------|--------|
| Patrol | `/field/patrols/*` |
| Checkpoint | `/field/checkpoints/*` |
| Assignments (dispatch proxy) | `/field/assignments/*` |
| Emergency responses | `/field/responses` |
| BOLO | `/field/bolo` |
| Drone (read-only) | `/field/drone/*` |
| Offline sync | `/field/sync/batch` |
| Admin monitoring | `/admin/field-operations/monitoring` |

Patrol and checkpoint docs: `docs/PATROL_MODE.md`, `docs/CHECKPOINT_MODE.md`.

---

## Device registration

See `docs/FIELD_DEVICE_REGISTRATION.md`.

---

## Field authentication

See `docs/FIELD_AUTH_CONTRACT.md`.

---

## Admin field devices

| Method | Path | Permission |
|--------|------|------------|
| GET | `/admin/field-devices` | `field:device:manage` |
| GET | `/admin/field-devices/:id` | `field:device:manage` |
| POST | `/admin/field-devices/:id/approve` | `field:device:approve` |
| POST | `/admin/field-devices/:id/reject` | `field:device:approve` |
| POST | `/admin/field-devices/:id/suspend` | `field:device:approve` |
| POST | `/admin/field-devices/:id/restore` | `field:device:approve` |
| POST | `/admin/field-devices/:id/mark-lost` | `field:device:approve` |
| POST | `/admin/field-devices/:id/revoke` | `field:device:approve` |
| POST | `/admin/field-devices/:id/require-re-pair` | `field:device:approve` |
| POST | `/admin/field-devices/:id/force-sign-out` | `field:device:approve` |

Supervisor scope enforced by role + jurisdiction (`countryCode`, `stateCode`, `lgaCode`, `agencyId`).

---

## Heartbeat

`POST /field/devices/:publicDeviceId/heartbeat`

Payload: battery, network, permissions, app version, optional coarse location, root risk, crash count.

Default interval: 5–15 minutes operational (client-configurable).

---

## Audit actions

`field.device.registration_challenge`, `registration_submitted`, `approved`, `rejected`, `suspended`, `marked_lost`, `revoked`, `repair_required`, `force_sign_out`, `pairing_completed`, `heartbeat`, `field.auth.login`, `refresh`, `logout`, `lock`, `unlock`.

---

## Module location

`apps/api/src/modules/field-operations/`
