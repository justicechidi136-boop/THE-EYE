# Staging Certification Runbook

Operational checklist for THE EYE staging release certification (not Sprint 8).

## Deployed baseline

| Item | Value |
|------|--------|
| Branch | `staging` |
| VPS HEAD (deployed) | `3d39c6347809f91f54cefd85c77b98fb4e1a69ba` (Deploy run [30213547336](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/30213547336)) |
| Pending follow-up | Staging citizen login + anonymous audit constraint + edge retry (commit after `3d39c63`) |
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
| SRB-032 | Firebase release certificate registration — **CI VERIFIED** (dedicated SHA-1/256 in JSON secrets) |
| RC-APK-001 | Certification APK rebuild after Firebase — **CI VERIFIED** (signed release APKs uploaded) |
| RC-QA-001 | Physical-device certification — **PENDING** (mobile clean-install only; Google Sign-In not executed) |

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

## 6. Certification run — 2026-07-26 (`f6f6dee`)

| Item | Value |
|------|--------|
| Source / VPS SHA | `f6f6dee071a19f206b2fc5fd78da4df056a1131f` |
| Dedicated staging keystore | **GENERATED** (local secure store; not in repo) |
| Canonical SHA-1 | `9B:03:F4:99:01:79:DC:EA:14:DE:39:6B:74:D6:DC:92:C5:46:5A:05` |
| Canonical SHA-256 | `DE:75:8A:04:36:5F:BB:C1:DF:66:EF:5D:11:E9:1A:47:6E:0D:55:9B:7D:A7:D9:B0:5B:0E:79:C1:2A:F8:28:E0` |
| GitHub `staging` secrets | `STAGING_ANDROID_*` configured; `MOBILE_GOOGLE_SERVICES_JSON` **not set** |
| Firebase fingerprints | **NOT REGISTERED** in `the-eye-2stg` (OPS) |
| Mobile unit tests @ `f6f6dee` | **181 / 181 PASS** |
| Certification APK | `artifacts/mobile/THE-EYE-staging-0.1.0-f6f6dee.apk` (local worktree; not committed) |
| APK SHA-256 (file) | `54496b0542d4ea9580cd7b0647a9aa3fd09ec16f90308857a4259b04bfb4311f` |
| Signing verification | **PASS** — dedicated release cert; debug cert rejected |
| Device | Vivo V2322 · Android 15 · serial `10AD****0010Y` |
| Clean install | **PASS** — package `com.theeye.app.staging` v0.1.0; MainActivity resumes |
| Priority device QA | **PENDING** — Google Sign-In blocked until Firebase OPS |

**Build note:** AGP 8.11.1 requires `androidComponents.onVariants` for staging release signing (local hotfix applied during build; **not yet on `origin/staging`**). Merge hotfix before CI staging APK builds.

**Status:** `PARTIALLY BLOCKED` — Firebase OPS required before final APK rebuild and Google Sign-In QA.

## 7. Certification continuation — 2026-07-26T12:10Z

| Item | Status |
|------|--------|
| Firebase fingerprint registration | **NOT DONE** — local `google-services.json` still references debug cert `5da2e2eb…` |
| `MOBILE_GOOGLE_SERVICES_JSON` | **NOT SET** in GitHub `staging` environment |
| Gradle signing hotfix | **PR #29** @ `1bd50e6` — `fix/android-staging-signing-agp811` → `staging` (await approval; not merged) |
| Local regression @ `f6f6dee` | API **347/347**, mobile **181/181**, watch **63/63**, admin lint/tsc PASS |
| Final certification APK | **NOT REBUILT** — blocked on Firebase OPS + hotfix merge |
| Device QA A–H | **NOT TESTED** — prior APK must not be reused for Google Sign-In certification |

**Operator action required:** Register canonical SHA-1/SHA-256 in Firebase Console (`the-eye-2stg`), download fresh `google-services.json`, set `MOBILE_GOOGLE_SERVICES_JSON`, then rebuild final APK after PR #29 merge + deploy.
