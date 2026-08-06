# THE EYE Field Operations — Architecture & Phase 1 Audit

**Phase:** 7 — Field Operations Tablet  
**Product:** THE EYE Field Operations  
**Branch:** `feature/field-operations-tablet`  
**Date:** 2026-08-06  
**Status:** Phase 1 audit complete — implementation gated on this document

---

## 1. Architecture decision

### Options evaluated

| Option | Description | Verdict |
|--------|-------------|---------|
| **A. Dedicated Flutter app** `apps/field-ops-tablet/` | Third Flutter client with its own package IDs, navigation, tablet UX, and release pipeline | **Recommended** |
| **B. Tablet flavor in `apps/mobile`** | Reuse citizen app shell with a `fieldops` product flavor | **Rejected** |

### Decision: **Option A — dedicated app `apps/field-ops-tablet/`**

**Rationale**

1. **Product boundary** — Citizen mobile and field tablet share backend contracts but must not share navigation, permissions surface, or release identity. A flavor in the citizen app risks accidental exposure of citizen flows and complicates Play Store / sideload distribution for agencies.
2. **Package identity** — Staging `com.theeye.fieldops.staging`, production `com.theeye.fieldops` are distinct from `com.theeye.app.staging` / `com.theeye.app`.
3. **UX target** — 10-inch landscape-first operational console cannot be achieved by stretching phone layouts; dedicated scaffold (nav rail + workspace + action panel) is required.
4. **Security** — Device-bound sessions, supervisor pairing, lost-device mode, and screenshot policy differ materially from citizen auth (Firebase social login).
5. **Reuse without coupling** — Extract shared Dart modules later (`packages/field_ops_core` or copy-from-template) rather than coupling to citizen `main.dart` (7k+ lines).
6. **Precedent** — `apps/watch` is already a separate device-class client with its own auth, offline sync, and telemetry; field tablet follows the same pattern at tablet scale.

**Shared code strategy (Phase 2+ implementation)**

| Layer | Source to fork/adapt | Notes |
|-------|---------------------|-------|
| Device auth + offline | `apps/watch/lib/` | Secure storage, heartbeat, offline queue, telemetry |
| API paths + HTTP | `apps/mobile/lib/contracts/` | Extend for `/dispatch/*`, field device routes |
| Design tokens | `apps/mobile/lib/design_system/` | Tablet density overrides, dark-first |
| Incident comms | `apps/mobile/lib/emergency/incident_communication_*` | Responder-facing thread |
| Evidence upload | `apps/mobile/lib/evidence/` | Presign → upload → confirm |
| Shared enums | `packages/shared` | Extend with field route types, device status |

---

## 2. Repository inventory (audit)

### Applications

| App | Path | Role |
|-----|------|------|
| API | `apps/api` | NestJS + Prisma backend |
| Admin web | `apps/admin-web` | Full CSOC / dispatch console (not replaced) |
| Mobile | `apps/mobile` | Citizen Flutter app (not replaced) |
| Watch | `apps/watch` | Wear OS SOS device client |
| Shared | `packages/shared` | TS enums, permissions, contracts |

**No `apps/field-ops-tablet` exists today.**

### Backend modules relevant to field ops

| Module | Status | Field-ops relevance |
|--------|--------|---------------------|
| `dispatch` | **Mature** | Assignments, responders, location, backup, notes |
| `incident-communications` | **Complete (Phase 6)** | Reporter/dispatcher/responder messaging |
| `incidents` | **Mature** | Lifecycle, evidence, active emergency |
| `notifications` | **Mature** | FCM + in-app; needs field route types |
| `drone-surveillance` | **Exists** | Missions, operators (role-gated) |
| `neighborhood-watch` | **Exists** | Community patrol/checkpoint (not agency field ops) |
| `smartwatch` / `watch-fleet` | **Exists** | Device registration pattern to mirror |
| `citizen-activity` | **Exists** | Citizen history only |
| `audit` | **Mature** | Hash-chain audit log |
| `storage` | **Mature** | Evidence presign |
| `police-stations` | **Exists** | Map layer |
| `broadcasts` | **Mature** | Missing person, stolen vehicle, public safety |

### Prisma models

| Model | Exists | Gap for Phase 7 |
|-------|--------|-----------------|
| `IncidentAssignment` | Yes | Map tablet states to existing FSM; add `UnderControl` alias if needed |
| `Responder` | Yes | Link to admin user; availability + GPS |
| `ResponseUnit` | Yes | Team/vehicle |
| `FieldDevice` | **No** | New model required |
| `FieldShift` | **No** | New model required |
| `AgencyPatrol` / `AgencyCheckpoint` | **No** | NW `PatrolSchedule` is community-scoped only |
| `FieldBackupRequest` | **No** | Partial via `POST /dispatch/assignments/:id/request-backup` |
| `PrivateSighting` | **No** | New model for operational BOLO sightings |
| `SmartwatchDevice` | Yes | Reference for device registration pattern |

**Existing assignment statuses** (`IncidentAssignmentStatus`):  
`Proposed`, `Assigned`, `Accepted`, `Declined`, `Expired`, `Reassigned`, `EnRoute`, `Arrived`, `InProgress`, `Completed`, `Cancelled`

