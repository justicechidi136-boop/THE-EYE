# Firebase Staging Authentication

Mobile staging builds use Firebase project **`the-eye-2stg`**. The API must verify ID tokens against the same project.

## Root cause (fixed)

Previously, when `FIREBASE_PROJECT_ID` and `FCM_PROJECT_ID` were unset in Docker, `resolveFirebaseProjectId()` defaulted to **`the-eye-29cff`** (development). Mobile staging APKs use **`the-eye-2stg`**, causing **"Invalid Firebase Identity Token"** on `/v1/auth/exchange`.

Fix (commit `3cbfd9c` area): resolution order in `apps/api/src/common/auth/firebase-project.ts`:

1. `FIREBASE_PROJECT_ID` (explicit)
2. `FCM_PROJECT_ID`
3. Service account `project_id`
4. Default `the-eye-29cff` (development only)

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

Compose passes these to the `api` service environment block.

### Mobile

| Flavor | Package | Firebase project |
|--------|---------|------------------|
| staging | `com.theeye.app.staging` | `the-eye-2stg` |

Build:

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
# API health — includes Firebase probe metadata (no keys)
curl -s https://staging-api.theeye.com.ng/v1/health/ready | jq .

# Verify env on running container (project IDs only)
docker exec the-eye-api printenv | grep -E '^(THE_EYE_APP_ENV|FCM_PROJECT_ID|FIREBASE_PROJECT_ID)='
```

Do **not** log `FCM_PRIVATE_KEY`, JWT secrets, or ID tokens.

## Guards

- `assertStagingFirebaseGuard()` rejects production/dev project IDs when `THE_EYE_APP_ENV=staging`
- CI: `validate-staging.yml` Firebase job enforces `the-eye-2stg`

## Related

- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
- [FIREBASE_AUTH_PROVIDERS.md](./FIREBASE_AUTH_PROVIDERS.md)
- [staging-test-accounts.md](./staging-test-accounts.md)
