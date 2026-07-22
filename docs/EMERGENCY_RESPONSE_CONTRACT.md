# THE EYE — Emergency Response Contract (Sprint 6)

**Status:** Approved for Sprint 6 implementation planning  
**Baseline branch:** `staging` @ `7d71615` (post Sprint 5 merge)  
**Implementation branch:** `feature/sprint-6-emergency-response-command-center`  
**Last updated:** 2026-07-22  
**Supersedes / extends:** `docs/INCIDENT_CONTRACT.md` (Sprint 3 intake remains authoritative for citizen report fields)

This document defines the canonical emergency-response lifecycle from SOS/report through resolution. It separates **intake**, **operational incident status**, **verification/triage**, **dispatch assignment**, and **responder availability**. Clients cannot set protected operational states.

---

## Emergency categories (citizen-facing)

Map to existing `IncidentType` enum — **do not invent conflicting values**.

| Citizen category | `IncidentType` | Notes |
|------------------|----------------|-------|
| Security / Crime | `Crime`, `SuspiciousActivity` | Dispatcher may refine |
| Medical | `Medical` | |
| Fire | `Fire` | |
| Road / Traffic | `Accident` | |
| Domestic violence | `Abuse` | Anonymous rules apply |
| Kidnapping / Abduction | `Kidnapping` | |
| Missing child | `MissingPerson` | Child metadata via existing missing-person flows |
| Natural disaster | `Emergency` | General P1 bucket until dedicated enum if needed |
| Silent / covert SOS | `SOS` + `silent: true` metadata | No visible alert UX on device; server-side flag |
| Other | `Emergency` | Requires short description |

Watch `SmartwatchEmergencyMode` values must map 1:1 into the above without new server enums where possible.

---

## Operational incident lifecycle

### Implemented today (`IncidentStatus` in Prisma)

```
Submitted → Received → Verifying → Verified → Assigned → Responding → Resolved → Closed
Terminal: FalseReport
```

Enforced by `apps/api/src/modules/incidents/incident-lifecycle.ts`.

### Sprint 6 target lifecycle (server-authoritative)

| Phase | Status | Writable by | Maps to current enum |
|-------|--------|-------------|----------------------|
| Intake draft (local only) | `Draft` | Client local | — (not persisted) |
| Offline queued | `QueuedOffline` | Client local queue | — (pending submission store) |
| Submitted | `Submitted` | Server on accept | ✅ `Submitted` |
| Received | `Received` | Server triage worker | ✅ `Received` (today underused) |
| Under triage | `UnderTriage` | Triage engine / dispatcher | ↔ `Verifying` |
| Verified | `Verified` | Verification service / dispatcher | ✅ `Verified` |
| Awaiting assignment | `AwaitingAssignment` | Server after verify | ↔ `Verified` + no assignment |
| Assigned | `Assigned` | Dispatcher | ✅ `Assigned` |
| Responder accepted | `ResponderAccepted` | Responder / server | ↔ `Assigned` + assignment status |
| En route | `ResponderEnRoute` | Responder | ↔ `Responding` (partial) |
| Arrived | `ResponderArrived` | Responder | New milestone (timeline event) |
| In progress | `InProgress` | Responder | ↔ `Responding` |
| Resolved | `Resolved` | Responder / dispatcher | ✅ `Resolved` |
| Closed | `Closed` | Dispatcher | ✅ `Closed` |
| Rejected | `Rejected` | Dispatcher | ↔ `FalseReport` or verification reject |
| Cancelled | `Cancelled` | Citizen (policy) / dispatcher | **Schema gap** — add enum or map to timeline |
| Escalated | `Escalated` | SLA engine | Separate `IncidentEscalation` row today |

**Rule:** Until schema migration, store granular milestones in `IncidentTimeline` + `DispatchEvent` while keeping `Incident.status` on the implemented enum subset.

### Verification state (separate from operational status)

Same as Sprint 3: `IncidentVerification` records + admin review. Triage outputs attach to verification/timeline — not a free-form string on `Incident`.

---

## Assignment lifecycle (`IncidentAssignment` — Sprint 6 target model)

| Status | Meaning |
|--------|---------|
| `Proposed` | Routing engine recommendation, not yet committed |
| `Assigned` | Dispatcher committed assignment |
| `Accepted` | Responder acknowledged |
| `Declined` | Responder declined with reason |
| `Expired` | Acceptance window elapsed |
| `Reassigned` | Superseded by new assignment row |
| `Arrived` | Responder on scene |
| `Completed` | Operational work finished |
| `Cancelled` | Assignment voided |

**Rules:**
- Assignments are **idempotent** (`clientAssignmentId` or deterministic job id).
- Reassignment preserves chain (`previousAssignmentId`).
- Only agency-scoped roles accept/update assignments for their agency.
- Dispatcher claim uses optimistic lock / row version to prevent races.

