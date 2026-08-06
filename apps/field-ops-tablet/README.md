# THE EYE Field Ops Tablet

Landscape-first Flutter tablet app for field officer device registration, approval, and authentication.

## Package

| Flavor | Application ID | Firebase project | Default API base URL |
|--------|----------------|------------------|----------------------|
| `staging` | `com.theeye.fieldops.staging` | `the-eye-2stg` | `https://staging-api.theeye.com.ng/v1` |
| `production` | `com.theeye.fieldops` | `the-eye-2pd-d0217` | `THE_EYE_PROD_API_URL` dart-define |

- Flutter module: `apps/field-ops-tablet`
- Sprint 1 scope: device registration, approval polling, officer login/refresh/logout, session lock, device heartbeat

## Local development

```bash
cd apps/field-ops-tablet
flutter pub get
flutter analyze lib test
flutter test
```

API URLs are resolved in `lib/config/api_config.dart`.

Override any flavor with:

```bash
flutter run --flavor staging --dart-define=THE_EYE_API_BASE_URL=https://custom.example/v1
```

## Build APKs

```bash
# Staging debug
flutter build apk --flavor staging --debug

# Production release
flutter build apk --flavor production --release
```

## Registration flow

1. Tablet generates an Ed25519 device key pair (`DeviceKeystoreService`)
2. Supervisor submits registration via `/v1/field/devices/register` using a token with `field:device:register`
3. Tablet polls `/v1/field/devices/registration-status` until approved
4. Officer signs in via `/v1/field/auth/login` with device challenge signature

## Routes

- `/splash` — boot + routing
- `/device-registration` — first-time device enrollment
- `/approval-pending` — supervisor approval polling
- `/login` — officer authentication
- `/locked` — locked session unlock
- `/home` — landscape shell with `NavigationRail` placeholder
- `/device-status` — registration + heartbeat diagnostics
- `/unauthorized` — blocked/revoked device state

## Firebase

Add flavor-specific `google-services.json` under:

- `android/app/src/staging/`
- `android/app/src/production/`

Then wire Dart Firebase options before enabling push in a later sprint.