**Phase 7 target mapping**

| Phase 7 state | Maps to |
|---------------|---------|
| Offered | `Proposed` / `Assigned` |
| Accepted | `Accepted` |
| Rejected | `Declined` |
| EnRoute | `EnRoute` |
| Arrived | `Arrived` |
| OnScene | `InProgress` |
| UnderControl | `InProgress` + metadata flag or new enum value |
| Resolved | `Completed` |
| Cancelled | `Cancelled` |
| Reassigned | `Reassigned` |

### Admin web (existing)

| Area | Path | Field-ops gap |
|------|------|---------------|
| Emergency command | `app/dispatch/` | Dispatcher console — reuse APIs, not tablet UI |
| Agency dispatch | `app/dispatch/agency/` | Same |
| Incident detail + comms | `app/dispatch/incidents/[id]/` | Communication panel exists |
| Smartwatch fleet | `app/devices/smart-watches/` | No field tablet fleet |
| NW patrol | `app/neighborhood-watch/patrols/` | Community patrol only |

### Notification routing (existing)

File: `apps/api/src/modules/notifications/notification-routing.schema.ts`

Current route types: `OWN_ACTIVE_INCIDENT`, `OWN_INCIDENT_DETAILS`, `COMMUNITY_VERIFICATION`, `BROADCAST_DETAILS`, `SYSTEM`

**Missing for Phase 7:** `FIELD_ASSIGNMENT`, `FIELD_INCIDENT`, `FIELD_MESSAGE`, `FIELD_BACKUP_REQUEST`, `FIELD_BROADCAST`, `FIELD_CHECKPOINT_ALERT`, `FIELD_DRONE_MISSION`

---

## 3. Gap matrix

| # | Capability | Existing | Reusable code | Tablet requirement | Missing API | Missing model | Missing UI | Security concern | Tests required |
|---|------------|----------|---------------|-------------------|-------------|---------------|------------|------------------|----------------|
| 1 | Dedicated tablet app | No | watch + mobile patterns | Landscape 10" app | — | — | Entire app | Wrong app identity if flavor | App scaffold, navigation |
| 2 | Package IDs | Citizen/watch only | Flavor pattern in mobile | `com.theeye.fieldops[.staging]` | — | — | Android/iOS config | Certificate pinning per app | Build CI job |
| 3 | Field device registration | Smartwatch only | `smartwatch` module, watch client | Approve/revoke/lost | `POST /field/devices/register`, heartbeat | `FieldDevice` | Registration wizard | Raw serial exposure | Device revoke, lost mode |
| 4 | Field authentication | Admin JWT + citizen Firebase | watch secure store | Officer login, PIN, biometric | Field session endpoints | Device-session link | Login + lock screen | Plaintext credentials | Revoked device, wrong jurisdiction |
| 5 | Operational roles | Admin roles + `UserRole.Responder` | `permissions.ts` | PatrolOfficer, CheckpointOfficer, etc. | Role mapping API | Optional `FieldRole` enum | Role-aware nav | Client-only permission UI | Server scope tests |
| 6 | Jurisdiction scope | Agency admin scoping | `IncidentScopeGuard` | Country/state/LGA/agency | Existing guards | — | Jurisdiction badge | Cross-jurisdiction search | Scope 404 tests |
| 7 | Shift management | None | — | Start/end shift, team | `/field/shifts/*` | `FieldShift`, `FieldShiftMember` | Shift bar on home | Shift without approval | Shift lifecycle |
| 8 | Patrol mode (agency) | NW community patrol | NW API shape only | Zone, vehicle, team lead | `/field/patrols/*` | `AgencyPatrol`, `PatrolZone` | Patrol dashboard | Public patrol conflation | Patrol start/end |
| 9 | Checkpoint mode | NW checkpoint | NW checkpoint model | Registration search, BOLO | `/field/checkpoints/*` | `AgencyCheckpoint` | Checkpoint dashboard | Unlawful PII collection | Checkpoint + sighting |
| 10 | Assignment list | `/dispatch/responders/me/assignments` | `dispatch.service.ts` | Large cards, accept/reject | Extend notifications | — | Assignment inbox | Accept unassigned | Transition FSM |
| 11 | Assignment transitions | `PATCH /dispatch/assignments/:id` | DTO validation | En route, arrived, etc. | Validate all Phase 7 states | — | Action buttons | Invalid transition | Invalid transition tests |
| 12 | Incident workspace | Admin dispatch detail | mobile emergency contracts | Tablet workspace | `GET /dispatch/incidents/:id` | — | Split map + timeline | Unassigned access | Scope + assignment |
| 13 | Communication | Phase 6 complete | `incident-communications` | Responder labels | Existing `/incidents/:id/messages` | — | Comms panel | Internal message leak | Access 404 tests |
| 14 | Live map | Admin CSS mock | mobile maps, police-stations | Operational layers | Map aggregation endpoint | — | Map screen | Citizen location leak | Layer authorization |
| 15 | GPS telemetry | Assignment location POST | watch location service | Staged intervals, battery | `/field/telemetry` batch | `FieldTelemetryPoint` | GPS quality badge | Tracking after revoke | Stop on sign-out |
| 16 | Broadcasts / BOLO | Broadcasts module | mobile broadcast services | Filter + sighting | Private sighting API | `OperationalSighting` | Broadcast list | Public comment as sighting | Private sighting ACL |
| 17 | Drone missions | `drone-surveillance` | Admin drone pages | Read-only map layer | Existing drone APIs | — | Mission card | Flight control scope | DroneOperator role |
| 18 | Field incident create | Dispatcher create | mobile submission | Official field report | `POST /field/incidents` | metadata flag | Create form | Auto-public exposure | Visibility policy |
| 19 | Request backup | Partial | `request-backup` on assignment | One-tap types | Extend backup types | `FieldBackupRequest` | Backup FAB | Spam / false alarm | Priority confirmation |
| 20 | Offline-first | Watch queue | watch offline sync | Full operational queue | `/field/sync` batch | — | Sync status UI | False confirmed state | Idempotency replay |
| 21 | Notifications | Schema v1 citizen routes | push routers | Field deep links | New route types | — | Notification handler | FCM body leakage | Deep link auth |
| 22 | Admin field mgmt | Smartwatch fleet only | devices UI pattern | Field devices, shifts | Admin BFF routes | — | Admin pages | Cross-jurisdiction admin | Approval workflow |
| 23 | Audit | Hash-chain audit | `audit.service.ts` | Field action catalog | Existing audit | — | — | Coordinate logging | Action coverage |
| 24 | Tablet design system | Mobile design system | `eye_design_system` | 48–56dp, nav rail | — | — | Tablet components | Touch target failures | Widget tests |
| 25 | Super Admin on tablet | Admin web only | — | Block or restricted support session | Policy flag | — | Hidden nav | Privilege escalation | Super admin blocked |