---

## Responder availability (Sprint 6 target model)

| Status | Meaning |
|--------|---------|
| `Offline` | Not accepting assignments |
| `Available` | Can receive new assignment |
| `Busy` | At capacity |
| `EnRoute` | Active assignment, traveling |
| `OnScene` | Active assignment, arrived |
| `OutOfService` | Admin-disabled |

**Rules:**
- Availability transitions server-validated; client heartbeats are hints only.
- Responder belongs to exactly one primary `agencyId` for dispatch scope.
- Conflicting assignments blocked by policy (configurable max concurrent).

---

## Intake fields (mobile / watch SOS)

Extends Sprint 3 report contract:

| Field | Source | Notes |
|-------|--------|-------|
| `clientSubmissionId` | Client header | Idempotency |
| `type` / category | Client | Mapped to `IncidentType` |
| `silent` | Client | Boolean; silent SOS policy |
| `description` | Client optional | Max length |
| `latitude` / `longitude` / `accuracyMeters` | Client GPS | Validated |
| `capturedAt` | Client | UTC |
| `deviceId` | Client | Mobile or smartwatch device id |
| `batteryLevel` / `networkType` | Client optional | Telemetry metadata |
| `emergencyContactIds` | Client optional | Subset of saved contacts |
| `notifyEmergencyContacts` | Client | Server enqueues SMS/push via Sprint 4 pipeline |
| `jurisdictionId` | **Server derived** | PostGIS — never trust client |
| `priority` | **Server** | Triage engine output |
| `status` | **Server** | Initial `Submitted` |

---

## Location streams

### Citizen / watch (active emergency only)

- Endpoint: `POST /v1/incidents/:id/location` (exists)
- Watch GPS: `POST /v1/smartwatch/devices/:deviceId/gps` (exists)
- Live video GPS: `POST /v1/live-video/sessions/:sessionId/location` (exists)
- **Rules:** stream starts only during active emergency; stops on cancel/resolve; offline queue with ordered replay; unauthorized users denied.

### Responder (Sprint 6)

- Endpoint: `POST /v1/dispatch/assignments/:id/location` (target)
- Authorized only while assignment active
- Stored in `ResponderLocationUpdate` or assignment-scoped table

---

## ETA and routing

| Capability | Status |
|------------|--------|
| Haversine / PostGIS distance | Required baseline |
| Straight-line ETA label | Must be labelled "approximate" |
| External navigation link | Google Maps URI (exists on some admin pages) |
| Road ETA provider | **BLOCKED** until maps API configured |

---

## Communications

| Channel | Integration point |
|---------|-------------------|
| Push / in-app | `NotificationsService` + BullMQ (Sprint 4) |
| SMS emergency contacts | `NotificationDispatcherService` sms provider |
| In-app incident messages | Sprint 6 typed conversation API (target) |
| LiveKit A/V | `LiveVideoService` + `LiveKitTokenService` (exists) |

**Rules:** incident-bound rooms; no cross-incident access; no raw tokens in logs; recording only if policy + infra exist.

---

## Privacy and anonymity

- Anonymous reports: citizen identity hidden in citizen-facing API shapes (existing rules).
- Exact citizen location **not** exposed to community members or unauthorized admins.
- Responder sees operational need-to-know fields only.
- Silent SOS: minimize on-device cues per approved policy.

---

## Cancellation

| Actor | Allowed when | Audit |
|-------|--------------|-------|
| Citizen | Policy window (e.g. before `ResponderEnRoute`) | Required |
| Dispatcher | Any non-terminal state with reason | Required |
| System | Duplicate / abuse detection | Required |

---

## Audit events (minimum)

`incident.created`, `incident.triage`, `incident.verified`, `incident.assigned`, `assignment.accepted`, `assignment.declined`, `incident.status_changed`, `incident.location_updated`, `incident.escalated`, `incident.resolved`, `incident.cancelled`, `live_video.started`, `communication.message_sent`.

---

## Explicitly BLOCKED in Sprint 6 (without hardware/policy)

- Fall detection triggers
- Heart-rate emergency triggers
- Physical hardware button SOS (unless device firmware already emits standard SOS API event)
- Road ETA without configured provider
- Simulated responder success or fake map markers

---

## Dependency map

| Dependency | Existing integration | Sprint 6 usage |
|------------|---------------------|----------------|
| Redis / BullMQ | `queue-config.ts`, workers | Dispatch notifications, SLA jobs |
| FCM | `fcm.provider.ts` | Citizen/responder push |
| S3 | `s3-presign.ts` | Evidence (existing) |
| LiveKit | `livekit-token.service.ts` | Incident live video |
| SMS / email | providers (often disabled) | Emergency contacts — **BLOCKED** until webhook configured |
| PostGIS | jurisdiction + police nearest | Agency routing |

If dependency unavailable → status **BLOCKED**, not simulated success.
