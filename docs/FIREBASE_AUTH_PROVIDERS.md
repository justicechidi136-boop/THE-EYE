# Firebase Auth Providers — Staging & Production Readiness

Engineering runbook for **Google**, **Apple**, and credential flows on THE EYE mobile/watch apps.  
Environment matrix (FCM, CLI): [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).

**Canonical machine-readable IDs:** [`scripts/firebase/auth-providers.manifest.json`](../scripts/firebase/auth-providers.manifest.json)  
**Repo validation:** `pnpm run test:firebase:auth-providers`

---

## Architecture (what Firebase is — and is not)

| Concern | Source of truth | Firebase role |
|---------|-----------------|-----------------|
| User accounts, roles, jurisdictions | **NestJS + Postgres** (`apps/api`) | Identity broker only for Google/Apple |
| Admin dashboard login | **NestJS JWT** (httpOnly cookies) | **None** — admin-web does not use Firebase client SDK |
| Email + password login | **NestJS** `POST /v1/auth/login` | Not used |
| Phone OTP login | **NestJS** `POST /v1/auth/phone/*` | Not used |
| Google / Apple sign-in (mobile) | Firebase Auth client → `POST /v1/auth/firebase/exchange` | Issues ID token; API verifies and issues THE EYE JWT |
| Push notifications (FCM) | Firebase Admin SDK on API (`FCM_*` env) | Delivery only |

**Never assign THE EYE roles via Firebase custom claims.** RBAC lives in Postgres and NestJS JWTs only.

**Do not commit:** `google-services.json`, `GoogleService-Info.plist`, Apple `.p8` keys, or service-account JSON.

---

## Provider implementation matrix (code vs Console)

| Provider | Implemented in code | Firebase Console required | NestJS / other |
|----------|--------------------|---------------------------|----------------|
| **Google** | Yes — `SocialAuthService.signInWithGoogle()` | Enable Google provider; Android SHA fingerprints; OAuth clients | `POST /v1/auth/firebase/exchange` with `provider: google.com` |
| **Apple** | Yes — `SocialAuthService.signInWithApple()` (iOS + Android) | Enable Apple provider; Apple Developer Services ID + key | Same exchange with `provider: apple.com` |
| **Email/password** | Yes — NestJS only | Optional (not used by app today) | `POST /v1/auth/login` |
| **Phone OTP** | Yes — NestJS only | Optional (not used by app today) | `POST /v1/auth/phone/request-otp`, `verify-otp` |
| **Firebase Email link / phone auth** | **No** | N/A | Not implemented |

### Surfaces

| Surface | Firebase client SDK | Auth method |
|---------|--------------------|-------------|
| Mobile (`apps/mobile`) | Yes — `firebase_auth`, Google, Apple | Social via Firebase → API exchange; email/phone via API |
| Watch (`apps/watch`) | Yes — FCM / pairing only | No social sign-in on watch |
| Admin web (`apps/admin-web`) | **No** | Email/password → `/api/auth/login` → NestJS JWT |
| Public web (`apps/web`) | Optional `VITE_FIREBASE_*` (dev template only) | Not wired for production social auth |

---

## Firebase projects (staging ≠ production)

| Environment | Firebase project ID | GCP project number |
|-------------|---------------------|--------------------|
| Staging | `the-eye-2stg` | `767357461507` |
| Production | `the-eye-2pd-d0217` | `137367371675` |

**Never** register staging package IDs on the production project or vice versa.

Console links:

