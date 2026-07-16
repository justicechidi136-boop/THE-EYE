# Staging Troubleshooting

Quick reference for THE EYE staging VPS (Ubuntu 24.04, Docker Compose).

## API container won't build

**Symptom:** `pnpm: not found` or lockfile errors

**Fix:** Use current `apps/api/Dockerfile` with Corepack + `pnpm install --frozen-lockfile`. Build from repo root. See [DOCKER_BUILD.md](./DOCKER_BUILD.md).

```bash
docker build -f apps/api/Dockerfile --target production -t the-eye-api:test .
```

## LiveKit fails to start

**Symptom:** `could not parse keys` in livekit logs

**Fix:** `LIVEKIT_KEYS` must be `"keyName: secret"` with a **space after colon**. See [LIVEKIT_DEPLOYMENT.md](./LIVEKIT_DEPLOYMENT.md).

```bash
pnpm run test:docker:livekit
docker logs the-eye-livekit 2>&1 | tail -20
```

## nginx exits on first deploy

**Symptom:** `ERROR: TLS certificates missing`

**Fix:** Use TLS bootstrap — `THE_EYE_TLS_BOOTSTRAP=auto`, `THE_EYE_SSL_REDIRECT=false`. See [NGINX_TLS_BOOTSTRAP.md](./NGINX_TLS_BOOTSTRAP.md).

## Invalid Firebase Identity Token (mobile)

**Symptom:** Mobile staging login fails; API returns 401 on `/v1/auth/exchange`

**Fix:** Ensure API has `FCM_PROJECT_ID=the-eye-2stg` and `FIREBASE_PROJECT_ID=the-eye-2stg`. Rebuild mobile with `--flavor staging`. See [FIREBASE_STAGING_AUTH.md](./FIREBASE_STAGING_AUTH.md).

```bash
docker exec the-eye-api printenv FIREBASE_PROJECT_ID FCM_PROJECT_ID THE_EYE_APP_ENV
```

## Admin login fails after deploy

**Fix:** Run idempotent bootstrap:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-create-admin
```

See [ADMIN_BOOTSTRAP.md](./ADMIN_BOOTSTRAP.md).

## Health checks

```bash
curl -sf http://localhost/healthz                    # nginx
curl -sf http://localhost/v1/health/ready            # API (via nginx HTTP bootstrap)
docker compose -f infra/docker/docker-compose.yml ps
```

## Logs

```bash
docker logs the-eye-api --tail 100
docker logs the-eye-nginx --tail 50
docker logs the-eye-livekit --tail 50
```

## Validation scripts

```bash
pnpm run test:docker:smoke
pnpm run test:deploy:env
pnpm run test:docker:livekit
```

## Environment isolation checklist

- [ ] `THE_EYE_APP_ENV=staging`
- [ ] `FCM_PROJECT_ID=the-eye-2stg`
- [ ] `FIREBASE_PROJECT_ID=the-eye-2stg`
- [ ] No `the-eye-29cff` or `the-eye-2pd-d0217` in staging `.env`
- [ ] Staging LiveKit keys (not production)
- [ ] `CORS_ORIGINS` matches staging admin URL
