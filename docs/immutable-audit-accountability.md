# THE EYE Immutable Audit and Accountability

## Purpose

THE EYE audit logs are an append-only accountability ledger for high-risk public safety actions.

Logged actions include:

- `incident.created`
- `incident.viewed`
- `incident.status_changed`
- `incident.assigned`
- `incident.closed`
- `incident.marked_false`
- `evidence.viewed`
- `evidence.downloaded`
- `broadcast.approved`
- `broadcast.rejected`
- `admin.login`
- `escalation.triggered`

## Immutability

`audit_logs` is protected by database triggers:

- UPDATE is rejected.
- DELETE is rejected.
- Admin UI exposes read-only views only.

Normal admin workflows cannot edit or delete audit records.

## Hash Chain

Each audit event stores:

- `sequence`
- `previous_hash`
- `event_hash`
- `chain_version`
- `reason`
- actor, action, entity, before/after state, metadata, timestamp

`event_hash` is SHA-256 over canonical event payload plus the previous hash. This makes event removal, insertion, or mutation detectable.

The endpoint `GET /audit/verify-chain` checks chain continuity.

## Required Reasons

The API rejects:

- Closing an incident without a reason.
- Marking an incident false without a reason.
- Rejecting a broadcast without a reason.

Reasons are stored in the top-level `reason` column and in related status/rejection fields where applicable.

## Oversight Auditor

Oversight Auditor has `audit:read` and can view audit logs and verify the chain, but cannot modify incidents.

## API

- `GET /audit`: list immutable logs with optional filters.
- `GET /audit/verify-chain`: verify hash-chain continuity.
- `GET /incidents/:id/media/:mediaId/view`: log evidence view.
- `GET /incidents/:id/media/:mediaId/download`: log evidence download.
- `PATCH /incidents/:id/assign`: assign incident and log assignment.
- `PATCH /incidents/:id/status`: logs status changes and enforces reasons for closure/false reports.
