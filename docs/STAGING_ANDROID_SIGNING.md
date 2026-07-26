# Staging Android Release Signing

Staging certification APKs must **not** use the Android debug keystore long term.

| Variant | Package | Signing identity |
|---------|---------|------------------|
| development debug | `com.theeye.app.dev` | Debug keystore |
| **staging release** | **`com.theeye.app.staging`** | **Dedicated staging release keystore** |
| production release | `com.theeye.app` | Production / Play App Signing (separate policy) |

## Generate the staging keystore (operator — one time)

Run on a secure operator workstation. **Do not commit the keystore or passwords.**

```bash
keytool -genkeypair \
  -v \
  -keystore the-eye-staging-release.jks \
  -alias the-eye-staging \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Store `the-eye-staging-release.jks` in an approved secret manager.

Extract fingerprints (safe to record):

```bash
keytool -list -v -keystore the-eye-staging-release.jks -alias the-eye-staging
```

Or from a signed APK:

```bash
apksigner verify --print-certs app-staging-release.apk
```

Register **SHA-1** and **SHA-256** in Firebase project **`the-eye-2stg`** for `com.theeye.app.staging`.

## Local authorized builds

Copy `apps/mobile/android/key.properties.example` → `apps/mobile/android/key.properties` (gitignored) or export:

```bash
export THE_EYE_STAGING_KEYSTORE_PATH=/secure/path/the-eye-staging-release.jks
export THE_EYE_STAGING_KEYSTORE_PASSWORD='...'
export THE_EYE_STAGING_KEY_ALIAS=the-eye-staging
export THE_EYE_STAGING_KEY_PASSWORD='...'
```

Build:

```bash
cd apps/mobile
flutter build apk --release --flavor staging --dart-define=THE_EYE_FLAVOR=staging
```

Verify signing:

```bash
node scripts/validate-staging-apk-signing.cjs \
  --apk build/app/outputs/flutter-apk/app-staging-release.apk \
  --reject-debug
```

## GitHub Environment `staging` secrets

| Secret | Purpose |
|--------|---------|
| `STAGING_ANDROID_KEYSTORE_BASE64` | Base64-encoded `.jks` (never commit) |
| `STAGING_ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `STAGING_ANDROID_KEY_ALIAS` | Key alias (`the-eye-staging`) |
| `STAGING_ANDROID_KEY_PASSWORD` | Key password |

Optional vars for CI fingerprint pinning:

| Variable | Purpose |
|----------|---------|
| `STAGING_ANDROID_EXPECTED_SHA1` | Fail CI if APK SHA-1 differs |
| `STAGING_ANDROID_EXPECTED_SHA256` | Fail CI if APK SHA-256 differs |

CI decodes the keystore to a temporary runner path, builds the staging release APK, validates with `--reject-debug`, and deletes the keystore in an `always()` cleanup step.

## Emergency override (temporary only)

```bash
export THE_EYE_ALLOW_DEBUG_STAGING_RELEASE=true
```

This allows debug-signed staging release builds for local debugging only. **Do not use for certification APKs or Firebase registration.**

## Deprecated debug certificate (do not register as final staging identity)

Prior builds used `signingConfigs.debug`:

- SHA-1: `5da2e2ebfc7816b9c1fe780b102fd61f0c802ac7`
- SHA-256: `a6e66ccca4fa5d6217b789a2fd330625f411d24835fa6a65c8688f771d8032cb`

See [FIREBASE_STAGING_AUTH.md](./FIREBASE_STAGING_AUTH.md) for Firebase operator steps after dedicated fingerprints are available.
