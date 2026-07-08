# Incident Lifecycle

Incidents move through a controlled state machine. Every status change writes an `incident_status_events` record and an audit log.

## Statuses

- submitted: report received from a citizen or operator.
- triaged: dispatcher reviewed type, severity, location, and duplicate risk.
- assigned: agency or responder has ownership.
- in_progress: response is actively underway.
- escalated: higher authority or government intervention is required.
- resolved: field response is complete.
- closed: administrative review is complete.
- rejected: invalid, malicious, duplicate, or out-of-scope report.

## Allowed Transitions

| From | To |
| --- | --- |
| submitted | triaged, rejected |
| triaged | assigned, escalated, rejected |
| assigned | in_progress, escalated |
| in_progress | resolved, escalated |
| escalated | assigned, in_progress, resolved |
| resolved | closed |
| closed | none by default |
| rejected | none by default |

## SLA Watchers

BullMQ scheduled jobs should monitor:

- critical incidents not triaged within the target window.
- assigned incidents without responder acknowledgement.
- repeated reports in the same geospatial cluster.
- unresolved escalations.
- incidents near sensitive sites or high-risk areas.

## Duplicate and False Reports

Potential duplicates should be linked rather than deleted. False reports should move to `rejected`, preserve evidence, and retain audit records for investigation.

## Reopen Policy

Closed or rejected incidents can only reopen through a privileged workflow. Reopen actions must capture reason, actor, previous state, and approval reference.
