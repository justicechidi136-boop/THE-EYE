# Local development quick fix

If admin login or UI changes do not appear, work through this checklist.

## 1. Fix database connection (`apps/api/.env`)

Prisma reads `apps/api/.env`. The API will not start until `DATABASE_URL` is valid.

- Use your real Postgres user and password.
- On **Windows**, put the raw password in quotes in `.env` (do **not** URL-encode `$` etc. — encoded passwords break Prisma). On Linux/macOS, URL-encoding special characters is fine.
- Ensure the `the_eye` database exists and migrations have been applied.

Example shape (replace user/password):

```env
DATABASE_URL="postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/the_eye?schema=public"
DATABASE_DIRECT_URL="postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/the_eye?schema=public"
```

Verify:

```bash
cd apps/api
npx prisma migrate status
```

## 2. Create the disposable dev admin

```bash
cd apps/api
pnpm run db:create-admin
```

Uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `apps/api/.env` (defaults documented in repo-root `.env.example`).

## 3. Start both services (two terminals)

**Terminal A — API (port 4000):**

```bash
pnpm --filter @the-eye/api run start:dev
```

**Terminal B — Admin web (port 3000):**

```bash
pnpm --filter @the-eye/admin-web run dev
```

`apps/admin-web/.env.local` must include:

```env
API_ORIGIN=http://localhost:4000
NEXT_PUBLIC_API_URL=/v1
JWT_ACCESS_SECRET=dev-access-secret-32-chars-minimum!!
```

`JWT_ACCESS_SECRET` must match `JWT_ACCESS_SECRET` in `apps/api/.env` so the admin app can verify login cookies.

Restart admin-web after changing `.env.local`.

## 4. Log in

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/login |
| Email | `dev-admin@theeye.local` |
| Password | value of `ADMIN_PASSWORD` in `apps/api/.env` (default placeholder: `change_me_dev_admin_password`) |

## 5. If branding / dark theme still looks old

1. Stop and restart `pnpm --filter @the-eye/admin-web run dev`
2. Hard refresh the browser: `Ctrl+Shift+R`
3. Confirm `apps/admin-web/public/brand/` contains the logo PNGs

## Common failures

| Symptom | Cause |
|---------|-------|
| Login returns 401 / network error | API not running on port 4000 |
| API crashes on start | Invalid `DATABASE_URL` |
| Old password still works / new email fails | Re-run `pnpm run db:create-admin` (seed now updates existing admins on conflict) |
| Login returns 500 after first success | Fixed: refresh tokens now include a unique `jti`. Restart the API if you still see this. |
| Login page 500 / missing `.next` files | Stop admin-web, delete `apps/admin-web/.next`, restart `pnpm --filter @the-eye/admin-web run dev` |
