# FlutterFire production configuration — THE EYE mobile (Android)

Production Firebase project: `the-eye-2pd-d0217`

## Android identity

| Field | Value |
|-------|-------|
| `applicationId` | `com.theeye.app` |
| Firebase App ID | `1:137367371675:android:7c280f69a27799b3a2ab3e` |
| Firebase project ID | `the-eye-2pd-d0217` |

## Configuration files

| File | Purpose |
|------|---------|
| `apps/mobile/lib/firebase_options.dart` | FlutterFire options (no service-account secrets) |
| `apps/mobile/android/app/google-services.json` | Android Firebase SDK config |

## Local Flutter commands (run from repository root)

PowerShell does **not** support `cd /d` (that is CMD syntax). Use:

```powershell
Set-Location "C:\Users\USER\Documents\the eye 2\apps\mobile"
```

Or stay at the repo root and use pnpm wrappers:

```powershell
Set-Location "C:\Users\USER\Documents\the eye 2"
pnpm run mobile:pub-get
pnpm run mobile:analyze
pnpm run mobile:test
pnpm run mobile:build:apk
```

`flutter build apk --release` requires the **Android SDK** (`flutter doctor` must show Android toolchain OK). Install Android Studio, then:

```powershell
flutter doctor --android-licenses
```

## Regenerate with FlutterFire CLI

```bash
cd apps/mobile
dart pub global activate flutterfire_cli
flutterfire configure --project=the-eye-2pd-d0217 --platforms=android --android-package-name=com.theeye.app --out=lib/firebase_options.dart
```

Or:

```bash
pnpm --dir apps/mobile run flutterfire:configure
```

## Push token registration

After citizen login, the app registers the device token via:

`POST /v1/notifications/push-tokens`

Service-account credentials remain API-only (`apps/api/.env`).

## Physical device verification

1. Install release/debug APK on a physical Android device.
2. Log in as a citizen user.
3. Confirm notification permission is granted.
4. Run `pnpm run fcm:test-device -- --token=<device-token> --confirm` from API ops (provider acceptance only).
5. Confirm the notification appears on the device.
