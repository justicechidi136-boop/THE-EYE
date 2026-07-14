# THE EYE Watch — Release

## Flavors

```text
development | staging | production | managedStaging | managedProduction
```

## Build (Windows)

```powershell
cd apps/watch
flutter pub get
dart format lib test
flutter analyze
flutter test

flutter build apk --release --flavor staging
flutter build apk --release --flavor production
```

Outputs (typical):

- `build/app/outputs/flutter-apk/app-staging-release.apk` → `com.theeye.watch.staging`
- `build/app/outputs/flutter-apk/app-production-release.apk` → `com.theeye.watch`

Release signing currently uses the debug keystore in `android/app/build.gradle.kts` (**PARTIAL** — replace before store distribution).

## Dart defines (optional)

- `THE_EYE_API_BASE_URL`
- `THE_EYE_FIREBASE_ENV` (legacy; prefer Gradle flavor → `FLUTTER_APP_FLAVOR`)

## Staging promotion

1. Merge PR `feature/watch-final-audit` → `staging` (manual review)
2. Install staging APK on Wear x64 emulator or device
3. Do **not** auto-merge to `main` / production release from this audit

## Preflight

- [ ] Firebase options no longer `REPLACE_WITH_*` for the target env
- [ ] Matching `google-services.json` present locally (never commit secrets)
- [ ] Staging API reachable for pairing / SOS
- [ ] Wear x64 or physical device for launcher + UI sign-off
