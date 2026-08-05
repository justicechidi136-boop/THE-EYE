# Incident Lifecycle — Authoritative Backend Contract

**Project:** THE EYE  
**Phase:** Emergency User Journey — Phase 2  
**Status:** Authoritative server contract  
**Source of truth:** `IncidentStatus` enum in `@the-eye/shared` and `apps/api/prisma/schema.prisma`

---

## Design principle

Persist a status only when it affects authorization, dispatch, auditing, notifications, resolution authority, allowed transitions, or operational processing. Display labels, progress steps, and allowed actions are **derived** — never stored in the database.

---

## Persisted states

### Existing (unchanged semantics)

| Status | Purpose |
|--------|---------|
| Submitted | Citizen report accepted |
| Received | Intake acknowledged |
| Verifying | Verification in progress |
| Verified | Report validated |
| Assigned | Agency/responder assigned |
| Responding | Responder en route or active |
| Resolved | Operational resolution recorded |
| Closed | Administrative closure after resolution |
| FalseReport | Invalid report (replaces RejectedAsInvalid) |

### Added in Phase 2

| Status | Purpose |
|--------|---------|
| UnderControl | Responders on scene; situation stabilised |
| CancellationRequested | Reporter requested cancel after assignment; dispatch continues |
| CancelledByReporter | Reporter cancelled before assignment |
| ExpiredAfterReview | Administrative expiry from inactive review states |

### Not persisted as statuses

| Concept | Implementation |
|---------|----------------|
| RejectedAsInvalid | `FalseReport` |
| ResolvedByAgency / Community / Reporter / Dispatcher | `ResolutionSource` field on `Resolved` |
| ClosedByDispatcher | `Closed` + `ResolutionSource` / audit actor |
| Display labels, progress, allowed actions | Derived via `incident-presentation.mapper.ts` |

---

## Resolution source model

Separate enum — does not duplicate lifecycle status:

```
Agency | Dispatcher | Administrator | Reporter | Community | SystemReview
```

Recorded on `incidents.resolution_source` when status becomes `Resolved`.

---

## Main path

```
Submitted → Received → Verifying → Verified → Assigned → Responding → UnderControl → Resolved → Closed
```

---

## Cancellation paths

### Before assignment (direct cancel)

Reporter may cancel from: `Submitted`, `Received`, `Verifying`, `Verified`

→ `CancelledByReporter` (terminal, retained in history)

### After assignment (request cancel)

Reporter may request from: `Assigned`, `Responding`, `UnderControl`

→ `CancellationRequested` (does **not** auto-terminate assignment)

Dispatcher/admin may later approve (`CancelledByReporter`), reject (return to operational state), or resolve normally.

---

## Administrative paths

| From | To | Actor |
|------|-----|-------|
| Any eligible active state | FalseReport | Admin (not OversightAuditor) |
| Submitted, Received, Verifying, Verified | ExpiredAfterReview | Admin |
| Resolved | Closed | Admin (reason required) |

---

## Transition matrix

See `apps/api/src/modules/incidents/incident-lifecycle.ts` — `allowedIncidentTransitions`.

Invalid transitions are rejected server-side with `400 Bad Request`.

---

## Actor permissions

| Actor | Allowed transitions |
|-------|---------------------|
| Reporter (owner) | → `CancelledByReporter` (pre-assignment); → `CancellationRequested` (post-assignment) |
| Admin (scoped) | All valid matrix transitions except OversightAuditor (read-only) |
| Other citizen | None |

---

## Persisted metadata fields (Phase 2)

| Field | When set |
|-------|----------|
| `resolutionSource`, `resolvedById`, `resolutionReason`, `resolvedAt` | → Resolved |
| `cancellationRequestedAt`, `cancellationRequestedById`, `cancellationReason` | → CancellationRequested |
| `cancelledAt`, `cancelledById`, `cancellationReason` | → CancelledByReporter |
| `closureReviewAt` | → Closed, ExpiredAfterReview |
| `statusVersion` | Every transition (+1) |
| `lastTrustedUpdateAt` | Every transition |

---

## API endpoints (lifecycle-related)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/incidents/:id/cancel` | Direct reporter cancel (pre-assignment) |
| POST | `/v1/incidents/:id/request-cancellation` | Reporter cancellation request (post-assignment) |
| PATCH | `/v1/incidents/:id/status` | Admin operational transitions |
| GET | `/v1/incidents/:id/active-emergency` | Derived presentation + allowed actions |

---

## Migration

`20260805120000_emergency_journey_lifecycle` — adds enum values, resolution/cancellation fields, indexes.
