# Field Permission Profiles

A `FieldPermissionProfile` is a named, reusable set of field capability
permissions that can be assigned to a pre-provisioned device instead of
picking permissions one-by-one every time. Profiles are the primary input to
[pre-provisioning](./FIELD_DEVICE_PREPROVISIONING.md); per-device
`permissionOverrides` / `permissionDenies` let a supervisor fine-tune a single
device without forking a whole new profile.

## The permission catalog

Field capability permissions live in
`packages/shared/src/field-permission-catalog.ts` and are split into two
groups:

- **`EXISTING_FIELD_PERMISSIONS`** — pre-existing admin/device-lifecycle
  permissions (`field:access`, `field:device:register`,
  `field:device:manage`, `field:device:approve`, `field:session:operate`).
- **`NEW_FIELD_CAPABILITY_PERMISSIONS`** — the granular "what can this officer
  do" permissions introduced for profiles: assignments, incidents,
  communications, evidence, BOLO/sightings, backup requests, map, patrol,
  checkpoint, vehicle search, broadcasts, drone observation, shift operation,
  and supervisor management.

Only **`FIELD_PROFILE_ASSIGNABLE_PERMISSIONS`** (`field:access`,
`field:session:operate`, plus all of `NEW_FIELD_CAPABILITY_PERMISSIONS`) may
be assigned to a profile or device. Admin-console-only device lifecycle
permissions (`field:device:register` / `manage` / `approve`) are deliberately
excluded — they govern who can administer devices, not what a device/officer
can do in the field, and are never handed to a device.

`FIELD_PERMISSION_GROUPS` provides human-labelled groupings (e.g. "Core Field
Access", "Assignments & Incidents", "Patrol Operations") for admin UI
presentation — purely cosmetic, not enforced server-side.

**Arbitrary permission strings are always rejected.** Every write path funnels
through `FieldPermissionPolicyService.assertKnownPermissions` /
`validateGrant`, which check against this catalog and throw
`BadRequestException` with `FIELD-PERM-001 (UNKNOWN_PERMISSION)` for anything
not on the assignable list.

## System (built-in) profiles

Seeded via `apps/api/prisma/seed-field-permission-profiles.ts`
(`npx ts-node prisma/seed-field-permission-profiles.ts`, safe to re-run —
upserts by `code`):

| Code | Operational role | Summary |
| --- | --- | --- |
| `patrol_officer_baseline` | PatrolOfficer | Standard patrol capability set |
| `patrol_team_lead` | PatrolTeamLead | Patrol baseline + `field:supervisor:manage` |
| `checkpoint_officer_baseline` | CheckpointOfficer | Standard checkpoint duty capability set |
| `checkpoint_commander` | CheckpointCommander | Checkpoint baseline + supervisor management |
| `dispatcher_baseline` | Dispatcher | Dispatch coordination capabilities |
| `agency_supervisor` | AgencySupervisor | Full oversight set incl. drone observation + supervisor management |
| `emergency_responder_baseline` | EmergencyResponder | Rapid-response capability set |
| `drone_operator_field` | DroneOperator | Read-only drone mission observation |
| `field_read_only_observer` | FieldReadOnlyObserver | Minimal read-only visibility |

System profiles (`isSystem: true`) are **read-only** through the admin API —
`PATCH /admin/field-permission-profiles/:id` rejects edits to a system
profile with a `BadRequestException`. To customize, create a new profile
(optionally copying a system profile's permission list as a starting point).

## Admin endpoints

All require `JwtAuthGuard` + `PermissionsGuard`, scoped by
`FieldDevicesAdminService.assertSupervisor`.

| Method & path | Permission | Description |
| --- | --- | --- |
| `GET /admin/field-permission-profiles` | `field:device:manage` | List profiles (filter by `isActive`, `operationalRole`) |
| `GET /admin/field-permission-profiles/:id` | `field:device:manage` | Get one profile |
| `POST /admin/field-permission-profiles` | `field:device:approve` | Create a custom profile |
| `PATCH /admin/field-permission-profiles/:id` | `field:device:approve` | Update a custom (non-system) profile |
| `POST /admin/field-permission-profiles/:id/disable` | `field:device:approve` | Soft-disable a profile |
| `GET /admin/field-permissions/effective-preview` | `field:device:manage` | Dry-run: resolve effective permissions + authority check |

### Create (`CreateFieldPermissionProfileDto`)

```jsonc
{
  "code": "night_shift_patrol",       // lowercase, starts with a letter, 3-64 chars, [a-z0-9_-]
  "name": "Night Shift Patrol",
  "description": "Patrol baseline minus vehicle search, for night-shift-only tablets.",
  "operationalRole": "PatrolOfficer",  // optional, must be a known FieldOperationalRole
  "permissions": ["field:access", "field:session:operate", "field:incident:view", "..."]
}
```

`permissions` is validated through `FieldPermissionPolicyService.validateGrant`
— every permission must be (a) in the known catalog and (b) within the
creating admin's own delegation ceiling (see
[`FIELD_PERMISSION_DELEGATION_POLICY.md`](./FIELD_PERMISSION_DELEGATION_POLICY.md)).
A duplicate `code` is rejected with `BadRequestException`.

### Disable

Disabling sets `isActive: false`, `disabledAt`, `disabledById`, and an
optional `disabledReason`. Disabled profiles cannot be newly assigned to a
device (`FieldPermissionProfilesService.requireActiveProfile` throws
`FIELD-PERM-003 (PROFILE_INACTIVE)`), but devices already using the profile
are unaffected until edited.

### Effective permission preview

`GET /admin/field-permissions/effective-preview?profileId=...&overrides=a,b&denies=c` — resolves
what a device would actually end up with (`resolveEffectiveFieldPermissions`:
profile permissions ∪ overrides, minus denies) and reports whether that set is
within the requesting admin's own authority, without persisting anything. Use
this to sanity-check a grant before calling preprovision/update endpoints.

## Effective permission resolution

For a bound device, the effective permission set is:

```
effective = (profile.permissions ∪ permissionOverrides) − permissionDenies
```

Denies always win over overrides, so a supervisor can narrow a shared profile
for one specific device (e.g. remove `field:evidence:add` from one tablet)
without needing to create or maintain a whole separate profile.
