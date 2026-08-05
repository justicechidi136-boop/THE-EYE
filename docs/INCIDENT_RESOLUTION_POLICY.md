# Incident Resolution Policy

**Project:** THE EYE  
**Phase:** Emergency User Journey — Phase 2

---

## Overview

Resolution authority is tracked separately from lifecycle status. A single `Resolved` status covers all resolution actors; **`ResolutionSource`** records who resolved the incident and why.

---

## ResolutionSource values

| Value | Typical actor |
|-------|---------------|
| Agency | Responder/agency completes assignment |
| Dispatcher | Call centre operator |
| Administrator | LGA/state/country/agency admin |
| Reporter | Reporter confirms situation resolved (future Phase 3 worker) |
| Community | Community verification consensus (future) |
| SystemReview | Automated review/expiry worker |

---

## When resolution is recorded

Status transition to `Resolved` sets:

- `resolvedAt`
- `resolvedById` (actor UUID)
- `resolutionReason` (note)
- `resolutionSource` (inferred from actor role unless explicitly supplied)

Inference rules (server):

- Citizen user → `Reporter`
- CallCenterAgent → `Dispatcher`
- Other admin → `Administrator`
- Default fallback → `Agency`

---

## Closure policy

`Closed` is only valid after `Resolved`. A reason is required.

`closureReviewAt` is set on `Closed` and `ExpiredAfterReview`.

---

## Cancellation vs resolution

| Action | Status | Terminal | Assignment impact |
|--------|--------|----------|-------------------|
| Reporter direct cancel | `CancelledByReporter` | Yes | N/A (pre-assignment) |
| Reporter cancel request | `CancellationRequested` | No | Assignment continues |
| Admin false report | `FalseReport` | Yes | Operational stop |
| Admin expiry | `ExpiredAfterReview` | Yes | Review complete |
| Operational resolve | `Resolved` | No (until Closed) | Assignment may complete |

Reporter **cannot** silently close an operational incident. After assignment, cancel flows through `CancellationRequested` for dispatcher review.

---

## Reporter confirm-resolved (Phase 2 scope)

`allowedActions.confirmResolved` is derived when:

- Status is `Responding` or `UnderControl`
- Reporter owns the incident
- Active assignment exists

The dedicated confirm-resolved endpoint and resolution worker are **deferred to Phase 3**. Phase 2 establishes the contract field only.

---

## Audit requirements

Every resolution and cancellation transition creates:

1. Timeline event (`incident.status_changed`, `incident.cancelled_by_reporter`, or `incident.cancellation_requested`)
2. Status history row
3. Immutable audit log entry
4. `statusVersion` increment

---

## Database fields

```prisma
resolutionSource         ResolutionSource?
resolvedById             String?
resolutionReason         String?
resolvedAt               DateTime?
cancellationRequestedAt  DateTime?
cancellationRequestedById String?
cancellationReason       String?
cancelledAt              DateTime?
cancelledById            String?
statusVersion            Int @default(1)
lastTrustedUpdateAt      DateTime?
closureReviewAt          DateTime?
```

Migration: `20260805120000_emergency_journey_lifecycle`
