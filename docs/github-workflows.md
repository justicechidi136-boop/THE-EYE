# GitHub Workflows & Release Pipeline

Branch strategy, GitHub Environments, and CI/CD validation for THE EYE. **No workflow deploys to DigitalOcean automatically** — use [Deploy](../.github/workflows/deploy.yml) manually after validation passes.

## Branch strategy

| Branch | Purpose | Workflow |
|--------|---------|----------|
| `feature/*` | Feature work | Open PR → `staging` |
| `staging` | Staging validation & pre-prod sign-off | [Validate Staging](../.github/workflows/validate-staging.yml) on push |
| `main` | Production release | [Validate Production](../.github/workflows/validate-production.yml) on push |

Flow: `feature/*` → PR into `staging` → CI on PR → merge → staging validation → promote to `main` → production validation (with approval) → manual deploy.

## Workflows

| Workflow | Trigger | Environment | Deploys? |
|----------|---------|-------------|----------|
| [CI](../.github/workflows/ci.yml) | PR → `staging` or `main` | *(none)* | No |
| [Validate Staging](../.github/workflows/validate-staging.yml) | Push to `staging`, `workflow_dispatch` | `staging` | No |
| [Validate Production](../.github/workflows/validate-production.yml) | Push to `main`, `release` published, `workflow_dispatch` | `production` | No |
| [Deploy](../.github/workflows/deploy.yml) | `workflow_dispatch` only | `staging` or `production` (input) | Yes (when run manually) |
| [Backup](../.github/workflows/backup.yml) | Cron + `workflow_dispatch` | *(none — uses deploy host secrets at repo level)* | N/A |

### Concurrency

- **CI:** `ci-${{ workflow }}-${{ pr-number }}` — cancel in-progress on new commits.
- **Staging validation:** `staging-validate-${{ ref }}` — cancel in-progress.
- **Production validation:** `production-validate-${{ ref }}` — do not cancel (ensures complete sign-off).
- **Deploy:** `deploy-${{ environment }}` — no cancel (prevents overlapping deployments).

## GitHub Environments (manual setup)

Create two environments under **Settings → Environments**. **Environment vars and secrets are recommended but not required for initial CI green** — validation workflows use canonical fallbacks and emit `::warning::` annotations when vars/secrets are unset. **Configure all vars and secrets before release sign-off** so APK builds, full Firebase wiring validation, and deploy workflows use live environment values.

### `staging`

- **Protection:** Optional reviewers; no production secrets.
- **Variables (vars):**

| Name | Example value |
|------|-----------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://staging-api.theeye.com.ng` *(fallback used when unset)* |
| `THE_EYE_APP_ENV` | `staging` *(fallback used when unset)* |
| `FCM_PROJECT_ID` | `the-eye-2stg` *(fallback used when unset)* |
| `FIREBASE_PROJECT_ID` | `the-eye-2stg` *(fallback used when unset)* |

- **Secrets (names only):**

| Name | Purpose |
|------|---------|
| `MOBILE_GOOGLE_SERVICES_JSON` | Staging flavor `google-services.json` for mobile *(optional until release sign-off — CI falls back to auth-provider manifest validation)* |
| `WATCH_GOOGLE_SERVICES_JSON` | Staging flavor `google-services.json` for watch *(optional until release sign-off — CI falls back to auth-provider manifest validation)* |
| `MOBILE_GOOGLE_SERVICES_JSON_DEVELOPMENT` | *(optional)* Full cross-flavor mobile validation |
| `MOBILE_GOOGLE_SERVICES_JSON_PRODUCTION` | *(optional)* Full cross-flavor mobile validation |
| `WATCH_GOOGLE_SERVICES_JSON_DEVELOPMENT` | *(optional)* Full cross-flavor watch validation |
| `WATCH_GOOGLE_SERVICES_JSON_PRODUCTION` | *(optional)* Full cross-flavor watch validation |

### `production`

- **Protection:** **Required reviewers** (mandatory for production validation jobs).
- **Deployment branches:** Restrict to `main` (recommended).
- **Variables (vars):**

