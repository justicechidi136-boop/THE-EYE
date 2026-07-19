# Firebase Staging Authentication

Mobile staging builds use Firebase project **`the-eye-2stg`**. The API must verify ID tokens against the same project.

## Root cause

When `FIREBASE_PROJECT_ID` / `FCM_PROJECT_ID` were unset or pointed at **`the-eye-29cff`** (development), the API verified tokens against the wrong project while the staging mobile APK uses **`the-eye-2stg`** — causing **"Invalid Firebase identity token"** on `POST /v1/auth/firebase/exchange`.

Resolution order in `apps/api/src/common/auth/firebase-project.ts`:

1. `FIREBASE_PROJECT_ID` (explicit — **required on staging VPS**)
2. `FCM_PROJECT_ID`
3. Service account `project_id`
4. `THE_EYE_APP_ENV` (`staging` → `the-eye-2stg`, `production` → `the-eye-2pd-d0217`)
5. Default `the-eye-29cff` (development only)

## Required staging configuration

### API (Docker `.env`)

```env
THE_EYE_APP_ENV=staging
FCM_PROJECT_ID=the-eye-2stg
FIREBASE_PROJECT_ID=the-eye-2stg
# FCM credentials via secret manager — never commit
FCM_CLIENT_EMAIL=...
FCM_PRIVATE_KEY=...
```

Compose passes these to the `api` service environment block. `assertStagingFirebaseGuard()` **fails API startup** if either project ID is missing or not `the-eye-2stg`.

### Mobile

| Flavor | Package | Firebase project |
|--------|---------|------------------|
| staging | `com.theeye.app.staging` | `the-eye-2stg` |

Build (always pass `THE_EYE_FLAVOR` — do not rely on Gradle flavor alone):

```bash
cd apps/mobile
flutter build apk --flavor staging --dart-define=THE_EYE_FLAVOR=staging
```

Validate:

```bash
pnpm run test:mobile:firebase
node scripts/validate-firebase-auth-providers.cjs
```

## Safe diagnostics (no secret logging)

```bash
# Quick Firebase probe (project IDs only — no keys)
curl -s https://staging-api.theeye.com.ng/v1/health/ready | jq .firebase

# Full health payload
curl -s https://staging-api.theeye.com.ng/v1/health/ready | jq .

# Verify env on running container (project IDs only)
docker compose -f infra/docker/docker-compose.yml exec api printenv FIREBASE_PROJECT_ID FCM_PROJECT_ID THE_EYE_APP_ENV

# API logs — look for "Firebase token verification failed" with expectedProject/tokenAud
docker compose -f infra/docker/docker-compose.yml logs api --tail=100 | grep -i firebase
```

Expected healthy staging values:

```json
{
  "appEnvironment": "staging",
  "authProjectId": "the-eye-2stg",
  "adminProjectId": "the-eye-2stg",
  "adminConfigured": true,
  "adminSimulation": false
}
```

Do **not** log `FCM_PRIVATE_KEY`, JWT secrets, or ID tokens.

## Staging error codes

When token `aud` does not match the API project, staging returns HTTP 401 with:

```json
{
  "statusCode": 401,
  "message": {
    "message": "Invalid Firebase identity token",
    "code": "FIREBASE_TOKEN_PROJECT_MISMATCH",
    "expectedProjectId": "the-eye-2stg",
    "tokenAud": "the-eye-29cff"
  }
}
```

The mobile app surfaces this as a project mismatch hint (rebuild staging APK or fix API env).

## Guards

- `assertStagingFirebaseGuard()` requires `FCM_PROJECT_ID` and `FIREBASE_PROJECT_ID` = `the-eye-2stg` when `THE_EYE_APP_ENV=staging`
- CI: `validate-staging.yml` Firebase job enforces `the-eye-2stg`

## Related

- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- [FIREBASE_AUTH_PROVIDERS.md](./FIREBASE_AUTH_PROVIDERS.md)
- [staging-test-accounts.md](./staging-test-accounts.md)