- Staging: [Firebase Console — the-eye-2stg](https://console.firebase.google.com/project/the-eye-2stg/authentication/providers)
- Production: [Firebase Console — the-eye-2pd-d0217](https://console.firebase.google.com/project/the-eye-2pd-d0217/authentication/providers)

---

## Android package IDs & fingerprint slots

Both mobile and watch **release builds currently use the debug signing config** in Gradle (`signingConfig = signingConfigs.debug`). Until upload/release keystores are configured, **debug fingerprints apply to release APKs/AABs**.

### Staging (`the-eye-2stg`)

| App | Android package | Firebase Android app ID | iOS bundle ID |
|-----|-----------------|-------------------------|---------------|
| Mobile | `com.theeye.app.staging` | `1:767357461507:android:325b76c7d73640b2919a36` | `com.theeye.app.staging` |
| Watch | `com.theeye.watch.staging` | `1:767357461507:android:2d3885701b0ab8db919a36` | — (Wear OS only) |

**Register in Firebase Console → Project settings → Your apps → Android → Add fingerprint:**

| Slot | Purpose | SHA-1 | SHA-256 |
|------|---------|-------|---------|
| Debug (local dev) | `flutter run`, debug APK | `5D:A2:E2:EB:FC:78:16:B9:C1:FE:78:0B:10:2F:D6:1F:0C:80:2A:C7` | `A6:E6:6C:CC:A4:FA:5D:62:17:B7:89:A2:FD:33:06:25:F4:11:D2:48:35:FA:6A:65:C8:68:8F:77:1D:80:32:CB` |
| Upload / release | Play upload key or release keystore | _Run keytool on your keystore — see commands below_ | _Same_ |

Repeat fingerprint registration for **each** Android app (mobile staging + watch staging).

### Production (`the-eye-2pd-d0217`)

| App | Android package | Firebase Android app ID | iOS bundle ID |
|-----|-----------------|-------------------------|---------------|
| Mobile | `com.theeye.app` | `1:137367371675:android:7c280f69a27799b3a2ab3e` | `com.theeye.app` |
| Watch | `com.theeye.watch` | `1:137367371675:android:d0366113589d4b80a2ab3e` | — |

Production mobile `google-services.json.example` already documents debug SHA-1 (`5da2e2eb…`) and Android OAuth client `137367371675-it4d63kmap5874h7qcsicvgla993imuj.apps.googleusercontent.com` for package `com.theeye.app`.

| Slot | Purpose | Status |
|------|---------|--------|
| Debug SHA-1/256 | Local production-flavor builds | Documented in repo (matches workstation debug keystore) |
| Play App Signing / release upload key | Store release | **User action** — add when keystore is created |

### Keytool commands

**Debug keystore (default Android SDK):**

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v `
  -keystore "$env:USERPROFILE\.android\debug.keystore" `
  -alias androiddebugkey -storepass android -keypass android
```

**Release / upload keystore (replace paths and alias):**

```powershell
keytool -list -v -keystore C:\path\to\the-eye-upload.jks -alias the-eye-upload
# or PKCS12:
keytool -list -v -keystore C:\path\to\the-eye-upload.p12 -storetype PKCS12
```

**Gradle signing report (all variants):**

```powershell
cd apps/mobile/android
.\gradlew signingReport
cd ..\..\watch\android
.\gradlew signingReport
```

After adding fingerprints, download fresh `google-services.json` per flavor into:

- `apps/mobile/android/app/src/<flavor>/google-services.json`
- `apps/watch/android/app/src/<flavor>/google-services.json`

Then run `pnpm run test:mobile:firebase` and `pnpm run test:watch:firebase`.

---

## OAuth client ID mapping

Values below are from committed `firebase_options_*.dart` and `google-services.json.example`.  
**Web client** = `client_type: 3` (used as `serverClientId` / `androidGoogleWebClientId`).  
**Android client** = `client_type: 1` (package + certificate hash).

### Staging — `the-eye-2stg`

| Client | App | Client ID |
|--------|-----|-----------|
| Web (type 3) | Mobile Android Google Sign-In | `767357461507-rvoedt7hr8452sehgi2qs3v8q69vovuj.apps.googleusercontent.com` |
| Android (type 1) | Mobile `com.theeye.app.staging` | _Add after SHA registration — download `google-services.json`_ |
| iOS | Mobile `com.theeye.app.staging` | Auto-created when iOS app registered (`1:767357461507:ios:ed01b6493b1b5562919a36`) |
| Web / Android | Watch | FCM only today — no Google Sign-In on watch |

Dart reference: `apps/mobile/lib/firebase_options_staging.dart`, `apps/mobile/lib/auth/google_sign_in_config.dart`.

### Production — `the-eye-2pd-d0217`

| Client | App | Client ID |
|--------|-----|-----------|
| Web (type 3) | Mobile | `137367371675-7sikh2svb9k1c7ft8mqsmkmjpqpnav36.apps.googleusercontent.com` |
| Android (type 1) | Mobile `com.theeye.app` | `137367371675-it4d63kmap5874h7qcsicvgla993imuj.apps.googleusercontent.com` |
| iOS | Mobile `com.theeye.app` | `1:137367371675:ios:ec4f52caf970d4aea2ab3e` (Firebase app ID) |
| Watch Android | `com.theeye.watch` | _Register fingerprints; OAuth N/A for watch_ |

Override at build time (optional): `--dart-define=GOOGLE_WEB_CLIENT_ID=...`

### Google Cloud Console (OAuth)

Each Firebase project has a linked GCP project. Verify **separate** OAuth consent screens and clients:

| Check | Staging | Production |
|-------|---------|------------|
| GCP project | `the-eye-2stg` | `the-eye-2pd-d0217` |
| APIs & Services → OAuth consent screen | Staging app name, staging support email | Production app name, production support email |
| Credentials → OAuth 2.0 Client IDs | Must match Firebase-generated IDs above | Must match Firebase-generated IDs above |
| Authorized JavaScript origins | Staging domains below | Production domains below |
| Authorized redirect URIs | Firebase handler URLs below | Firebase handler URLs below |

**Do not** reuse production OAuth client IDs in staging builds or Firebase projects.

---

## Authorized domains (Firebase Authentication)

Firebase Console → **Authentication** → **Settings** → **Authorized domains**.

### Staging (`the-eye-2stg`)

| Domain | Purpose |
|--------|---------|
| `localhost` | Local Flutter / emulator |
| `127.0.0.1` | Local alternative |
| `the-eye-2stg.firebaseapp.com` | Firebase Auth default |
| `the-eye-2stg.web.app` | Firebase Hosting (if used) |
| `staging-api.theeye.com.ng` | Staging API host (OAuth / deep links if needed) |
| `staging-admin.theeye.com.ng` | Staging admin host (**confirm DNS** — placeholder in manifest) |

### Production (`the-eye-2pd-d0217`)

| Domain | Purpose |
|--------|---------|
| `localhost` | Remove before public launch if policy requires |
| `the-eye-2pd-d0217.firebaseapp.com` | Firebase Auth default |
| `the-eye-2pd-d0217.web.app` | Firebase Hosting (if used) |
| `api.theeye.com.ng` | Production API |
| `admin.theeye.ng` | Production admin (see [production-deployment-guide.md](./production-deployment-guide.md)) |
| `theeye.com.ng` | Marketing / privacy policy host |

Admin-web **does not** call Firebase Auth in the browser today; domains still matter for OAuth consent and future web features.

---

## Callback / redirect URLs

### Mobile Google (Android)

Uses Firebase `signInWithProvider(GoogleAuthProvider)` on Android — no custom redirect URI in app code. Requires correct SHA fingerprints + web client ID in Firebase/GCP.

### Mobile Google (iOS)

Uses Google Sign-In / Firebase iOS SDK. Ensure iOS URL schemes from `GoogleService-Info.plist` (REVERSED_CLIENT_ID) are in Xcode.

### Mobile Apple

| Platform | Callback / return URL |
|----------|----------------------|
| iOS | Native — enable **Sign in with Apple** capability; bundle ID per flavor |
| Android / web flow | `https://<project-id>.firebaseapp.com/__/auth/handler` |

| Environment | Apple return URL (Firebase) |
|-------------|----------------------------|
| Staging | `https://the-eye-2stg.firebaseapp.com/__/auth/handler` |
| Production | `https://the-eye-2pd-d0217.firebaseapp.com/__/auth/handler` |

### API exchange (all social)

After Firebase sign-in, mobile calls:

```
POST {THE_EYE_API_URL}/auth/firebase/exchange
{ "idToken": "<firebase-id-token>", "provider": "google.com"|"apple.com", "platform": "ios"|"android", "deviceId": "..." }
```

| Environment | API base URL |
|-------------|--------------|
| Staging | `https://staging-api.theeye.com.ng/v1` |
| Production | `https://api.theeye.com.ng/v1` |

**API env:** set `FIREBASE_PROJECT_ID` to the **same** Firebase project as the mobile build. When unset, the API falls back to `FCM_PROJECT_ID`, then development (`the-eye-29cff`). Startup validation rejects cross-environment mismatches (e.g. staging tokens against a production-configured API).

### Admin web

No Firebase OAuth callbacks. Login: `POST /api/auth/login` → NestJS.

---

## Privacy policy & support email

Required for **Google OAuth consent screen** and **Apple Sign In** registration.

| Field | Recommended value | Notes |
|-------|-------------------|-------|
| Privacy policy URL | `https://theeye.com.ng/privacy` | **Placeholder** — publish page before store/OAuth review |
| Terms of service (optional) | `https://theeye.com.ng/terms` | **Placeholder** |
| Support email | `support@theeye.com.ng` | **Placeholder** — use a monitored inbox |
| Apple contact email | Same support email | Apple Developer → App ID / Services ID |

Use **staging-specific** support/privacy URLs on the staging OAuth consent screen if Google review requires clearly labeled staging apps.

---

## Apple Developer portal — manual steps (no fabricated credentials)

Complete **separately for staging and production** if you use different Services IDs (recommended).

### 1. App ID (Identifiers)

For each iOS bundle ID registered in Firebase:

| Flavor | Bundle ID |
|--------|-----------|
| Staging | `com.theeye.app.staging` |
| Production | `com.theeye.app` |

1. [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Create or edit App ID → enable **Sign in with Apple**
3. Configure as primary App ID

### 2. Services ID (for Firebase Apple provider)

1. Identifiers → **+** → **Services IDs**
2. Create e.g. `com.theeye.app.staging.signin` (staging) and `com.theeye.app.signin` (production)
3. Enable **Sign in with Apple** → Configure:
   - **Primary App ID:** matching iOS App ID
   - **Domains:** `<project-id>.firebaseapp.com`
   - **Return URLs:** `https://<project-id>.firebaseapp.com/__/auth/handler`

| Environment | Firebase domain | Return URL |
|-------------|-----------------|------------|
| Staging | `the-eye-2stg.firebaseapp.com` | `https://the-eye-2stg.firebaseapp.com/__/auth/handler` |
| Production | `the-eye-2pd-d0217.firebaseapp.com` | `https://the-eye-2pd-d0217.firebaseapp.com/__/auth/handler` |

### 3. Sign in with Apple key (.p8)

1. [Keys](https://developer.apple.com/account/resources/authkeys/list) → **+**
2. Enable **Sign in with Apple** → configure with your primary App ID
3. Download **AuthKey_XXXXXXXXXX.p8** once — store in secret manager (**never commit**)
4. Record **Key ID** and **Team ID** (Membership page)

### 4. Firebase Console → Authentication → Apple

For **each** Firebase project (staging, then production):

1. Enable **Apple** provider
2. Enter **Services ID**, **Team ID**, **Key ID**
3. Paste **private key** contents from `.p8`
4. Save

### 5. Xcode (iOS mobile)

1. Open `apps/mobile/ios/Runner.xcworkspace`
2. Select Runner target → **Signing & Capabilities** → **+ Capability** → Sign in with Apple
3. Use flavor-specific bundle IDs (`Development.xcconfig`, `Staging.xcconfig`, `Production.xcconfig`)

### 6. Verify on device

- iOS: Settings → Apple ID → Password & Security → Apps using Apple ID
- Test `SocialAuthService.signInWithApple()` → API exchange → THE EYE session

---

## What's already in the repo vs manual Console work

### Already configured (code / committed config)

- [x] Per-flavor Firebase project IDs in `firebase_options_staging.dart` / `firebase_options_production.dart` (mobile + watch)
- [x] Google web OAuth client IDs in mobile Dart for staging and production
- [x] Production mobile Android OAuth client + debug SHA-1 in `google-services.json.example`
- [x] Social auth flow: Firebase → `POST /v1/auth/firebase/exchange` (Google + Apple)
- [x] Email/password + phone OTP via NestJS (not Firebase)
- [x] Admin-web documented as **non-Firebase** client
- [x] Debug SHA-1/256 extracted from local Android debug keystore (2026-07-12)

### Requires Firebase Console / manual steps

- [ ] Enable **Google** provider (staging + production projects)
- [ ] Enable **Apple** provider with Apple Developer credentials (staging + production)
- [ ] Add SHA-1 and SHA-256 for all Android apps (mobile + watch × staging + production × debug + release keys)
- [ ] Download gitignored `google-services.json` per flavor after fingerprint updates
- [ ] Register iOS apps + download `GoogleService-Info.plist` per flavor
- [ ] Add authorized domains per environment
- [ ] Configure GCP OAuth consent (privacy URL, support email)
- [ ] Set staging API `FIREBASE_PROJECT_ID=the-eye-2stg`
- [ ] Create release/upload keystores and register Play App Signing fingerprints
- [ ] Publish privacy policy and wire support inbox

---

## Checklists

### Staging — Firebase Console (`the-eye-2stg`)

- [ ] Authentication → Sign-in method → **Google** → Enable
- [ ] Authentication → Sign-in method → **Apple** → Enable (after Apple Developer steps)
- [ ] Authentication → Settings → **Authorized domains** — add staging list above
- [ ] Project settings → Android app `com.theeye.app.staging` → add debug SHA-1 + SHA-256
- [ ] Project settings → Android app `com.theeye.watch.staging` → add debug SHA-1 + SHA-256
- [ ] Project settings → add upload/release SHA when keystore exists
- [ ] Download `google-services.json` → `apps/mobile/android/app/src/staging/`
- [ ] Download watch config → `apps/watch/android/app/src/staging/`
- [ ] Register iOS `com.theeye.app.staging` → download plist to flavor folder
- [ ] Confirm `FCM_PROJECT_ID=the-eye-2stg` on staging API deployment
- [ ] Set `FIREBASE_PROJECT_ID=the-eye-2stg` on staging API

### Staging — Google Cloud OAuth

- [ ] OAuth consent screen — staging app name, `support@theeye.com.ng`, privacy URL
- [ ] Verify Web client `767357461507-rvoedt7hr8452sehgi2qs3v8q69vovuj...` exists
- [ ] Authorized origins: `https://the-eye-2stg.firebaseapp.com`, staging admin/API hosts
- [ ] Redirect URIs include `https://the-eye-2stg.firebaseapp.com/__/auth/handler`

### Staging — Android fingerprints

- [ ] Mobile staging — debug SHA-1 + SHA-256
- [ ] Watch staging — debug SHA-1 + SHA-256
- [ ] Upload/release key — when available
- [ ] Re-download all `google-services.json` files

### Staging — Apple Developer

- [ ] App ID `com.theeye.app.staging` — Sign in with Apple enabled
- [ ] Services ID created — domain + return URL for `the-eye-2stg.firebaseapp.com`
- [ ] Sign in with Apple key (.p8) created — Key ID + Team ID recorded securely
- [ ] Firebase Apple provider configured with staging Services ID
- [ ] Xcode capability enabled for staging scheme

### Production — Firebase Console (`the-eye-2pd-d0217`)

- [ ] Authentication → **Google** → Enable
- [ ] Authentication → **Apple** → Enable
- [ ] Authorized domains — production list above (remove `localhost` if required by policy)
- [ ] Android `com.theeye.app` — debug + release SHA fingerprints
- [ ] Android `com.theeye.watch` — debug + release SHA fingerprints
- [ ] Download production `google-services.json` files (gitignored)
- [ ] iOS `com.theeye.app` — `GoogleService-Info.plist`
- [ ] `FIREBASE_PROJECT_ID=the-eye-2pd-d0217` and `FCM_PROJECT_ID=the-eye-2pd-d0217` on production API

### Production — Google Cloud OAuth

- [ ] Production OAuth consent — production branding, privacy URL, support email
- [ ] Web client `137367371675-7sikh2svb9k1c7ft8mqsmkmjpqpnav36...`
- [ ] Android client `137367371675-it4d63kmap5874h7qcsicvgla993imuj...` matches Firebase
- [ ] Origins / redirects for `the-eye-2pd-d0217.firebaseapp.com`, `admin.theeye.ng`

### Production — Android fingerprints

- [ ] Mobile — debug (documented) + Play upload / app signing keys
- [ ] Watch — debug + release
- [ ] Play Console → App signing key SHA-1 registered in Firebase if using Play App Signing

### Production — Apple Developer

- [ ] App ID `com.theeye.app` — Sign in with Apple
- [ ] Production Services ID + return URL for `the-eye-2pd-d0217.firebaseapp.com`
- [ ] Firebase Apple provider with production Services ID (separate from staging)
- [ ] App Store Connect privacy policy URL matches OAuth consent

### Callback URLs (both environments)

- [ ] Firebase Apple handler: `https://<project>.firebaseapp.com/__/auth/handler`
- [ ] Mobile API exchange reachable at correct `THE_EYE_API_URL`
- [ ] No Firebase OAuth wired to admin-web (by design)

### Privacy & support (both environments)

- [ ] Privacy policy live at declared URL
- [ ] Support email monitored
- [ ] OAuth consent screen URLs match published pages

---

## Validation commands

```powershell
# Auth provider manifest ↔ Dart options (no google-services.json required)
pnpm run test:firebase:auth-providers

# Full mobile Firebase wiring (requires gitignored google-services.json)
pnpm run test:mobile:firebase

# Watch Firebase wiring
pnpm run test:watch:firebase

# Production FCM / project guard
pnpm run firebase:guard:production
```

---

## Related files

| Path | Purpose |
|------|---------|
| `apps/mobile/lib/auth/social_auth_service.dart` | Google / Apple client flows |
| `apps/mobile/lib/auth/google_sign_in_config.dart` | Web OAuth client ID per flavor |
| `apps/api/src/modules/auth/auth.service.ts` | `exchangeFirebaseToken`, NestJS login |
| `apps/api/src/common/auth/firebase-auth.verifier.ts` | Firebase ID token verification |
| `scripts/firebase/auth-providers.manifest.json` | Canonical IDs for validation |
| `apps/admin-web/.env.local.example` | Documents admin = no Firebase client |
