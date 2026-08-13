# Auth Recovery URL Contract

**Branch:** `fix/auth-007-citizen-recovery-return`  
**QA IDs:** AUTH-001, AUTH-005, AUTH-006, AUTH-007  
**Owner (code):** Auth / Mobile / Admin-web  
**Owner (TLS / citizen host):** DevOps  

## AUTH-007 root cause (routing)

Citizen reset/recovery **form pages** are temporarily hosted on the Admin Dashboard origin (`staging-dashboard8jps.theeye.com.ng`) because that host has validated TLS (AUTH-001/006). Historically the success CTA linked to admin `/login`, so “Return to sign in” opened the Admin Dashboard. AUTH-007 separates:

1. **Email / form host** — HTTPS citizen reset/recovery pages (may share dashboard origin until a dedicated citizen auth host exists).
2. **Return destination** — custom-scheme deep link into THE EYE **citizen mobile** sign-in only. Never admin `/login`.

Preferred long-term form hosts (when TLS/DNS ready): `staging.theeye.com.ng`, `app.theeye.com.ng`. Do **not** use `staging-app.theeye.com.ng` (Cloudflare 526).

## Authoritative contracts

### Password reset (AUTH-001)

```
https://staging-dashboard8jps.theeye.com.ng/reset-password?token=<opaque-token>
```

| Field | Value |
|---|---|
| Scheme | `https` only |
| Staging host | `staging-dashboard8jps.theeye.com.ng` (also allowed: `staging.theeye.com.ng`) |
| Path | `/reset-password` |
| Token | Query param `token`, URL-encoded via `URLSearchParams` |
| Env source | `PASSWORD_RESET_LINK_BASE_URL` (fallback `MOBILE_PASSWORD_RESET_URL`) |

### Account recovery (AUTH-006)

```
https://staging-dashboard8jps.theeye.com.ng/account-recovery?token=<opaque-token>
```

| Field | Value |
|---|---|
| Scheme | `https` only |
| Staging host | Same allowlist as reset |
| Path | `/account-recovery` |
| Token | Query param `token` |
| Env source | `ACCOUNT_RECOVERY_LINK_BASE_URL` (fallbacks: `MOBILE_ACCOUNT_RECOVERY_URL`, `AUTH_RECOVERY_DEEP_LINK_BASE`) |

### Citizen return deep link (AUTH-007)

```
theeye-staging://auth/login?result=PASSWORD_RESET_SUCCESS
theeye://auth/login?result=ACCOUNT_RECOVERY_SUCCESS
```

| Field | Value |
|---|---|
| Staging scheme | `theeye-staging` (package `com.theeye.app.staging`) |
| Production scheme | `theeye` (package `com.theeye.app`) |
| Development scheme | `theeye-dev` |
| Host / path | `auth` / `/login` → existing Flutter route `/login` |
| Query | `result` only (`PASSWORD_RESET_SUCCESS`, `ACCOUNT_RECOVERY_SUCCESS`, …) |
| Forbidden | reset/recovery tokens, JWTs, credentials, admin `/login`, Field Ops / Watch schemes |
| Env override | API `CITIZEN_APP_RETURN_SCHEME`; admin-web `NEXT_PUBLIC_CITIZEN_APP_RETURN_SCHEME` |
| Soft landing | `/app/sign-in?result=…` (public; attempts deep link; never redirects to admin `/login`) |

## Centralization

All citizen-facing reset/recovery links MUST be built by:

`apps/api/src/modules/auth/auth-recovery-urls.ts`

- `buildAuthActionLink(base, token, kind)`
- `validateAuthLinkBaseUrl` / `assertStagingAuthLinkBases`

Do **not** concatenate hosts or tokens in templates or other services.

## Rejected hosts / patterns

| Pattern | Reason |
|---|---|
| `http://` | AUTH-URL-003 insecure |
| `localhost`, `127.0.0.1`, Docker/internal names | Not citizen-reachable |
| `staging-app.theeye.com.ng` | Historical Cloudflare 526 origin |
| `staging-api.theeye.com.ng`, LiveKit hosts | API/media, not recovery UI |
| Production hosts while `THE_EYE_APP_ENV=staging` | AUTH-URL-004 |

Internal validation codes (`AUTH-URL-001`…`006`) are for startup/CI logs only — never shown to end users.

## Frontend routes

| Path | App | Behavior |
|---|---|---|
| `/reset-password` | `apps/admin-web` | Public; reads `?token=`; confirms new password via API |
| `/account-recovery` | `apps/admin-web` | Public; verifies token; instructs completion in mobile app |
| `/account-recovery` | Mobile | Request form + success confirmation |
| `/account-recovery/complete` | Mobile | Google completion with route args |

### AUTH-007 citizen return-to-app rule

- Success CTA label: **Return to THE EYE** (custom scheme only).
- Citizen-facing reset/recovery pages must never use `href="/login"` or redirect to Admin Dashboard as fallback.
- Soft-landing `/app/sign-in` and `/sign-in` are public middleware exceptions; they open the mobile app, not admin auth.
- Mobile handles cold / background / foreground returns via `app_links` → `pushNamedAndRemoveUntil("/login", …)` with a safe status message.
- If the citizen is already authenticated, return navigation goes to `/home` (existing session policy) — still never Admin Web.
- Admin `/login` remains for the Admin product only.

## Logging policy

- Log **hostname only** after send (`host=staging-dashboard8jps.theeye.com.ng`).
- Never log full reset/recovery URLs or raw tokens in shared evidence.
