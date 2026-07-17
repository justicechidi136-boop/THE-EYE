# GitHub Workflows & Release Pipeline

Branch strategy, GitHub Environments, and CI/CD validation for THE EYE. **No workflow deploys to DigitalOcean automatically** — use [Deploy](../.github/workflows/deploy.yml) manually after validation passes.

## Branch strategy

| Branch | Purpose | Workflow |
|--------|---------|----------|
| `feature/*` | Feature work | Open PR → `staging` |
| `staging` | Staging validation & pre-prod sign-off | [Validate Staging](../.github/workflows/validate-staging.yml) on push |
| `main` | Production release | [Validate Production](../.github/workflows/validate-production.yml) on push |

Flow: `feature/*` → PR into `staging` → CI on PR → merge → staging validation → promote to `main` → production validation (Job A always; Job B when secrets configured) → manual deploy (Job C).

## Workflows

| Workflow | Trigger | Environment | Deploys? |
|----------|---------|-------------|----------|
| [CI](../.github/workflows/ci.yml) | PR → `staging` or `main` | *(none)* | No |
| [Validate Staging](../.github/workflows/validate-staging.yml) | Push to `staging`, `workflow_dispatch` | `staging` | No |
| [Validate Production](../.github/workflows/validate-production.yml) | Push to `main`, `release` published, `workflow_dispatch` | Job A: none; Job B: `production` | No |
| [Deploy](../.github/workflows/deploy.yml) | `workflow_dispatch` only | `staging` or `production` (input) | Yes (when run manually) |
| [Backup](../.github/workflows/backup.yml) | Cron + `workflow_dispatch` | *(none — uses deploy host secrets at repo level)* | N/A |

### Concurrency

- **CI:** `ci-${{ workflow }}-${{ pr-number }}` — cancel in-progress on new commits.
- **Staging validation:** `staging-validate-${{ ref }}` — cancel in-progress.
- **Production validation:** `production-validate-${{ ref }}` — do not cancel (ensures complete sign-off).
- **Deploy:** `deploy-${{ environment }}` — no cancel (prevents overlapping deployments).

## Production validation split (Jobs A / B / C)

Production CI is intentionally split so **static validation can pass without GitHub production secrets**, while **release and deploy remain fail-closed**.

| Job | Workflow file | GitHub environment | Secrets required? | Builds deployable artifacts? |
|-----|---------------|-------------------|-------------------|------------------------------|
| **A — `production-static-validation`** | validate-production.yml | *(none)* | No | No — compile/manifest checks only |
| **B — `production-release-build`** | validate-production.yml | `production` (+ reviewers) | Yes — all three below | Yes — APK, admin bundle, release notes |
| **C — `production-deploy`** | deploy.yml | `production` (+ reviewers) | Yes + `confirm_release_build_passed` | Yes — Docker images pushed to GHCR |

### Required for Job B and Job C (hard gate — no fallbacks)

| Name | Type | Purpose |
|------|------|---------|
| `MOBILE_GOOGLE_SERVICES_JSON` | secret | Production mobile `google-services.json` |
| `WATCH_GOOGLE_SERVICES_JSON` | secret | Production watch `google-services.json` |
| `NEXT_PUBLIC_API_BASE_URL` | var | Production admin API URL (HTTPS, no staging/localhost/placeholder) |

Job B also requires production vars (`THE_EYE_APP_ENV`, `FCM_PROJECT_ID`, `FIREBASE_PROJECT_ID`) and FCM secrets for the API release build.

### Workflow report outputs

The final `production-readiness-report` job emits:

| Output | Values |
|--------|--------|
| Mobile Firebase secret | `PRESENT` / `MISSING` |
| Watch Firebase secret | `PRESENT` / `MISSING` |
| Production API URL | `PRESENT` / `MISSING` |
| Static validation | `PASS` / `FAIL` |
| Release artifact verification | `PASS` / `BLOCKED` |
| Deployment readiness | `GO` / `NO-GO` |

When secrets are missing, Job A logs:

- `SECRET NOT PROVIDED`
- `MANIFEST FALLBACK USED`
- `ARTIFACT BUILD NOT VERIFIED`

## Fallback behavior table

| Check | Job A (static) | Job B (release) | Job C (deploy) |
|-------|----------------|-----------------|----------------|
| `MOBILE_GOOGLE_SERVICES_JSON` | Not required — manifest/auth-provider checks | **Required** — fail immediately | **Required** |
| `WATCH_GOOGLE_SERVICES_JSON` | Not required — manifest/auth-provider checks | **Required** — fail immediately | **Required** |
| `NEXT_PUBLIC_API_BASE_URL` | CI compile-only URL (`https://production-ci-compile.theeye.internal`) — **non-deploying** | **Required** from GitHub production var — no fallback | **Required** — no fallback |
| `THE_EYE_APP_ENV` / Firebase project vars | Hardcoded manifest IDs (`the-eye-2pd-d0217`) | **Required** from GitHub — no fallback | Uses deploy environment vars |
| Mobile/watch APK build | Skipped (`ARTIFACT BUILD NOT VERIFIED`) | Full production APK | N/A (server deploy) |
| Admin Docker image | Not built | Not built in validate (deploy builds image) | Built with explicit `NEXT_PUBLIC_API_BASE_URL` |
| Staging Firebase in production | Rejected by isolation guards | Rejected — gate fails | Rejected |

