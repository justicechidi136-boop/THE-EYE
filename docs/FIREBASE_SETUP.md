# Firebase — THE EYE environment matrix

Do **not** create Firebase projects from this repository. Use the confirmed project IDs below.

| Environment | Firebase project ID | CLI alias | Console |
|-------------|---------------------|-----------|---------|
| Development | `the-eye-29cff` | `development` | [Console](https://console.firebase.google.com/project/the-eye-29cff/overview) |
| Staging | `the-eye-2stg` | `staging` | [Console](https://console.firebase.google.com/project/the-eye-2stg/overview) |
| Production | `the-eye-2pd-d0217` | `production` | [Console](https://console.firebase.google.com/project/the-eye-2pd-d0217/overview) |

`.firebaserc` maps `default` → development (`the-eye-29cff`). Production is **not** the default alias.

## 1. CLI login and safe environment switching

```powershell
firebase login
```

From the repository root:

```powershell
pnpm run firebase:current
pnpm run firebase:use:development
pnpm run firebase:use:staging
pnpm run firebase:use:production
```

These wrap `firebase use <alias>` and only allow the three approved aliases.

Show active project:

```powershell
pnpm run firebase:current
```

## 2. Production guard (before deploy)

Fails when:

- Active Firebase CLI project is not `the-eye-2pd-d0217`
- `FCM_PROJECT_ID` is not `the-eye-2pd-d0217`
- `FCM_CLIENT_EMAIL` or `FCM_PRIVATE_KEY` is missing
- Development project `the-eye-29cff` appears in production configuration
- FCM simulation mode is enabled (`FCM_ALLOW_SIMULATION=true` or missing FCM credentials)

```powershell
# Set production FCM credentials in the environment first, then:
pnpm run firebase:guard:production
```

## 3. API push notifications (FCM)

THE EYE sends push via a **Firebase service account** (not the CLI login). Use credentials from the **matching environment project**.

| Environment | `FCM_PROJECT_ID` |
|-------------|------------------|
| Development | `the-eye-29cff` |
| Staging | `the-eye-2stg` |
| Production | `the-eye-2pd-d0217` |

1. Firebase Console → **Project settings** → **Service accounts** (for the target environment project)
2. **Generate new private key** → save JSON locally (do not commit)
3. Add to `apps/api/.env` (development) or deployment secrets (staging/production):

```env
FCM_PROJECT_ID=the-eye-29cff
FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@<project-id>.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Restart the API after updating `.env`. Without credentials, push runs in **simulated** mode (never acceptable in production).

## 4. Mobile app (Flutter)

Register Android/iOS apps **per environment** in the matching Firebase project.

| Flavor | Android package | iOS bundle ID | Firebase project |
|--------|-----------------|---------------|------------------|
| `development` | `com.theeye.app.dev` | `com.theeye.app.dev` | `the-eye-29cff` |
| `staging` | `com.theeye.app.staging` | `com.theeye.app.staging` | `the-eye-2stg` |
| `production` | `com.theeye.app` | `com.theeye.app` | `the-eye-2pd-d0217` |

Watch Android uses `com.theeye.watch.dev`, `.staging`, and `com.theeye.watch`.

Build commands (from `apps/mobile` or `apps/watch`):

```powershell
flutter build apk --flavor development --debug
flutter build apk --flavor staging --debug
flutter build apk --flavor production --debug
```

Place `google-services.json` under `android/app/src/<flavor>/` and `GoogleService-Info.plist` per iOS flavor (gitignored; copy from `.example` templates until registered).

```bash
cd apps/mobile
dart pub global activate flutterfire_cli
flutterfire configure --project=the-eye-29cff   # development
# flutterfire configure --project=the-eye-2stg  # staging
# flutterfire configure --project=the-eye-2pd-d0217   # production
```

**Committed `firebase_options_*.dart` files use placeholder `apiKey` values** (e.g. `REPLACE_WITH_STAGING_API_KEY`). These are intentional — never commit real Google API keys. After `flutterfire configure`, your local copy gets the real key from Firebase; keep that change local or rely on gitignored `google-services.json` / `GoogleService-Info.plist`, which also carry the key at build time. CI validates project IDs, app IDs, and OAuth wiring via `pnpm run test:firebase:auth-providers` and `pnpm run test:secrets`; it does not require real apiKeys in tracked Dart files.

Dependencies in `pubspec.yaml`: `firebase_core`, `firebase_messaging`.

## 5. Public web app (Vite — `apps/web`)

Use `VITE_FIREBASE_*` in `apps/web/.env.local` (gitignored). Set `VITE_FIREBASE_PROJECT_ID` to the environment project ID. Template: `apps/web/.env.local.example`.

**Admin web** (`apps/admin-web`) is Next.js — use `NEXT_PUBLIC_FIREBASE_*` if a client SDK is added later.

## 6. Hosting vs Docker/nginx

**Production THE EYE uses Docker Compose + nginx** (`infra/docker/docker-compose.yml`). That path is unchanged.

`firebase.json` retains an **optional** static hosting stub (`apps/admin-web/out`) for future static export only. The previous Cloud Run `/v1/**` rewrite was removed because THE EYE does not deploy API via Firebase Cloud Run.

Do not run `firebase deploy` to production without explicit approval and `pnpm run firebase:guard:production`.

## 7. Auth providers (Google, Apple, fingerprints)

Staging and production **sign-in provider** readiness (OAuth client IDs, SHA fingerprints, Apple Developer steps, authorized domains, checklists) is documented in **[FIREBASE_AUTH_PROVIDERS.md](./FIREBASE_AUTH_PROVIDERS.md)**.

Validate committed provider wiring:

```powershell
pnpm run test:firebase:auth-providers
```
