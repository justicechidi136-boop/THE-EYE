# Staging Test Accounts

Idempotent staging-only test accounts for QA, integration tests, and manual console verification. These accounts are **never** created in production.

## Recreate command

From the repository root, with staging env loaded (`THE_EYE_APP_ENV=staging`, staging `DATABASE_URL`, and `STAGING_TEST_*` credentials set):

```bash
pnpm --filter @the-eye/api run seed:staging:test-accounts
```

Optional login probe (requires a running staging API):

```bash
pnpm --filter @the-eye/api run verify:staging:test-accounts
```

## Required environment

| Variable | Purpose |
| --- | --- |
| `THE_EYE_APP_ENV` | Must be `staging` |
| `DATABASE_URL` | Staging Postgres — must not match production patterns |
| `FCM_PROJECT_ID` | Must be `the-eye-2stg` when set |
| `FIREBASE_PROJECT_ID` | Must be `the-eye-2stg` when set |
| `STAGING_TEST_<ROLE>_EMAIL` | Account email per role (see below) |
| `STAGING_TEST_<ROLE>_PASSWORD` | Account password per role |
| `STAGING_API_BASE_URL` | Optional — base URL for verify script (e.g. `https://staging-api.example.test`) |
| `STAGING_TEST_WATCH_PAIRED_CITIZEN_DEVICE_ID` | Optional — smartwatch `device_id` (default `staging-watch-paired-001`) |
| `STAGING_TEST_CITIZEN_PHONE` | Optional citizen phone |
| `STAGING_TEST_WATCH_PAIRED_CITIZEN_PHONE` | Optional watch-paired citizen phone |

Copy `apps/api/.env.staging.example` for the full list of `STAGING_TEST_*` placeholders.

## Guard behavior

The seed and verify scripts abort unless:

1. `THE_EYE_APP_ENV` is `staging` (or `stg`).
2. No production indicators are present in `FCM_PROJECT_ID`, `FIREBASE_PROJECT_ID`, or `DATABASE_URL` (patterns include `the-eye-2pd`, `prod`, `production`).
3. When `FCM_PROJECT_ID` / `FIREBASE_PROJECT_ID` are set, they must be `the-eye-2stg`.

Passwords are hashed with the same `scrypt` format used by `AuthService` (`hashPassword` in `apps/api/src/common/auth/crypto.ts`).

## Role and jurisdiction mapping

| Account | DB model | Admin role | Jurisdiction scope | Agency / extras |
| --- | --- | --- | --- | --- |
| Super Admin | `admin_users` | Super Admin | Nigeria / All / All | — |
| Country Admin | `admin_users` | Country Admin | Nigeria / All / All | — |
| State Admin | `admin_users` | State Admin | Nigeria / Lagos / All | — |
| LGA Admin | `admin_users` | LGA Admin | Nigeria / Lagos / Ikeja | — |
| Agency Officer | `admin_users` | Police/Security Officer | Nigeria / Lagos / Ikeja | Ikeja Police Command (Staging) |
| Neighborhood Watch Admin | `admin_users` | Community Moderator | Nigeria / Lagos / Ikeja | Allen Avenue Estate (Staging) community |
| Citizen | `users` + `profiles` | — (citizen JWT) | Nigeria / Lagos / Ikeja profile | — |
| Watch-paired citizen | `users` + `profiles` + `smartwatch_devices` | — (citizen JWT) | Nigeria / Lagos / Ikeja profile | Paired `SmartwatchDevice` + completed `SmartwatchPairingSession` |

## Watch-paired citizen setup

The watch-paired citizen seed creates:

- A `users` row with scrypt password hash and `profiles` in Ikeja, Lagos.
- A `smartwatch_devices` row (`device_id` from env or `staging-watch-paired-001`) with:
  - `connectivityMode=PairedPhone`, `pairingMethod=PairingCode`
  - `deviceSecretHash`, `serialNumber=STG-WATCH-0001`, `isActive=true`
  - Staging metadata tag for traceability
- A used `smartwatch_pairing_sessions` row (`firebaseEnv=staging`, `usedAt` set) indicating completed pairing.

This mirrors the production pairing flow without requiring a running API during seed.

## Authentication probe

When `STAGING_API_BASE_URL` is set, `verify:staging:test-accounts` POSTs to `/v1/auth/login`:

- Admin accounts: `{ email, password, admin: true }`
- Citizens: `{ email, password }`

The script skips gracefully when the API is unreachable and never prints passwords.

## Security notes

- Never commit real `STAGING_TEST_*` passwords.
- Never run `seed:staging:test-accounts` against production databases or Firebase projects.
- Rotate staging passwords through your secret manager and re-run the seed to update hashes idempotently.
