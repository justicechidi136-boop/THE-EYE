# Docker Build Guide

THE EYE monorepo images build from the **repository root** with pnpm workspaces.

## API (`apps/api/Dockerfile`)

| Stage | Purpose |
|-------|---------|
| `deps` | `pnpm install --frozen-lockfile` with lockfile + workspace manifests |
| `builder` | Build `@the-eye/shared`, Prisma generate, Nest build |
| `production` | Non-root `nestjs` user, healthcheck on `/v1/health/ready` |

Key requirements:

- **Corepack + pnpm 9.15.0** — `node:20-alpine` does not ship pnpm; Corepack activates the version pinned in root `packageManager`
- **Monorepo root context** — compose `build.context: ../..`
- **Shared before API** — explicit `pnpm --filter @the-eye/shared run build` (do not rely on removing `prebuild` alone)
- **Frozen lockfile** — reproducible CI/VPS builds
- **No secrets in image** — runtime env from `.env` / secret manager only

Build locally:

```bash
docker build -f apps/api/Dockerfile --target production -t the-eye-api:local .
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

`validate-staging.yml` job **Docker images (staging)** builds both API and admin-web images on every push to `staging`.

Local smoke:

```bash
pnpm run test:docker:smoke
pnpm run test:docker:livekit
```

## Tool profile commands

Migrate, seed, and create-admin use the API image with pnpm:

```bash
docker compose -f infra/docker/docker-compose.yml --profile tools run --rm api-migrate
```

## .dockerignore

Excludes `node_modules`, tests, mobile app sources, and `.env` files from build context.
