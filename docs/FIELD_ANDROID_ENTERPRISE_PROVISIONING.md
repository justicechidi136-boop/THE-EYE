# Field Android Enterprise Provisioning

THE EYE Field Ops **does not** silently become Device Owner.

## Prerequisites

1. Agency-owned tablet (not a personal citizen device)
2. Staging package `com.theeye.fieldops.staging` or production `com.theeye.fieldops`
3. Approved MDM / EMM that can set Device Owner (or factory QR / NFC / ADB provisioning in controlled staging)

## Device Owner (example ADB staging only)

```bash
# Factory-reset device, enable USB debugging, then:
adb shell dpm set-device-owner com.theeye.fieldops.staging/com.theeye.fieldops.FieldDeviceAdminReceiver
```

Production must use Android Enterprise / MDM flows, not ad-hoc ADB.

## After Device Owner

1. Admin sets device policy `deviceMode=managed_kiosk`, `kioskEnabled=true`, approved package list
2. Tablet fetches policy after login
3. Native bridge calls `setLockTaskPackages` + `startLockTask` when Device Owner is confirmed
4. Unauthorized packages are blocked by OS allowlist + app ApprovedAppRegistry

## Limitations without Device Owner

- Lock Task may be user-stoppable (screen pinning semantics)
- Cannot reliably block uninstall, factory reset, USB debugging, or unknown sources
- HOME can still be changed by the user unless MDM restricts it

Document these limits to agencies before pilot.
