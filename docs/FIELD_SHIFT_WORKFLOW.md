# Field Shift Workflow

Phase 7 Sprint 2 defines agency field shift lifecycle for the operational tablet.

## States

| Status | Meaning |
|--------|---------|
| `PendingApproval` | Shift requested; supervisor approval required |
| `Active` | Officer on duty |
| `Paused` | Shift paused (break) |
| `Ended` | Shift closed |
| `Cancelled` | Supervisor cancelled pending shift |

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/field/shifts/active` | Current shift |
| POST | `/v1/field/shifts/start` | Start shift |
| POST | `/v1/field/shifts/pause` | Pause shift |
| POST | `/v1/field/shifts/resume` | Resume shift |
| POST | `/v1/field/shifts/end` | End shift |
| POST | `/v1/admin/field-operations/shifts/:id/approve` | Supervisor approval |

## Stored fields

- Officer, field device, agency, assigned unit
- Vehicle identifier
- Start/end timestamps and GPS
- Supervisor approval metadata
- `clientActionId` for offline idempotency

## Rules

1. Patrol and checkpoint sessions require an **active** shift.
2. Only one open shift per officer.
3. Ending a shift automatically ends active patrol/checkpoint sessions.
4. Field JWT (`typ: field`) is required for all officer endpoints.
