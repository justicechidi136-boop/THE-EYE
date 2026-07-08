# Audit Log Architecture

Audit logs provide compliance, accountability, and incident reconstruction. They are append-only from the application point of view.

## Events to Audit

- authentication success, failure, refresh, and logout.
- role, permission, agency, and account changes.
- incident creation, triage, assignment, escalation, resolution, closure, and rejection.
- evidence upload, download, view, deletion request, and retention override.
- broadcast creation, approval, publication, cancellation, and expiration.
- government escalation actions, comments, and decisions.
- administrative exports and report access.

## Record Shape

Each audit record should capture:

- actor id and actor role.
- action name.
- entity type and entity id.
- IP address and user agent.
- before and after state where appropriate.
- metadata with request id, correlation id, provider id, policy id, or approval reference.
- immutable timestamp.

## Integrity Controls

- Write audit records in the same transaction as protected domain changes when possible.
- Restrict audit reads to auditors, platform admins, and policy-authorized officials.
- Log every audit export.
- Consider hash chaining or external write-once storage for high-assurance deployments.
- Partition audit logs monthly and export older partitions to cold storage.

## Privacy

Audit views should redact sensitive citizen PII unless the user has a policy-backed reason to view it. Redaction itself should be consistent and testable.
