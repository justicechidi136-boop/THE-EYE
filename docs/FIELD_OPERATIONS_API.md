# Field Operations API

**Project:** THE EYE — Phase 7 Sprint 1  
**Base path:** `/v1`

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
