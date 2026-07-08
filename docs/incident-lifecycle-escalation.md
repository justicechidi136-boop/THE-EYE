# Incident Lifecycle and Escalation

THE EYE incident lifecycle is a strict state machine:

`Submitted -> Received -> Verifying -> Verified -> Assigned -> Responding -> Resolved -> Closed`

`FalseReport` is a terminal exception path for invalid or malicious reports.

## Lifecycle Guarantees

Every lifecycle change must write:

- an `incident_timeline` entry.
- an `audit_logs` entry.
- a status-history row through the database trigger.

The API enforces transitions through `incident-lifecycle.ts` and `IncidentsService.updateStatus`.

## Acknowledgement

An incident is considered acknowledged when it moves from `Assigned` to `Responding`.

If a high-priority incident remains `Assigned` beyond a configured escalation rule's maximum response time, the escalation runner creates an `incident_escalations` row and notifies the destination.

## Escalation Rules

Rules can match:

- incident type.
- priority.
- jurisdiction.
- agency.
- maximum response time in seconds.
- escalation destination role, admin, or agency.

## API

- `POST /v1/escalation/rules`: create a rule.
- `GET /v1/escalation/rules`: list rules.
- `PATCH /v1/escalation/rules/:id`: update or disable a rule.
- `POST /v1/escalation/run`: run overdue incident checks. Supports `{ "dryRun": true }`.
- `POST /v1/escalation/:id/acknowledge`: acknowledge an escalation.

## Notifications

When an escalation fires, THE EYE creates in-app notifications for:

- relevant agency admins.
- the escalation destination admin or role.
- Super Admins.

## Audit

Escalation rule creation/update and incident escalation creation/acknowledgement write explicit audit logs. Database audit triggers provide an additional immutable row-change trail.
