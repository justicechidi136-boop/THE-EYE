# Field Device Pre-Provisioning

Pre-provisioning lets a supervisor create a `FieldDevice` record — including its
permission profile, operational role, and authority snapshot — **before** a
tablet is ever handed to an officer. It is purely additive: tablet-initiated
self-registration (see [`FIELD_DEVICE_PAIRING.md`](./FIELD_DEVICE_PAIRING.md)
for the pairing half of this flow, and the existing `POST
/field-devices/register` endpoint) is untouched and remains the default path.

## Provisioning modes

Every `FieldDevice` now carries a `provisioningMode`:

| Mode | Set by | `publicKey` / `installationIdHash` |
| --- | --- | --- |
| `SelfRegistration` (default) | `FieldDevicesService.registerDevice` (unchanged) | Required at registration time, as before |
| `PreProvisioned` | `FieldDevicePreprovisionService.preprovision` | `null` until the device completes secure QR/short-code pairing |

This is why `publicKey` and `installationIdHash` on `FieldDevice` are now
nullable columns (Postgres unique indexes allow multiple `NULL`s, so this does
not weaken uniqueness once a real value is bound).

## Provisioning lifecycle (`preProvisionStatus`)

`preProvisionStatus` is tracked **separately** from the existing
`registrationStatus` (`PendingApproval` / `Active` / `Suspended` / `Lost` /
`Revoked` / `Retired`), which continues to describe whether an already-bound
device may authenticate:

```
Draft → AwaitingPairing → (Paired) → Active
                                   ↘ AwaitingFinalApproval → Active
        ↘ Cancelled / Expired
```

- **Draft** — created via `POST /admin/field-devices/preprovision`, no pairing
  code issued yet.
- **AwaitingPairing** — a pairing code has been issued (see
  `FIELD_DEVICE_PAIRING.md`).
- **AwaitingFinalApproval** — pairing completed, but the device's
  `activationPolicy` is `RequireSupervisorFinalApproval`, so a supervisor must
  still call the existing `POST /admin/field-devices/:id/approve` endpoint.
- **Active** — either pairing auto-activated the device
  (`AutoActivateOnPairing`) or a supervisor gave final approval.

## Admin endpoints

All endpoints require `JwtAuthGuard` + `PermissionsGuard` and are scoped by
`FieldDevicesAdminService.assertSupervisor` / `requireScopedDevice` — the same
jurisdiction rules (country/state/LGA/agency) that gate existing field device
admin actions.

| Method & path | Permission | Description |
| --- | --- | --- |
| `POST /admin/field-devices/preprovision` | `field:device:approve` | Create a Draft pre-provisioned device |
| `GET /admin/field-devices/:id/provisioning` | `field:device:manage` | Read provisioning details |
| `PATCH /admin/field-devices/:id/provisioning` | `field:device:approve` | Edit provisioning (only while `Draft`/`AwaitingPairing`) |

### Create request (`PreProvisionFieldDeviceDto`)

```jsonc
{
  "deviceName": "Patrol Tablet 07",
  "operationalRole": "PatrolOfficer",       // must be a known FieldOperationalRole
  "permissionProfileId": "cljk...",          // optional — see FIELD_PERMISSION_PROFILES.md
  "assignedTeamId": "team-12",
  "assignedUserId": "user-1",
  "assignedUnitId": "unit-1",
  "agencyId": "agency-1",                    // must be within the actor's own scope
  "countryCode": "NG", "stateCode": "Lagos", "lgaCode": "Ikeja",
  "deviceMode": "standard",                  // standard | launcher | managed_kiosk
  "activationPolicy": "RequireSupervisorFinalApproval", // or AutoActivateOnPairing (default: require approval)
  "activationExpiresAt": "2026-09-01T00:00:00.000Z",    // must be in the future
  "reviewAt": "2026-08-20T00:00:00.000Z",
  "notes": "Issued at HQ armory",
  "inventoryAssetRef": "ASSET-00042",
  "permissionOverrides": ["field:drone:observe"], // additive, on top of the profile
  "permissionDenies": ["field:evidence:add"]      // subtractive, wins over overrides
}
```

Validation performed by `FieldDevicePreprovisionService.preprovision`:

1. **Supervisor check** — `FieldDevicesAdminService.assertSupervisor(actor)`.
2. **Jurisdiction scope** — the actor cannot preprovision outside their own
   country/state/LGA/agency (`FIELD_ERROR_CODES.JURISDICTION_MISMATCH`, same
   rule as existing device approval).
3. **Known-value validation** — `operationalRole`, `deviceMode`,
   `activationPolicy` must be from a fixed allow-list; dates must be valid and,
   where required, in the future.
4. **Permission validation** (delegates to `FieldPermissionPolicyService`, see
   [`FIELD_PERMISSION_DELEGATION_POLICY.md`](./FIELD_PERMISSION_DELEGATION_POLICY.md)):
   - The profile's permissions, and any `permissionOverrides`, must be in the
     known field-capability catalog — **arbitrary strings are always
     rejected** (`FIELD-PERM-001`).
   - The full set must be within the actor's own delegation ceiling — a
     supervisor can never hand out more than they themselves are trusted with
     (`FIELD-PERM-002`).
5. An **authority snapshot** is captured at grant time
   (`FieldPermissionPolicyService.buildAuthoritySnapshot`) and stored on the
   device as `authoritySnapshot` (immutable JSON) — this is the audit trail
   answering "who granted this device its permissions, and under what
   ceiling, and when".

The device is created with `registrationStatus: PendingApproval`,
`preProvisionStatus: Draft`, a generated `publicDeviceId` (`fd_...`), and
`publicKey`/`installationIdHash` left `null` until pairing.

### Editing provisioning

`PATCH /admin/field-devices/:id/provisioning` only succeeds while
`preProvisionStatus` is `Draft` or `AwaitingPairing`. Once pairing has
completed, provisioning is locked — cancel and re-issue a pairing code instead
(see `FIELD_DEVICE_PAIRING.md`) if you need to change the permission profile
of a bound device.

## What is reused, unchanged

- `FieldDevicesService.mapDevice` — extended (not replaced) to expose the new
  provisioning fields in device API responses.
- `FieldDevicesAdminService.assertSupervisor` / `assertDeviceScope` /
  `requireScopedDevice` — made `public` so the new services can reuse the
  exact same jurisdiction/authority checks as existing admin endpoints.
- `FieldDevicesService.registerDevice` — unchanged behavior; now explicitly
  stamps `provisioningMode: SelfRegistration` and still requires `publicKey` /
  `installationIdHash` up front, exactly as before.
