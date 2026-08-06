# Field Role Permission Matrix

**Project:** THE EYE — Phase 7 Field Operations Tablet  
**Sprint:** 1 — Roles, Authentication, Device Registration

---

## Design principle

Field operational roles are **product-facing aliases** mapped to existing `AdminRoleName` values in `@the-eye/shared`. No duplicate database roles were created.

Implementation: `packages/shared/src/field-operations.ts`, `packages/shared/src/permissions.ts`

---

## Operational roles

| Field role | Admin role (DB) | Field app access |
|------------|-----------------|------------------|
| PatrolOfficer | Police/Security Officer | Yes |
| PatrolTeamLead | Agency Admin | Yes |
| CheckpointOfficer | Police/Security Officer | Yes |
| CheckpointCommander | Agency Admin | Yes |
| Dispatcher | Call Center Agent | Yes |
| AgencySupervisor | Agency Admin | Yes + approve devices |
| EmergencyResponder | Police/Security Officer | Yes |
| DroneOperator | Drone Operator | Yes |
| FieldReadOnlyObserver | Read Only Observer | Read-only shell only |

**Not field-eligible:** Super Admin (dashboard-only), Citizen users.

---

## Permission matrix

| Capability | PatrolOfficer | PatrolTeamLead | CheckpointOfficer | CheckpointCommander | Dispatcher | AgencySupervisor | EmergencyResponder | DroneOperator | FieldReadOnlyObserver |
|------------|:-------------:|:--------------:|:-----------------:|:-------------------:|:----------:|:----------------:|:------------------:|:-------------:|:---------------------:|
| Field app access (`field:access`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Register device (`field:device:register`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Operate session (`field:session:operate`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Approve devices (`field:device:approve`) | — | ✓* | — | ✓* | — | ✓ | — | — | — |
| Manage devices (`field:device:manage`) | — | ✓* | — | ✓* | — | ✓ | — | — | — |
| Incident assignment (future sprint) | scoped | scoped | scoped | scoped | ✓ | scoped | ✓ | — | read |
| Patrol mode (future) | ✓ | ✓ | — | — | — | ✓ | — | — | read |
| Checkpoint mode (future) | — | — | ✓ | ✓ | — | ✓ | — | — | read |
| Communication (future Phase 6 reuse) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | read |
| Evidence upload (future) | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | — |
| Backup request (future) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Audit visibility | own device | agency | own device | agency | dispatch | agency | own device | own device | read |

\*Via Agency Admin jurisdiction scope. State/LGA/Country admins inherit approve/manage within jurisdiction.

---

## Scope enforcement

| Scope | Enforcement |
|-------|-------------|
| Agency | `agencyId` on admin user and field device |
| State | `stateCode` match |
| LGA | `stateCode` + `lgaCode` match |
| Country | `countryCode` match |

All permissions enforced **server-side** via JWT guards and field-operations services.

---

## Error codes

| Code | Meaning |
|------|---------|
| FIELD-DEVICE-001 | Registration required |
| FIELD-DEVICE-002 | Approval pending |
| FIELD-DEVICE-003 | Device suspended |
| FIELD-DEVICE-004 | Device marked lost |
| FIELD-DEVICE-005 | Device revoked |
| FIELD-DEVICE-006 | Re-pair required |
| FIELD-AUTH-001 | Role not authorized |
| FIELD-AUTH-002 | Jurisdiction mismatch |
| FIELD-AUTH-003 | Device signature invalid |
| FIELD-AUTH-004 | Session expired |

---

## Sprint 1 scope boundary

Patrol mode, checkpoint mode, operational map, and full incident workspace are **not** included in Sprint 1. This matrix defines foundation permissions only.
