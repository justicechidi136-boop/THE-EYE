# DigitalOcean App Platform — admin-web build-time env

THE EYE admin-web bakes `NEXT_PUBLIC_*` values into the Next.js bundle at **image build time**. Runtime App Platform environment variables do **not** change client-side API routing after deploy.

## Required build-time variables

| Variable | Staging | Production |
|----------|---------|------------|
| `NEXT_PUBLIC_APP_ENV` | `staging` | `production` |
| `NEXT_PUBLIC_API_BASE_URL` | GitHub/DO staging API URL (HTTPS) | GitHub/DO production API URL (HTTPS) |

Use your verified API hostnames from infrastructure secrets management — do not commit real URLs into the repository.

## Option A — Dockerfile component (recommended)

If the App spec uses `dockerfile_path: apps/admin-web/Dockerfile` with `target: production`, set **Build Time Environment Variables** (DO UI) or `build_env` in the spec:

```yaml
services:
  - name: admin-web
    dockerfile_path: apps/admin-web/Dockerfile
    source_dir: /
    github:
      branch: main
      deploy_on_push: true
    build_env:
      - key: NEXT_PUBLIC_APP_ENV
        value: staging
      - key: NEXT_PUBLIC_API_BASE_URL
        value: ${STAGING_API_BASE_URL}
```

For production, duplicate the component in a separate App or environment with:

```yaml
    build_env:
      - key: NEXT_PUBLIC_APP_ENV
        value: production
      - key: NEXT_PUBLIC_API_BASE_URL
        value: ${PRODUCTION_API_BASE_URL}
```

Bind `${STAGING_API_BASE_URL}` / `${PRODUCTION_API_BASE_URL}` to App-level encrypted env vars in the DO dashboard. These are public browser endpoints (HTTPS URLs), not server secrets.

## Option B — Pre-built image from GitHub Actions

When deploying `ghcr.io/<org>/<repo>/admin-web:<tag>` built by `.github/workflows/deploy.yml`, **do not** set `NEXT_PUBLIC_*` on the DO service — values are already embedded. Only configure runtime server vars such as `API_ORIGIN` if SSR uses relative `/v1` paths behind an internal network.

## Runtime variables (server-only)

| Variable | Purpose |
|----------|---------|
| `API_ORIGIN` | SSR / `/api/auth` upstream when `NEXT_PUBLIC_API_BASE_URL` is a relative path |
| `JWT_ACCESS_SECRET` | Cookie verification in middleware (never `NEXT_PUBLIC_*`) |

## Validation

The Dockerfile runs `apps/admin-web/scripts/validate-docker-build-env.mjs` before `next build`. Builds fail when:

- build args are missing
- `NEXT_PUBLIC_APP_ENV` is not `staging` or `production`
- API URL uses `http://`, `localhost`, or cross-environment hosts

## Staging vs production isolation

Maintain **separate** DO Apps (or separate GitHub Environments + deploy workflows) so staging builds never receive production `NEXT_PUBLIC_API_BASE_URL` values.

Verified DO fields: `build_env` on Dockerfile-based components ([App spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)).

## Manual checklist (production)

1. Create GitHub Environment `production` with `vars.NEXT_PUBLIC_API_BASE_URL`.
2. Create DO App (production) — do not deploy until staging is verified.
3. Run `workflow_dispatch` deploy with `environment=production`.
4. Confirm bundle isolation via `node scripts/validate-admin-docker-bundle.cjs`.
