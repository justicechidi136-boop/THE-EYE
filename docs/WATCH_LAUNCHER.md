# THE EYE Watch — Launcher (HOME)

## Consumer mode (default)

- Manifest registers `LauncherHomeActivity` with `MAIN` + `HOME` + `DEFAULT` and `MAIN` + `LAUNCHER`.
- User may choose THE EYE as default home via onboarding / settings (`requestDefaultHome` → RoleManager or home settings).
- App drawer lists launchable packages; always attempts Settings + Phone escape hatches.
- Debug recovery UI can open “Change Default Launcher”.

## Managed mode

- Flavors: `managedStaging`, `managedProduction` (`LAUNCHER_MODE=managed`).
- Same package ID as consumer for the env; intended for device-owner / MDM fleets.
- No DevicePolicyManager lock-task in consumer paths (`ManagedLauncherStub` is reserved).

## Escape / recovery

| Path | Behavior |
|------|----------|
| App drawer → System Settings | Native settings intent |
| CrashSentinel (≥3 Flutter crashes) | `RecoveryActivity` with settings / change home / retry |
| Boot hard-fail UI | Retry, Open Settings, (debug) Change Default Launcher |

## Verification

- Emulator HOME chooser: requires supported Wear AVD + interactive confirm → often **HARDWARE BLOCKED** without Wear x64 image.
- Unit: `launcher_service_test.dart`, `default_home_onboarding_test.dart`.