**No fake `google-services.json` files are created.** Job A never materializes JSON; Job B only writes real secret payloads.

## GitHub Environments (manual setup)

Create two environments under **Settings → Environments**.

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
| `MOBILE_GOOGLE_SERVICES_JSON` | Staging flavor `google-services.json` for mobile |
| `WATCH_GOOGLE_SERVICES_JSON` | Staging flavor `google-services.json` for watch |
| `MOBILE_GOOGLE_SERVICES_JSON_DEVELOPMENT` | *(optional)* Full cross-flavor mobile validation |
| `MOBILE_GOOGLE_SERVICES_JSON_PRODUCTION` | *(optional)* Full cross-flavor mobile validation |
| `WATCH_GOOGLE_SERVICES_JSON_DEVELOPMENT` | *(optional)* Full cross-flavor watch validation |
| `WATCH_GOOGLE_SERVICES_JSON_PRODUCTION` | *(optional)* Full cross-flavor watch validation |

### `production`

- **Protection:** **Required reviewers** (mandatory for Job B and deploy).
- **Deployment branches:** Restrict to `main` (recommended).
- **Variables (vars):**

| Name | Example value |
|------|-----------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.theeye.com.ng` **(required for Job B/C — no fallback)** |
| `THE_EYE_APP_ENV` | `production` **(required for Job B — no fallback)** |
| `FCM_PROJECT_ID` | `the-eye-2pd-d0217` **(required for Job B)** |
| `FIREBASE_PROJECT_ID` | `the-eye-2pd-d0217` **(required for Job B)** |

- **Secrets (names only):**

| Name | Purpose |
|------|---------|
| `FCM_CLIENT_EMAIL` | Firebase Admin SDK service account email |
| `FCM_PRIVATE_KEY` | Firebase Admin SDK private key |
| `MOBILE_GOOGLE_SERVICES_JSON` | **Required for Job B/C** |
| `WATCH_GOOGLE_SERVICES_JSON` | **Required for Job B/C** |
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

Production deploy additionally requires `confirm_release_build_passed: true` in workflow inputs (attest that Job B passed for the target SHA).

## Secret isolation rules

1. **PR CI** — No `environment:` block; uses inline CI-safe test values only. Cannot read staging/production secrets.
2. **Staging jobs** — `environment: staging` only; never `production`.
3. **Production Job A** — No `environment:` block; cannot read production secrets; uses manifest/constants only.
4. **Production Job B/C** — `environment: production`; requires reviewer approval when configured; fail closed when secrets/vars missing.
5. **Firebase guards** — Staging rejects `the-eye-2pd-d0217` and `the-eye-29cff`; production rejects `the-eye-2stg`, `the-eye-29cff`, `localhost`, `staging-api`.

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
- Mobile staging APK, watch staging debug APK *(skipped with warning when secrets unset)*
- Firebase staging guards
- Docker API image build tagged `the-eye-api:staging-validate` + `scripts/validate-api-runtime-image.cjs`
- Docker admin image build + bundle isolation

### Production Job A (static)

- API lint/test/build, Prisma validate + migrate diff
- Admin **lint + compile** with CI-only URL (not deployable)
- Mobile/watch analyze + auth-provider manifest (no APK)
- Firebase guard **unit tests** (not live FCM credential check)
- Deploy env documentation
- Explicit `SECRET NOT PROVIDED` / `MANIFEST FALLBACK USED` / `ARTIFACT BUILD NOT VERIFIED` notices

### Production Job B (release)

- Fail-closed gate for all three hard requirements
- Production Firebase guard with live FCM credentials
- Production mobile/watch APK builds with real `google-services.json`
- Admin production bundle with real `NEXT_PUBLIC_API_BASE_URL`
- Artifact leakage scan
- Release notes artifact + version tag on `workflow_dispatch` / `release`

### Production Job C (deploy)

- Preflight gate (secrets + `confirm_release_build_passed`)
- Docker API + admin-web images tagged with explicit commit SHA (`image_tag` input or `github.sha`); GHCR `:latest` is a registry pointer only
- SSH deploy sets `THE_EYE_IMAGE_TAG` to the same SHA on the VPS
- SSH deploy to DigitalOcean

## Local parity commands

```bash
pnpm run test:ci:production-guards   # scenarios A–E
pnpm run test:firebase:auth-providers
pnpm run test:deploy:env
pnpm run test:firebase:guard
pnpm run test:mobile:firebase    # requires local google-services.json files
pnpm run test:watch:firebase
pnpm run firebase:guard:production   # requires local FCM credentials
node scripts/ci/production-readiness-report.mjs --mode static-report
```

See also [deployment.md](./deployment.md) and [FIREBASE_AUTH_PROVIDERS.md](./FIREBASE_AUTH_PROVIDERS.md).
