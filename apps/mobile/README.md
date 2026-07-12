# THE EYE Mobile

Flutter app with Android/iOS flavors: `development`, `staging`, and `production`.

## Firebase environments

| Flavor | Package ID | Firebase project | App label |
|--------|------------|------------------|-----------|
| development | `com.theeye.app.dev` | `the-eye-29cff` | THE EYE Dev |
| staging | `com.theeye.app.staging` | `the-eye-2stg` | THE EYE Staging |
| production | `com.theeye.app` | `the-eye-2pd-d0217` | THE EYE |

- Android `google-services.json`: `android/app/src/<flavor>/google-services.json`
- Dart Firebase options: `lib/firebase_options_<flavor>.dart`
- Runtime guard: `lib/config/firebase_bootstrap.dart` rejects flavor/project mismatches.

Download SDK configs from Firebase Console per flavor. These JSON/plist files are gitignored.

## API URLs

Resolved in `lib/config/the_eye_api_config.dart`:

- staging: `https://staging-api.theeye.com.ng/v1`
- production: `https://api.theeye.com.ng/v1`
- development: LAN/emulator host (override with `--dart-define=THE_EYE_DEV_LAN_HOST=...`)

Override any flavor: `--dart-define=THE_EYE_API_URL=https://custom.example/v1`

## Run

```bash
flutter pub get
flutter run --flavor staging
flutter run --flavor production
```

## Build

```bash
flutter build apk --flavor staging
flutter build apk --flavor staging --debug
flutter build apk --flavor production --release
flutter build appbundle --flavor production --release
```

## Validate Firebase wiring

From repo root:

```bash
pnpm run test:mobile:firebase
```

From this package:

```bash
pnpm run validate:firebase
```

## Analyze and test

```bash
flutter analyze lib test
flutter test
```
