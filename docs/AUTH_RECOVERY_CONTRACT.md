# Auth Recovery URL Contract

**Branch:** `fix/auth-recovery-qa`  
**QA IDs:** AUTH-001, AUTH-005, AUTH-006  
**Owner (code):** Auth / Mobile / Admin-web  
**Owner (TLS):** DevOps  

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

## Logging policy

- Log **hostname only** after send (`host=staging-dashboard8jps.theeye.com.ng`).
- Never log full reset/recovery URLs or raw tokens in shared evidence.
