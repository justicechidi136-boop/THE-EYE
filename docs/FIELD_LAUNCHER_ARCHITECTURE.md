# Field Launcher Architecture

**Status:** FIELD LAUNCHER CODE COMPLETE — PHYSICAL QA PENDING  
**App:** `apps/field-ops-tablet`  
**Packages:** `com.theeye.fieldops.staging` / `com.theeye.fieldops`

## Modes

| Mode | API / Build value | Behaviour |
| --- | --- | --- |
| STANDARD_APP | `standard` | Normal Android app; HOME alias disabled |
| FIELD_LAUNCHER | `launcher` | HOME alias may be enabled; tablet home shell |
| MANAGED_KIOSK | `managed_kiosk` | Launcher + Lock Task when Device Owner |

Citizen mobile (`apps/mobile`) is never a launcher.

## Build configuration

```bash
# Explicit mode
flutter build apk --flavor staging -PFIELD_DEVICE_MODE=launcher \
  --dart-define=FIELD_DEVICE_MODE=launcher

# Staging default (no property): launcher
# Production default (no property): standard
```

Android `BuildConfig.FIELD_DEVICE_MODE` and Flutter `FieldDeviceModeConfig` must stay aligned.

## Components

- **Manifest:** `MAIN/LAUNCHER` on `MainActivity`; disabled `LauncherHomeAlias` with `HOME` + `DEFAULT`
- **Native bridge:** `FieldLauncherBridge` MethodChannel `the_eye_field_ops/launcher`
- **Device admin receiver:** present for MDM; app never self-provisions Device Owner
- **Flutter shell:** `LauncherShellGate` → `FieldLauncherHomeScreen` or standard `HomeScreen`
- **Policy:** `GET /v1/field/devices/me/policy` (server-authoritative; offline cache allowed)

## Navigation contract (launcher mode)

- Android Home → THE EYE Field Launcher
- Back from ops screens → launcher dashboard (`PopScope` on shell)
- Logout / revoked / lost → lock screen (no cached ops data)
