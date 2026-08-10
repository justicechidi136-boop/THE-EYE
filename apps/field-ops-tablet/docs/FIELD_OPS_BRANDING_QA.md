# Field Operations branding — physical tablet QA

Scope: `apps/field-ops-tablet` only.

## What this covers

| Layer | Controlled by | Branded? |
| --- | --- | --- |
| Device power-on OEM boot animation | Manufacturer / firmware | No (not claimed) |
| Android 12+ app launch splash | Native `LaunchTheme` / `values-v31` | Yes |
| Pre-Android 12 window background | `launch_background.xml` | Yes |
| Flutter initialization screen | `SplashScreen` | Yes |
| Launcher / Home identity | `ic_launcher` + `LauncherHomeAlias` | Yes |

Firmware/MDM OEM boot animation branding is out of scope unless THE EYE controls the device image.

## Build / install (staging)

```bash
cd apps/field-ops-tablet
flutter pub get
flutter build apk --flavor staging --debug
adb install -r build/app/outputs/flutter-apk/app-staging-debug.apk
```

- Package: `com.theeye.fieldops.staging`
- Label: `THE EYE Field Ops (Staging)`

## Physical 10-inch checklist

Record screenshots for release evidence.

1. **Launcher icon** — cold open app drawer / home; official logo visible (green arcs + orange ring + triangle). Not Flutter default.
2. **Tap app** — native splash is dark `#0B0F14` with official logo (no white flash).
3. **Flutter init** — logo + `THE EYE FIELD OPS` + status text; no API URLs / JWT / stack traces.
4. **Routing** — lands on correct security gate (pair / register / login / home / locked).
5. **Landscape + portrait transition** — logo not stretched/cropped; text readable with larger font scale.
6. **FIELD_LAUNCHER / MANAGED_KIOSK** — `LauncherHomeAlias` / home identity uses same logo.
7. **STANDARD_APP** — same official icon.
8. **Pairing** — official logo above “Secure Field Device Activation”.
9. **Login** — official logo + THE EYE / FIELD OPERATIONS; auth behavior unchanged.
10. **Lock / revoke / suspend** — cannot bypass via branding screens.
11. **Offline startup** — still shows branded init; fails closed to existing recovery path.
12. **Staging label** — app name shows Staging; logo artwork has no “STAGING” text baked in.

## Pass criteria

Branding is **verified on physical tablet** only after steps 1–4 are visually confirmed on hardware.

Code-complete without that evidence must remain: **PHYSICAL QA PENDING**.
