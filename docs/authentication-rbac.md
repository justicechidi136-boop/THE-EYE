# Authentication and RBAC

THE EYE supports citizen authentication and admin authentication with scoped access control.

## Login Methods

- Email and password: `POST /v1/auth/login` with `{ "email", "password" }`.
- Phone and password: `POST /v1/auth/login` with `{ "phone", "password" }`.
- Admin login: `POST /v1/auth/login` with `{ "email", "password", "admin": true }`.
- Google login: `POST /v1/auth/google` with Google identity data. The current implementation is an adapter boundary; production must verify Google ID tokens against Google before trusting them.
- Phone OTP: `POST /v1/auth/phone/request-otp` and `POST /v1/auth/phone/verify-otp`.

## Token Flow

- Access tokens are signed JWTs with subject, actor type, role, permissions, and scope claims.
- Refresh tokens are signed JWTs stored server-side as SHA-256 hashes in `refresh_tokens`.
- Refresh calls rotate tokens and revoke the previous refresh token.
- Logout revokes the provided refresh token.

## Development admin login

For local and staging environments, seed a disposable super-admin with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env.example`. Set real values only in an untracked `.env` file — never commit production passwords. Run `pnpm --filter @the-eye/api run db:seed` after migrations, or `db:create-admin` to upsert a single admin account.

## Password Reset

- `POST /v1/auth/password-reset/request` creates a short-lived hashed reset token.
- `POST /v1/auth/password-reset/confirm` updates the password, marks the token used, and revokes active refresh tokens.
- Production should send reset links through an email/SMS provider instead of returning tokens.

## Admin Roles

- Super Admin: sees everything.
- Country Admin: sees incidents in assigned country.
- State Admin: sees incidents in assigned country and state.
- LGA Admin: sees incidents in assigned country, state, and LGA.
- Agency Admin: sees incidents assigned to their agency.
- Police/Security Officer: sees incidents assigned to their agency.
- Call Center Agent: sees incidents in assigned LGA and can create/update intake records.
- Oversight Auditor: can read scoped incidents and audit logs but cannot modify incidents.

## Protected Routes

The current API protects:

- `/v1/users/me`
- `/v1/incidents`
- `/v1/incidents/:id`
- `/v1/incidents/:id/status`
- `/v1/audit`
- `/v1/broadcasts`
- `/v1/storage/presign`
- `/v1/notifications/send`

## Production Notes

- Replace the development Google adapter with real Google ID token verification.
- Send OTPs and password reset tokens through provider integrations.
- Move secrets to a secret manager.
- Add rate limits to login, OTP, password reset, and refresh endpoints.
- Add account lockout and anomaly detection for repeated failed attempts.
