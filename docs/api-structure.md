# API Structure

The NestJS API is organized by domain modules. Each module owns its route handlers, service logic, authorization policy, DTOs, and persistence integration.

## Modules

- auth: login, refresh, password reset, token lifecycle, device sessions.
- users: user profile, responder state, agency membership, role assignment.
- incidents: reporting, triage, status transitions, assignment, escalation, evidence links.
- broadcasts: draft, approval, publication, cancellation, geofence targeting.
- notifications: queueing, delivery tracking, retries, provider adapters.
- storage: presigned upload URLs, evidence metadata, retention policy.
- audit: audit log search, export, and compliance access.

## Initial Endpoints

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| POST | `/v1/auth/login` | Start an authenticated session | Public |
| GET | `/v1/users/me` | Read current user profile | Authenticated |
| GET | `/v1/incidents` | List scoped incidents | `incident:read` |
| POST | `/v1/incidents` | Create a report | `incident:create` |
| GET | `/v1/incidents/:id` | Read one incident | `incident:read` |
| PATCH | `/v1/incidents/:id/status` | Move incident through lifecycle | `incident:update` |
| GET | `/v1/broadcasts` | List broadcasts | Authenticated |
| POST | `/v1/notifications/send` | Enqueue a direct notification | Internal/Admin |
| POST | `/v1/storage/presign` | Create evidence upload URL | Authenticated |
| GET | `/v1/audit` | Search audit logs | `audit:read` |

## API Conventions

- Prefix all routes with `/v1`.
- Use JSON request and response bodies.
- Use cursor pagination for operational queues.
- Include `requestId` in errors and audit metadata.
- Use idempotency keys for incident creation, evidence confirmation, notification jobs, and broadcast publication.
- Do not let clients directly mutate protected fields such as `priority`, `assigned_agency_id`, or `status` outside approved endpoints.

## Error Shape

```json
{
  "statusCode": 400,
  "code": "INCIDENT_INVALID_TRANSITION",
  "message": "Incident cannot move from submitted to resolved",
  "requestId": "req_..."
}
```
