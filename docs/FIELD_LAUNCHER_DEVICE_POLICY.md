# Field Launcher Device Policy

## Tablet API

`GET /v1/field/devices/me/policy` (field JWT)

Returns launcher mode, approved apps, module visibility, emergency dialer flag, lock state.

`POST /v1/field/devices/me/launcher-audit` — best-effort audit for app launch / maintenance escape.

## Admin API

- `GET /v1/admin/field-devices/:id/policy`
- `PATCH /v1/admin/field-devices/:id/policy`

Permission: `field:device:manage`. Every PATCH audits `field.device.launcher_policy_updated`.

## Policy fields

| Field | Values |
| --- | --- |
| deviceMode | `standard` \| `launcher` \| `managed_kiosk` |
| launcherEnabled | bool |
| kioskEnabled | bool |
| approvedApps | package name list |
| settingsAccessLevel | `none` \| `restricted` \| `supervisor` |
| maintenanceModeAllowed | bool |
| emergencyDialerAllowed | bool |
| browserAllowed | bool |
| screenshotsAllowed | bool |
| usbPolicy | `allow` \| `charge_only` \| `deny` |
| autoLockMinutes | 1–240 |
| visibleModules | module id list |
| role | officer/patrol/checkpoint/drone/supervisor/commander |

## Trust model

- Tablet must not trust locally edited policy for enforcement beyond degraded offline cache.
- Cache last successful authorized policy for offline boot.
- Revoked/lost/suspended devices still receive policy with `locked=true`.
