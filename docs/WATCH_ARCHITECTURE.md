# THE EYE Watch — Architecture

Module: `apps/watch` (Flutter Wear OS / standalone).

## Layers

| Layer | Responsibility |
|-------|----------------|
| Native Android | `LauncherHomeActivity` (HOME + LAUNCHER), vibration / launcher / crash method channels, `RecoveryActivity`, `CrashSentinel` |
| Boot | `WatchBootScreen` + `WatchBootSequencer` (staged cold-start with timeouts) |
| Services | Pairing, SOS, GPS, FCM push, heartbeat, connectivity, offline queue |
| UI | Prototype-aligned screens under `lib/screens/` + design tokens |
| Config | Flavor → Firebase project + API host guards |

## Cold start

1. Native splash (black + brand assets)
2. Flutter `WatchBootScreen` (THE EYE logo + status bar)
3. Sequencer stages: local settings → secure identity → Firebase → pairing restore → runtime services
4. Route: consumer default-home onboarding (if needed) → pairing or location onboarding → home

Boot never hard-blocks forever: Firebase / FCM / network failures degrade and continue.

## Critical paths (must not regress)

- SOS hold → countdown → submit / offline queue
- Pairing code + secure credentials
- FCM register + watch-safe category router
- GPS idle + emergency tracking
- Consumer HOME launcher + app drawer escape hatches
- Staging / production isolation

## Package / Firebase map

| Flavor | Android package | Firebase project |
|--------|-----------------|------------------|
| development | `com.theeye.watch.dev` | `the-eye-29cff` |
| staging / managedStaging | `com.theeye.watch.staging` | `the-eye-2stg` |
| production / managedProduction | `com.theeye.watch` | `the-eye-2pd-d0217` |

Managed flavors share applicationId with consumer counterparts and differ by `BuildConfig.LAUNCHER_MODE`.
