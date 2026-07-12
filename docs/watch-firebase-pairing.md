# THE EYE Wear OS — Firebase, Pairing, and Push E2E

Engineering guide for `apps/watch` (`com.theeye.watch` / `com.theeye.watch.staging`).

## Firebase projects and package IDs

| Flavor | Dart define | Android package | Firebase project |
|--------|-------------|-----------------|------------------|
| `staging` (default) | `THE_EYE_FIREBASE_ENV=staging` | `com.theeye.watch.staging` | `the-eye-2stg` |
| `production` | `THE_EYE_FIREBASE_ENV=production` | `com.theeye.watch` | `the-eye-2pd-d0217` |

**Do not** point staging builds at production Firebase or vice versa.

## Register Firebase Android apps (manual)

Firebase CLI is available in this repo, but watch Android apps are not registered yet in `the-eye-2stg` / `the-eye-2pd-d0217`.

```bash
# Staging
firebase apps:create ANDROID "THE EYE Watch Staging" \
  --package-name=com.theeye.watch.staging \
  --project=the-eye-2stg

# Production
firebase apps:create ANDROID "THE EYE Watch" \
  --package-name=com.theeye.watch \
  --project=the-eye-2pd-d0217
```

Download SDK config per flavor:

```bash
# Copy output to flavor-specific paths (never commit secrets to the wrong flavor)
apps/watch/android/app/src/staging/google-services.json
apps/watch/android/app/src/production/google-services.json
```

Update Dart options from the downloaded JSON:

- `apps/watch/lib/firebase_options_staging.dart`
- `apps/watch/lib/firebase_options_production.dart`

`.example` templates live beside each flavor directory.

## Build commands

```powershell
cd apps/watch
flutter pub get

# Staging (safe default for local/staging API + Firebase)
flutter run --flavor staging --dart-define=THE_EYE_FIREBASE_ENV=staging --dart-define=THE_EYE_API_BASE_URL=http://10.0.2.2:4000/v1

# Production flavor (only when intentionally testing production Firebase)
flutter run --flavor production --dart-define=THE_EYE_FIREBASE_ENV=production

# Debug APKs
flutter build apk --flavor staging --debug --dart-define=THE_EYE_FIREBASE_ENV=staging
flutter build apk --flavor production --debug --dart-define=THE_EYE_FIREBASE_ENV=production
```

APK outputs:

- `build/app/outputs/flutter-apk/app-staging-debug.apk`
- `build/app/outputs/flutter-apk/app-production-debug.apk`

## Wear emulator prerequisites

1. Flutter SDK: `C:\Users\USER\Documents\flutter\bin\flutter.bat`
2. Android Studio → SDK Manager → **Wear OS 5+** system image (API 30+)
3. Accept licenses: `flutter doctor --android-licenses`
4. Create AVD: Device Manager → **Wear OS** → round or square → Wear OS 5.x image

```powershell
flutter emulators
flutter emulators --launch <wear_avd_id>
flutter devices
flutter run --flavor staging -d <wear_device_id> --dart-define=THE_EYE_FIREBASE_ENV=staging
```

### Play Services requirement for FCM

Push delivery requires Google Play Services on the emulator image. Standard Wear OS Google APIs images include Play Services; **push cannot be verified** on images without it.

Current workstation status (2026-07-12): `flutter emulators` reports **no AVDs** — install/create a Wear AVD before device-level push verification.

Forward API port when needed:

```powershell
adb -s <device> forward tcp:4000 tcp:4000
```

## Pairing E2E flow

1. **Watch** → `Generate Code` → `POST /v1/smartwatch/devices/pairing-codes`
2. **Mobile** → SOS device screen → enter Device ID + 6-digit code → `POST /v1/smartwatch/devices/register`
3. **Watch** polls `GET /v1/smartwatch/devices/:deviceId/pairing-status` → receives one-time `deviceSecret`
4. Pairing session rules: **10 min expiry**, **one-time use**, **firebaseEnv must match**, audit events recorded

Mobile pairing UI: `/smartwatch` route (`SmartwatchDeviceScreen`).

## FCM token registration

After Firebase init and pairing (access token available):

- Watch obtains FCM token
- `POST /v1/notifications/push-tokens` with `platform: android_watch`, `deviceId`, `provider: fcm`
- Token refresh listener re-registers
- Unpair revokes local token via `PushMessagingService.revokeToken()`

## Watch push test script

Single-device, masked token, watch categories only:

```bash
pnpm run fcm:test-watch -- --token=<fcm-registration-token> --confirm --category=FamilySosAlert
```

Uses staging/dev FCM credentials from `.env`. Refuses production project unless `ALLOW_PROD_WATCH_FCM_TEST=true`.

Allowed categories: `SosAck`, `FamilySosAlert`, `EmergencyAlert`, `IncidentStatusUpdate`, `BroadcastAlert`, `MissingPersonAlert`, `StolenVehicleAlert`.

## Test matrix (honest coverage)

| Scenario | Emulator | Physical watch | LTE standalone |
|----------|----------|----------------|----------------|
| App launch / pairing UI | Needs Wear AVD | Yes | N/A |
| Pairing code E2E | Needs AVD + API + mobile | Yes | N/A |
| FCM token register | Needs Play Services AVD | Yes | Untested without hardware |
| Foreground alert | Needs Play Services AVD | Yes | Untested |
| Background alert | Needs Play Services AVD | Yes | Untested |
| Standalone Wi-Fi SOS | Needs networked AVD | Yes | **LTE untested** without cellular hardware |

## Verification commands

```powershell
cd apps/watch
dart format lib test
flutter analyze lib test
flutter test

cd ../..
pnpm --filter @the-eye/api run test -- smartwatch
```

## Startup behavior

- `Firebase.initializeApp()` runs per flavor **before** `FirebaseMessaging`
- Top-level `firebaseMessagingBackgroundHandler` registered in `push_background_handler.dart`
- Missing/placeholder Firebase options show a **startup error screen** (no silent production fallback)
