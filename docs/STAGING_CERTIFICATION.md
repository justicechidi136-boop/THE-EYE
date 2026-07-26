# Staging Certification Runbook

Operational checklist for THE EYE staging release certification (not Sprint 8).

## Deployed baseline

| Item | Value |
|------|--------|
| Branch | `staging` |
| VPS HEAD | Must match `origin/staging` after deploy |
| Compose project | `the-eye` |
| API image | `the-eye-api:${THE_EYE_IMAGE_TAG}` |
| Tools image | `the-eye-api-tools:${THE_EYE_IMAGE_TAG}` |
| Admin image | `the-eye-admin-web:${THE_EYE_IMAGE_TAG}` |
| Firebase project | `the-eye-2stg` |
| Android package | `com.theeye.app.staging` |

## Blocker IDs

| ID | Summary |
|----|---------|
| DEP-005 | Nginx stale upstream after container recreation |
| DEP-006 | Staging seed runner unavailable |
| SRB-032 | Firebase release certificate registration |
| RC-APK-001 | Certification APK rebuild after Firebase |
| RC-QA-001 | Physical-device certification |

## 1. Deploy staging

```bash
export THE_EYE_IMAGE_TAG=$(git rev-parse HEAD)
bash scripts/deploy-staging.sh
```

Confirm:

- `docker compose -f infra/docker/docker-compose.yml ps` — api, admin-web, nginx, worker healthy
- `bash scripts/staging-smoke-check.sh` — proxied API `/v1/health/ready` passes
- No manual nginx restart required

## 2. Seed certification data

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-tools \
  prisma/seed-staging-test-accounts.ts
```

Run again to confirm idempotency, then verify:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-tools \
  scripts/verify-staging-certification-data.ts
```

Expected records (labels contain `(Staging)` / `staging-cert-*`):

- Approved community membership for staging citizen
- Active patrol schedule
- Verified staging police station (`sourceReference=staging-cert-ikeja-gate-001`)
- Role-based admin/citizen accounts from `STAGING_TEST_*` env vars

## 3. Firebase operator handoff (SRB-032)

**Project:** `the-eye-2stg`  
**Android app:** `com.theeye.app.staging`

1. Firebase Console → Project Settings → Your apps → Android (`com.theeye.app.staging`)
2. Add fingerprint → paste **staging release SHA-1** and **SHA-256** from the certification APK manifest (see §4)
3. Authentication → Sign-in method → ensure **Google** is enabled
4. Google Cloud Console → Credentials → confirm Android OAuth client matches package + SHA-1
5. Download fresh `google-services.json` if Firebase regenerates clients
6. Update GitHub secret `MOBILE_GOOGLE_SERVICES_JSON` / repo staging config per policy — **never commit service account private keys**

Status until fingerprints are registered: **OPS ACTION REQUIRED**

## 4. Certification APK (RC-APK-001)

Build only after Firebase fingerprints are registered and staging is deployed.

**Note:** Staging release builds require a **dedicated staging keystore** — see [STAGING_ANDROID_SIGNING.md](./STAGING_ANDROID_SIGNING.md). Prior APKs signed with the debug certificate are **not** certification-ready.

```bash
git fetch origin
git worktree add ../the-eye-certification origin/staging
cd ../the-eye-certification/apps/mobile
# Configure THE_EYE_STAGING_* env vars or android/key.properties first
flutter clean && flutter pub get
flutter test
flutter build apk --release --flavor staging --dart-define=THE_EYE_FLAVOR=staging
node ../../scripts/validate-staging-apk-signing.cjs \
  --apk build/app/outputs/flutter-apk/app-staging-release.apk \
  --reject-debug
```

## 5. Physical QA (RC-QA-001)

Priority order:

1. Google Sign-In (after uninstall/reinstall)
2. Account recovery email + deep link
3. Dark mode — Neighborhood Watch + auth/forms
4. SOS Live Video — logcat, no crash
5. Neighborhood Watch — community, post, volunteer, patrol checkpoint
6. Family Circle relationship persistence
7. Real SOS device with simulation disabled

Do not mark **DEVICE VERIFIED** without fresh evidence on the certification APK.

## Status progression

`CODE FIXED` → `CI VERIFIED` → `DEPLOYED` → `RUNTIME VERIFIED` → `DEVICE VERIFIED`

Sprint 8 remains **NOT AUTHORIZED** until staging certification completes.
