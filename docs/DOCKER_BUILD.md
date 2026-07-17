# Docker Build Guide

THE EYE monorepo images build from the **repository root** with pnpm workspaces.

## Image tagging policy

Deployments and validation **must use explicit tags** — never assume `the-eye-api:latest` exists or matches what is running.

| Context | Image name pattern | Set by |
|---------|-------------------|--------|
| **Local dev / compose default** | `the-eye-api:local`, `the-eye-api-tools:local`, `the-eye-admin-web:local` | `THE_EYE_IMAGE_TAG=local` in `.env` (default) |
| **Local with commit** | `the-eye-api:local-<short-sha>` | `THE_EYE_IMAGE_TAG=local-abc1234` before `docker compose build` |
| **Staging VPS / deploy** | `the-eye-api:<full-or-short-sha>` | `export THE_EYE_IMAGE_TAG=<commit-sha>` (deploy workflow default) |
| **Production VPS / deploy** | `the-eye-api:<commit-sha>` | GitHub Deploy workflow `image_tag` input (defaults to `github.sha`) |
| **GHCR (registry mirror)** | `ghcr.io/<owner>/<repo>/api:<commit-sha>` | Deploy workflow build job |
| **CI validate (staging)** | `the-eye-api:staging-validate` | `validate-staging.yml` build step |

Compose resolves runtime images via `THE_EYE_IMAGE_TAG` (see `infra/docker/docker-compose.yml`):

```yaml
image: the-eye-api:${THE_EYE_IMAGE_TAG:-local}
```

GHCR `:latest` tags may be pushed for registry convenience but **are not used for deploy or rollback**. Always pin by commit SHA.

### How operators find the correct tag

On a running host:

```bash
# Tags compose is configured to use (after env interpolation)
docker compose -f infra/docker/docker-compose.yml --env-file .env config | grep -E '^\s+image: the-eye-api'

# Images currently tagged locally
docker compose -f infra/docker/docker-compose.yml images api
docker images --filter reference='*the-eye-api*'
```

From git / CI:

```bash
git rev-parse HEAD          # full SHA used by deploy.yml when image_tag is empty
git rev-parse --short HEAD  # optional short tag for local builds
```

Override for one-off validation without passing a CLI arg:

```bash
export THE_EYE_API_IMAGE=the-eye-api:abc1234
node scripts/validate-api-runtime-image.cjs
```

## pnpm workspace layout

| File | Role |
|------|------|
| `pnpm-workspace.yaml` | Workspace packages: `apps/api`, `apps/admin-web`, `packages/shared`, … |
| Root `package.json` | `packageManager: pnpm@9.15.0` (Corepack) |
| `.npmrc` | *(none — pnpm default `node-linker=isolated`)* |

With the default isolated linker, root `node_modules` contains symlinks into `.pnpm`. **Copying only `/app/node_modules` into a runtime stage breaks resolution** because `.pnpm` and per-package symlinks are not copied together.

The API production image uses **`pnpm deploy`** to emit a self-contained tree with materialized dependencies.

## API (`apps/api/Dockerfile`)

| Stage | Purpose |
|-------|---------|
| `deps` | `pnpm install --frozen-lockfile` with lockfile + workspace manifests |
| `builder` | Build `@the-eye/shared`, Prisma generate, Nest build |
| `deploy-prod` | `pnpm --filter @the-eye/api deploy --prod /app/deploy` — portable prod deps |
| `deploy-tools` | Full deploy (includes `prisma`, `tsx`) for compose tools profile |
| `production` | Non-root `nestjs` user, healthcheck on `/v1/health/ready` |
| `tools` | Same layout as deploy-tools; used by migrate/seed/admin one-shots |

### Production runtime layout (`/app`)

After `pnpm deploy`, the API package lives at the image root:

```
/app
├── dist/main.js
├── src/preload-env.cjs
├── prisma/
├── package.json
└── node_modules/          # materialized prod deps (no workspace symlinks)
```

**CMD:** `node --require ./src/preload-env.cjs dist/main.js`

Key requirements:

- **Corepack + pnpm 9.15.0** — `node:20-alpine` does not ship pnpm; Corepack activates the version pinned in root `packageManager`
- **Monorepo root context** — compose `build.context: ../..`
- **Shared before API** — explicit `pnpm --filter @the-eye/shared run build`
- **Frozen lockfile** — reproducible CI/VPS builds
- **No `COPY node_modules`** — use `pnpm deploy` instead
- **No secrets in image** — runtime env from `.env` / secret manager only

Build locally:

```bash
docker build -f apps/api/Dockerfile --target production -t the-eye-api:local .
```

Tools image (migrate, seed, admin bootstrap):

```bash
docker build -f apps/api/Dockerfile --target tools -t the-eye-api-tools:local .
```

Validate runtime deps after build:

```bash
node scripts/validate-api-runtime-image.cjs the-eye-api:local
# Or omit the arg when THE_EYE_IMAGE_TAG=local (compose default):
node scripts/validate-api-runtime-image.cjs
```

## Admin web (`apps/admin-web/Dockerfile`)

Same pnpm/Corepack pattern. Build args:

- `NEXT_PUBLIC_APP_ENV` — `staging` or `production`
- `NEXT_PUBLIC_API_BASE_URL` — public API path or URL

```bash
docker build \
  --build-arg NEXT_PUBLIC_APP_ENV=staging \
  --build-arg NEXT_PUBLIC_API_BASE_URL=/v1 \
  -f apps/admin-web/Dockerfile --target production \
  -t the-eye-admin:local .
```

## CI regression

`validate-staging.yml` job **Docker images (staging)**:

1. Builds API (`production` target) and admin-web images
2. Runs `scripts/validate-api-runtime-image.cjs` on the API image (`require.resolve` for `reflect-metadata`, `@nestjs/core`, `@prisma/client`, preload path)

Local smoke:

```bash
pnpm run test:docker:smoke
pnpm run test:docker:livekit
node scripts/validate-api-runtime-image.cjs   # resolves tag from compose / THE_EYE_IMAGE_TAG
node scripts/validate-api-runtime-image.cjs the-eye-api:local   # explicit after manual docker build
```

## Tool profile commands

Migrate, seed, and create-admin use the **`tools`** image (`the-eye-api-tools`) with direct Node invocations (no workspace `pnpm --filter`):

```bash
docker compose -f infra/docker/docker-compose.yml --profile tools build api api-migrate
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
```

## .dockerignore

Excludes `node_modules`, tests, mobile app sources, and `.env` files from build context.
