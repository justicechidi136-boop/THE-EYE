# Field Permission Delegation Policy

This document describes how "THE EYE" prevents any admin from granting a
field device or officer more capability than that admin is themselves
trusted with — the core rule behind
[Field Permission Profiles](./FIELD_PERMISSION_PROFILES.md) and
[Pre-Provisioning](./FIELD_DEVICE_PREPROVISIONING.md).

## The problem

Field permission profiles, per-device overrides, and pre-provisioning grants
all ultimately let *an admin user* decide what a field device can do. Without
a delegation ceiling, a lower-privileged admin role could grant a device
capabilities that role has no business handing out (e.g. broad supervisory
control), effectively laundering privilege through a device record.

## The mechanism: `FIELD_SUPERVISOR_GRANT_CEILINGS`

`packages/shared/src/field-permission-catalog.ts` defines a fixed map from
`AdminRoleName` to the maximum set of field capability permissions that role
may delegate:

| Admin role | Delegation ceiling |
| --- | --- |
| `Super Admin`, `Country Admin`, `State Admin`, `Agency Admin` | All profile-assignable permissions (`FIELD_PROFILE_ASSIGNABLE_PERMISSIONS`), including `field:supervisor:manage` |
| `LGA Admin` | All profile-assignable permissions **except** `field:supervisor:manage` |
| Everyone else (`Police/Security Officer`, `Call Center Agent`, `Community Moderator`, `Oversight Auditor`, `Drone Commander`, `Drone Operator`, `Read-only Observer`) | Empty — cannot delegate any field capability permission |

This deliberately mirrors the roles already trusted to approve/manage field
devices (the existing `assertSupervisor` check in
`FieldDevicesAdminService`) — it introduces **no new admin authority
boundary**. It only constrains what that pre-existing authority is allowed to
hand down to a field device. `field:supervisor:manage` is reserved for
state-level and above because it lets a field officer manage *other* field
officers.

## Enforcement: `FieldPermissionPolicyService`

Every code path that grants permissions to a profile or device — profile
create/update, pre-provisioning create/update, and per-device
overrides/denies — funnels through this service
(`apps/api/src/modules/field-operations/field-permission-policy.service.ts`):

1. **`assertKnownPermissions(permissions)`** — rejects any string not in the
   profile-assignable catalog. Throws `BadRequestException` with
   `FIELD-PERM-001 (UNKNOWN_PERMISSION)`. This is the "no arbitrary strings
   from the UI" guarantee — a permission must exist in
   `packages/shared` before it can ever reach the database.
2. **`assertWithinAuthority(actor, permissions)`** — looks up
   `FIELD_SUPERVISOR_GRANT_CEILINGS[actor.role]` and compares against the
   requested permissions. Any permission not in the actor's ceiling is
   "excess". Throws `ForbiddenException` with
   `FIELD-PERM-002 (DELEGATION_EXCEEDS_AUTHORITY)`, including the `excess`
   list in the response body so the admin UI can show exactly which
   permissions were rejected.
3. **`validateGrant(actor, permissions)`** — the combined pipeline (catalog
   check, then authority check) used by every write path. Catalog validation
   always runs first, so an unknown permission is reported as "unknown", not
   conflated with an authority violation.
4. **`checkAuthority(actor, permissions)`** — non-throwing variant of step 2,
   used by the `effective-preview` dry-run endpoint.
5. **`resolveEffective(profilePermissions, overrides, denies)`** — profile
   permissions plus overrides, minus denies (denies win). Pure function, no
   authority check — overrides/denies are separately validated with
   `validateGrant` / `assertKnownPermissions` before being persisted.
6. **`buildAuthoritySnapshot(...)`** — captures an immutable record of *who*
   granted *what*, under *which* ceiling, and *when*:

   ```ts
   type AuthoritySnapshot = {
     grantedByAdminId: string;
     grantedByRole: string;
     ceiling: Permission[];        // the grantor's full ceiling at grant time
     grantedPermissions: Permission[];
     profileId: string | null;
     profileCode: string | null;
     overrides: Permission[];
     denies: Permission[];
     snapshotAt: string;           // ISO timestamp
   };
   ```

   This is stored on the `FieldDevice.authoritySnapshot` JSON column and
   updated (not overwritten — merged) when pairing completes, so there is
   always an auditable answer to "who authorized this device's permissions".

## Non-goals / explicitly not automated

- **No auto-merge of permission changes.** Updating a profile's permission
  list is an explicit `PATCH` by an authorized admin; it never silently
  cascades from, e.g., a role definition change elsewhere in the system.
- **No secrets in permission data.** Permissions are capability *labels*
  only — no credentials, tokens, or keys are ever part of a permission
  profile or authority snapshot.
- **Existing device lifecycle permissions are untouched.**
  `field:device:register` / `field:device:manage` / `field:device:approve`
  continue to gate the *admin* actions of registering/managing/approving
  devices (unrelated to what a device itself can do) and are intentionally
  excluded from the profile-assignable catalog.
