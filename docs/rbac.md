# Role-Based Access Control

THE EYE uses permission-based authorization. Roles are bundles of permissions, but route guards should check permissions and resource scope.

## Roles

- citizen: reports incidents and views own reports.
- responder: views assigned incidents and submits field updates.
- dispatcher: triages reports, assigns agencies, coordinates response, drafts broadcasts.
- agency_admin: manages agency users and agency-scoped incidents.
- government_official: views escalations, approves sensitive broadcasts, reviews reports.
- platform_admin: manages global configuration, roles, agencies, and operational data.
- auditor: read-only compliance access to audit records and incident history.

## Permission Matrix

| Permission | Citizen | Responder | Dispatcher | Agency Admin | Official | Platform Admin | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `incident:create` | Yes | Yes | Yes | Yes | Yes | Yes | No |
| `incident:read` | Own | Assigned | Jurisdiction | Agency | Escalated/Policy | All | Read-only |
| `incident:update` | Limited own notes | Assigned | Jurisdiction | Agency | Escalation notes | All | No |
| `incident:assign` | No | No | Yes | Yes | No | Yes | No |
| `incident:escalate` | No | Request | Yes | Yes | Yes | Yes | No |
| `broadcast:create` | No | No | Draft | Agency draft | Draft | Yes | No |
| `broadcast:approve` | No | No | No | Agency only | Yes | Yes | No |
| `audit:read` | No | No | No | Agency scoped | Policy scoped | All | All |
| `user:manage` | No | No | No | Agency scoped | No | All | No |
| `agency:manage` | No | No | No | No | No | All | No |

## Scope Rules

- Citizen access is limited to reports they created unless a public broadcast is involved.
- Responder access is limited to assigned incidents and active response areas.
- Dispatcher access is limited by jurisdiction unless granted cross-agency command access.
- Agency admin access is scoped to their agency.
- Government official access is based on escalation, policy mandate, or broadcast approval responsibility.
- Auditor access is read-only and must be logged.

## Sensitive Operations

Require stronger policy checks for:

- high-severity broadcast approval.
- evidence deletion or retention override.
- role assignment.
- incident closure after escalation.
- exporting audit or incident records.
