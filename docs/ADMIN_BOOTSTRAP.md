# Admin Bootstrap (Staging)

Create the initial Super Admin on a fresh staging database.

## Idempotent upsert

`api-create-admin` runs `apps/api/prisma/create-admin.ts`:

- Upserts `SuperAdmin` role and jurisdiction
- Upserts admin user by `ADMIN_EMAIL`
- Updates password hash on re-run (safe to repeat)

## Usage

Set in `.env` (never commit real passwords):

```env
ADMIN_EMAIL=staging-admin@theeye.com.ng
ADMIN_PASSWORD=<strong-staging-password>
```

After migrations:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-create-admin
```

Expected output:

```
Super admin created successfully
Email: staging-admin@theeye.com.ng
```

## Staging test accounts

For QA role-based accounts, use `api-seed-staging` with `STAGING_TEST_*` vars — see [staging-test-accounts.md](./staging-test-accounts.md).

## Production warning

Do **not** run `api-create-admin` in production unless intentionally creating that specific account. Production admins should be provisioned through controlled processes.

## Troubleshooting

| Issue | Check |
|-------|-------|
| `ADMIN_EMAIL and ADMIN_PASSWORD are required` | Set both in `.env` |
| DB connection refused | Ensure `postgres-postgis` is healthy; run `api-migrate` first |
| Login fails after bootstrap | Confirm admin-web points at same API; check CORS origins |