| Name | Example value |
|------|-----------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.theeye.com.ng` *(fallback used when unset)* |
| `THE_EYE_APP_ENV` | `production` *(fallback used when unset)* |
| `FCM_PROJECT_ID` | `the-eye-2pd-d0217` *(fallback used when unset)* |
| `FIREBASE_PROJECT_ID` | `the-eye-2pd-d0217` *(fallback used when unset)* |

- **Secrets (names only):**

| Name | Purpose |
|------|---------|
| `FCM_CLIENT_EMAIL` | Firebase Admin SDK service account email |
| `FCM_PRIVATE_KEY` | Firebase Admin SDK private key |
| `MOBILE_GOOGLE_SERVICES_JSON` | Production flavor mobile `google-services.json` *(optional until release sign-off — CI falls back to auth-provider manifest validation)* |
| `WATCH_GOOGLE_SERVICES_JSON` | Production flavor watch `google-services.json` *(optional until release sign-off — CI falls back to auth-provider manifest validation)* |
| `MOBILE_GOOGLE_SERVICES_JSON_DEVELOPMENT` | *(optional)* Full cross-flavor validation |
| `MOBILE_GOOGLE_SERVICES_JSON_STAGING` | *(optional)* Full cross-flavor validation |
| `WATCH_GOOGLE_SERVICES_JSON_DEVELOPMENT` | *(optional)* Full cross-flavor validation |
| `WATCH_GOOGLE_SERVICES_JSON_STAGING` | *(optional)* Full cross-flavor validation |

### Deploy workflow secrets (per environment)

Used only by [deploy.yml](../.github/workflows/deploy.yml) when you choose to deploy:

| Name | Purpose |
|------|---------|
| `DEPLOY_HOST` | SSH target host |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | SSH private key |
| `DEPLOY_PATH` | Remote repo/deploy directory |

Optional deploy var: `SMOKE_BASE_URL` — post-deploy health check URL.

## Secret isolation rules

1. **PR CI** — No `environment:` block; uses inline CI-safe test values only. Cannot read staging/production secrets.
2. **Staging jobs** — `environment: staging` only; never `production`.
3. **Production jobs** — `environment: production`; requires reviewer approval when configured.
4. **Firebase guards** — Staging rejects `the-eye-2pd-d0217` and `the-eye-29cff`; production rejects `the-eye-2stg`, `the-eye-29cff`, `localhost`, `staging-api`.

## Mobile/watch `google-services.json` secrets (graceful fallback)

Primary flavor secrets (`MOBILE_GOOGLE_SERVICES_JSON`, `WATCH_GOOGLE_SERVICES_JSON`) are **optional for initial CI green** on staging and production validation workflows. When unset:

- Workflows emit a **warning annotation** and skip materializing `google-services.json`, full `test:mobile:firebase` / `test:watch:firebase`, and flavor APK builds.
- **`test:firebase:auth-providers` always runs** — manifest, Dart options, and cross-env leakage checks do not require gitignored JSON files.

When the primary secret **is** set, production/staging guards still apply (e.g. production JSON must not reference `the-eye-2stg` or `the-eye-29cff`). Full cross-flavor validation runs only when **all** optional per-flavor secrets for that environment are also present.

**Before release sign-off**, add the primary and cross-flavor secrets so APK builds and full Firebase wiring validation execute in CI.

## Environment var fallbacks (graceful CI)

When GitHub environment vars are unset, validation workflows resolve canonical fallbacks:

| Var | Production fallback | Staging fallback |
|-----|---------------------|------------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.theeye.com.ng` | `https://staging-api.theeye.com.ng` |
| `THE_EYE_APP_ENV` | `production` | `staging` |
| `FCM_PROJECT_ID` | `the-eye-2pd-d0217` | `the-eye-2stg` |
| `FIREBASE_PROJECT_ID` | `the-eye-2pd-d0217` | `the-eye-2stg` |

Security guards still fail (exit 1) when resolved values reference forbidden cross-environment identifiers (e.g. production URL containing `staging-api`). The [Deploy](../.github/workflows/deploy.yml) workflow remains strict — it requires vars at deploy time.

## What each validation covers

### CI (pull requests)

- API lint, Prisma validate, migrate deploy, backend tests
- Admin lint + structure smoke
- Mobile & watch Flutter analyze + test
- Firebase auth-provider manifest, deploy-env docs, production guard unit tests

No Docker builds (fast feedback).

### Staging validation

- API lint/test/build, Prisma validate + migrate diff + deploy
- Admin staging build + bundle isolation
- Mobile staging APK, watch staging debug APK *(skipped with warning when `MOBILE_GOOGLE_SERVICES_JSON` / `WATCH_GOOGLE_SERVICES_JSON` unset)*
- Firebase staging guards
- Docker admin image build + bundle isolation
- Auth-provider manifest validation (always); optional full `google-services.json` validation when all flavor secrets are present

### Production validation

- Production Firebase guard (`firebase:guard:production`)
- Production mobile/watch builds and package checks *(APK builds skipped with warning when primary `google-services.json` secrets unset)*
- Auth-provider manifest validation (always); optional full Firebase wiring when all flavor secrets present
- Admin production bundle validation
- Artifact leakage scan (`the-eye-2stg`, `the-eye-29cff`, `localhost`, `staging-api`)
- Release notes artifact + version tag on `workflow_dispatch` / `release`

## Manual GitHub UI checklist

1. Create `staging` and `production` environments.
2. Add variables listed above to each environment.
3. Add secrets listed above (download `google-services.json` from Firebase Console per flavor).
4. On **production** environment: enable **Required reviewers** and add release approvers.
5. Ensure branch protection on `staging` and `main` (require CI + validation status checks when branches exist).
6. Confirm [deploy.yml](../.github/workflows/deploy.yml) is **not** triggered on push (already `workflow_dispatch` only).

## Branch coordination

If `staging` or `main` branches do not exist yet, workflows will not run until those branches are created (typically by a branch-setup task). Feature branches should target `staging` once it exists.

## Local parity commands

```bash
pnpm run test:firebase:auth-providers
pnpm run test:deploy:env
pnpm run test:firebase:guard
pnpm run test:mobile:firebase    # requires local google-services.json files
pnpm run test:watch:firebase
pnpm run firebase:guard:production
```

See also [deployment.md](./deployment.md) and [FIREBASE_AUTH_PROVIDERS.md](./FIREBASE_AUTH_PROVIDERS.md).