---

## 4. Recommended implementation sequence

| Sprint | Phases | Deliverable |
|--------|--------|-------------|
| **7.1** | 1–5 | Audit (this doc), product boundary, roles, Prisma `FieldDevice`, field auth API |
| **7.2** | 6–8 | Tablet app scaffold, design system, home dashboard, patrol mode API + UI |
| **7.3** | 9–11 | Checkpoint mode, assignment workflow hardening |
| **7.4** | 12–16 | Incident workspace, comms, map, telemetry, broadcasts |
| **7.5** | 17–22 | Drone read-only, field incident, backup, offline, notifications, security |
| **7.6** | 23–26 | Audit, admin pages, API contracts, automated tests |
| **7.7** | 27–29 | Physical tablet QA, docs, PR |

---

## 5. API reuse vs new surface

**Reuse as-is (tablet client calls existing endpoints)**

- `GET/PATCH /dispatch/responders/me`
- `GET /dispatch/responders/me/assignments`
- `PATCH /dispatch/assignments/:id`
- `POST /dispatch/assignments/:id/location`
- `POST /dispatch/assignments/:id/request-backup`
- `GET /dispatch/incidents/:id`
- `GET/POST /incidents/:id/messages` (Phase 6)
- `GET /broadcasts/*` (scoped)
- `GET /drone/*` (role-gated)
- `POST /storage/presign` (evidence)

**New modules/endpoints required**

- `field-devices` — register, approve, heartbeat, revoke, lost
- `field-shifts` — start, end, join, transfer command
- `field-patrols` — agency patrol lifecycle (distinct from NW)
- `field-checkpoints` — agency checkpoint lifecycle
- `field-sightings` — private operational sightings
- `field-sync` — offline batch replay
- `field-telemetry` — device location batches
- `field-incidents` — official field-created incidents
- Admin BFF under `app/api/admin/field-ops/`

---

## 6. Security findings (audit)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Super Admin unrestricted tablet login | High | Deny default; optional audited break-glass policy |
| Client-inferred permissions from UI | High | Server guards on every mutation; 404 for out-of-scope |
| Citizen app reused for field ops | Medium | Dedicated app (decision A) |
| FCM payload leakage | Medium | Schema v1 metadata only; no message bodies |
| Device theft | High | Remote revoke, lost mode, session kill, encrypted storage |
| Cross-jurisdiction assignment view | High | Extend `IncidentScopeGuard` + assignment ownership checks |
| Checkpoint PII over-collection | High | Policy-driven fields; audit + retention docs |
| Offline queue replay attacks | Medium | Idempotency keys + device binding |
| Root/debug builds in production | Medium | Build flavor guards; optional attestation |

---

## 7. References

- `docs/AGENCY_DISPATCH_ARCHITECTURE.md`
- `docs/INCIDENT_COMMUNICATION_CONTRACT.md`
- `docs/NOTIFICATION_SCHEMA_V1.md`
- `docs/smartwatch-sos-devices.md`
- `apps/api/src/modules/dispatch/`
- `apps/watch/lib/services/sos_service.dart` (offline queue pattern)
- `apps/mobile/lib/design_system/`

---

**Gate:** No Phase 7 implementation PRs merge until this audit is reviewed and the gap matrix rows for the current sprint are assigned.
