# THE EYE Wear OS

Lightweight Wear OS companion for SOS, alerts, location tracking, pairing, and standalone cellular mode.

## Package

| Flavor | Application ID | Firebase project | Default API base URL |
|--------|----------------|------------------|----------------------|
| `development` | `com.theeye.watch.dev` | `the-eye-29cff` | `http://10.0.2.2:4000/v1` (emulator) |
| `staging` | `com.theeye.watch.staging` | `the-eye-2stg` | `https://staging-api.theeye.com.ng/v1` |
| `production` | `com.theeye.watch` | `the-eye-2pd-d0217` | `https://api.theeye.com.ng/v1` |

- Flutter module: `apps/watch`
- Full Firebase/pairing/push guide: [`docs/watch-firebase-pairing.md`](../../docs/watch-firebase-pairing.md)

## Local development

```bash
cd apps/watch
flutter pub get
flutter analyze lib test
flutter test
```

API URLs are resolved in `lib/config/watch_api_config.dart`:

- staging / managedStaging: `https://staging-api.theeye.com.ng/v1` (remote staging server — not localhost)
- production / managedProduction: `https://api.theeye.com.ng/v1`
- development: LAN/emulator host (override with `--dart-define=THE_EYE_DEV_LAN_HOST=...`)

Override any flavor with a **remote** URL: `--dart-define=THE_EYE_API_BASE_URL=https://custom.example/v1`

Local `THE_EYE_API_BASE_URL` overrides (e.g. `http://localhost:4000/v1`) apply only to the **development** flavor; staging and production ignore them.

Environment guards block cross-wiring:
- Staging builds cannot initialize production Firebase or call the production API.
- Production builds cannot initialize staging Firebase or call the staging API.

Validate Firebase wiring:

```bash
pnpm run test:watch:firebase
```

## Build APKs

```bash
# Staging debug
flutter build apk --flavor staging --debug

# Production release
flutter build apk --flavor production --release
# or
flutter build appbundle --flavor production --release
```

From repo root:

```bash
pnpm run watch:build:apk:staging
pnpm run watch:build:apk:production
```

APK outputs:

- `build/app/outputs/flutter-apk/app-staging-debug.apk`
- `build/app/outputs/flutter-apk/app-production-release.apk`

## Pairing

Watch issues a 6-digit code via `/v1/smartwatch/devices/pairing-codes`. Mobile pairs via `/v1/smartwatch/devices/register`. Watch polls `/v1/smartwatch/devices/:deviceId/pairing-status` for the one-time `deviceSecret`.

## Firebase (FCM)

- Flavor-specific `google-services.json` under `android/app/src/{development,staging,production}/`
- Dart options: `lib/firebase_options_{development,staging,production}.dart`
- Watch registers its own FCM token with `platform: android_watch` (separate from phone)
- Push categories are filtered by `PushMessageRouter` to watch-safe routes only

See `docs/watch-firebase-pairing.md` for emulator setup, Play Services requirements, and `pnpm run fcm:test-watch`.
