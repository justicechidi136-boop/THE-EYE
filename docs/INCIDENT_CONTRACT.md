# THE EYE — Canonical Incident Contract (Sprint 3)

**Status:** Approved for Sprint 3 implementation  
**Baseline branch:** `staging` @ `45c2197`  
**Last updated:** 2026-07-22

This document defines the server-authoritative incident contract. Clients may submit intake fields only; verification, assignment, and protected operational states are server-controlled.

---

## Identity and intake

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `incidentId` | UUID | Server | Stable primary key returned on create |
| `clientSubmissionId` | string | Client header `x-client-submission-id` | Idempotency key; dedupe on retry |
| `reporterId` | UUID \| null | Server from JWT | Null when anonymous |
| `anonymous` | boolean | Client + server | Server sets `isAnonymous`; anonymous requires no reporter linkage in citizen responses |
| `type` | `IncidentType` enum | Client | Allowlist validated server-side |
| `title` | string | Client optional / server default | Max length enforced in DTO |
| `description` | string | Client | Required, min 5 chars |
| `priority` | `IncidentPriority` enum | Server default by type | Client override validated against allowlist |

---

## Location and time

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `latitude` / `longitude` | number | Client capture | Validated −90..90 / −180..180 |
| `accuracyMeters` | number \| null | Client optional | Stored on location updates |
| `manualLatitude` / `manualLongitude` | number \| null | Client | User-adjusted pin |
| `manualAddress` / `address` | string \| null | Client | Display label only |
| `occurredAt` | ISO8601 UTC | Client optional (`occurredAt` in metadata until dedicated column) | Original capture/event time |
| `reportedAt` / `submittedAt` | ISO8601 UTC | Server | Server receipt time (`submittedAt`) |
| `country` / `state` / `lga` | string | **Server derived** | From PostGIS jurisdiction lookup; client values never trusted |
| `jurisdictionId` | UUID | Server | Assigned from boundary match or scoped actor fallback |

**Rules:** Do not trust client-supplied jurisdiction. Derive geography server-side from coordinates. Preserve client capture time separately from server receipt time. All persisted timestamps are UTC (`timestamptz`).

---

## Status model

### Operational status (`IncidentStatus`)

Explicit enum — no free-form strings:

`Submitted` → `Received` → `Verifying` → `Verified` → `Assigned` → `Responding` → `Resolved` → `Closed`

Terminal / alternate: `FalseReport`, `Cancelled` (where policy allows citizen cancel).

Transitions enforced by `canTransitionIncident()` in `incident-lifecycle.ts`. Admin/agency roles only for protected transitions. Citizens may cancel only under approved rules (future: `Submitted`/`Received` only).

### Verification (separate from operational status)

Tracked in `IncidentVerification` records and verification dashboard — not a parallel free-form status string on the incident row.

| Verification result | Meaning |
|--------------------|---------|
| Auto score + admin review | `IncidentVerification.result`, confidence |
| Admin decision | `confirm` / `reject` / `needs_more_evidence` via `/verification/incidents/:id/admin-review` |

Citizens see safe explanations mapped from operational status + latest verification outcome.

---

## Assignment and responders

| Field | Type | Writable by |
|-------|------|-------------|
| `assignedAgencyId` | UUID \| null | Admin with `incident:assign` |
| `assignedAdminId` | UUID \| null | Admin with `incident:assign` |

Clients cannot PATCH assignment fields directly on report.

---

## Evidence

| Field | Type | Notes |
|-------|------|-------|
| `evidenceCount` | number | Derived from `IncidentMedia` rows |
| Media items | array | Presign → direct upload → confirm → attach |
| Metadata per item | object | `captureTime`, GPS, `mediaType`, `duration`, `sizeBytes`, `checksum` (`fileHash`) |
| Read access | short-lived signed GET URL | Issued on view/download; not permanent public URLs |

Flow: `POST /incidents/:id/media/presign` → S3 PUT → `POST /incidents/:id/media/confirm`.

---

## Live location (active emergency)

| Field | Type | Notes |
|-------|------|-------|
| `currentLocation` | `{ latitude, longitude, accuracyMeters, capturedAt }` | Latest from `IncidentLocationUpdate` |
| Location stream | ordered updates | `POST /incidents/:id/location` — reporter device or authorized responder only |

Do not run continuous GPS outside an active emergency session.

---

## Live video

| Field | Type | Notes |
|-------|------|-------|
| `liveVideoSession` | session object \| null | LiveKit room bound to incident |
| Tokens | short-lived | Role-based; no dev fallback keys in staging/production |

If LiveKit credentials missing → feature **BLOCKED**, not simulated success.

---

## History and audit

| Collection | Source |
|------------|--------|
| `statusHistory` | `IncidentStatusHistory` (+ application writes on transition) |
| `timeline` | `IncidentTimeline` events |
| Audit events | `AuditService` — create, view, status change, evidence access, assignment |

Every meaningful status change creates timeline + audit entries.

---

## Notifications

Events: received, verification result, assignment, responder update, request for more information, resolution, rejection, watch SOS acknowledgement.

Delivery via `NotificationsService.create()` → BullMQ enqueue. If Redis/FCM not configured → **BLOCKED** (not fake success).

---

## Authorization and privacy

| Rule | Enforcement |
|------|-------------|
| Citizen list/detail | Own incidents only (`reporterId` scope) |
| Admin list/detail | Jurisdiction + role matrix |
| Anonymous reporter identity | Hidden from unauthorized roles in API responses |
| Rate limiting | `incidentCreate` on report endpoints |
| Idempotency | `x-client-submission-id` dedupe prevents duplicate incidents on retry |

---

## API surface (Sprint 3 canonical)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/incidents/report` | Standard create (auth or anonymous) |
| POST | `/v1/incidents/emergency` | Emergency fast path |
| GET | `/v1/incidents` | Paginated citizen/admin list |
| GET | `/v1/incidents/:id` | Detail with media, timeline, statusHistory |
| PATCH | `/v1/incidents/:id/status` | Admin operational transition |
| PATCH | `/v1/incidents/:id/assign` | Admin assignment |
| POST | `/v1/incidents/:id/location` | Live location update |
| POST | `/v1/incidents/:id/media/presign` | Evidence upload presign |
| POST | `/v1/incidents/:id/media/confirm` | Evidence confirm |
| GET | `/v1/incidents/:id/media/:mediaId/view` | Signed read URL + audit |
| GET | `/v1/incidents/:id/media/:mediaId/download` | Signed download + audit |
| POST | `/v1/verification/incidents/:id/admin-review` | Verify / reject / needs evidence |
| POST | `/v1/smartwatch/sos` | Watch SOS → incident linkage |

---

## Response shape (create)

```json
{
  "id": "uuid",
  "status": "Submitted",
  "priority": "P2ActiveCrimeAccident",
  "submittedAt": "2026-07-22T00:00:00.000Z",
  "fastPath": false,
  "duplicate": false
}
```

On idempotent retry, same `id` returned with `"duplicate": true` — never a fake new success.

---

## Client restrictions

Clients **must not** send or mutate:

- `verificationStatus` as authority
- `assignedAgencyId` / `assignedAdminId`
- `country` / `state` / `lga` as trusted values
- Protected operational status transitions

All timestamps sent by clients are treated as capture hints; server stores UTC receipt separately.
