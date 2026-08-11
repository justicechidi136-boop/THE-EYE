# Auth Recovery Staging QA Procedure

**QA IDs:** AUTH-001, AUTH-005, AUTH-006  
**Do not deploy from this branch** — DevOps owns staging deploy.  
**Do not capture raw recovery/reset tokens in shared logs.**

## Preconditions

1. Staging API SHA includes `auth-recovery-urls` contract.
2. Env on API:
   - `PASSWORD_RESET_LINK_BASE_URL=https://staging-dashboard8jps.theeye.com.ng/reset-password`
   - `ACCOUNT_RECOVERY_LINK_BASE_URL=https://staging-dashboard8jps.theeye.com.ng/account-recovery`
3. Admin-web staging host serves `/reset-password` and `/account-recovery` (public).
4. SMTP configured for citizen auth email.

## Forgot password (AUTH-001 + AUTH-005)

| Step | Action | Capture | Pass criteria |
|---|---|---|---|
| 1 | Mobile: Forgot password with validly formatted email | Request timestamp | Button disables while in flight |
| 2 | Confirm API `POST /v1/auth/password-reset/request` | HTTP status only | `200`/`201`/`204` (anti-enumeration) |
| 3 | Confirm success banner on login screen | Screenshot | Copy: “If an account matches that email, password-reset instructions have been sent.” (not danger red) |
| 4 | Receive email | Inbox subject | THE EYE branding + Reset password button |
| 5 | Inspect link hostname only | Hostname | `staging-dashboard8jps.theeye.com.ng` (or approved `staging.theeye.com.ng`) |
| 6 | Open reset link | HTTP status / page | **HTTP 200**, valid reset form — **NOT Cloudflare 526** |
| 7 | Set new password | — | Success state + return to login |
| 8 | Log in with new password | — | Session established |

## Account recovery (AUTH-006)

| Step | Action | Capture | Pass criteria |
|---|---|---|---|
| 1 | Mobile: Recover account | Request timestamp | Success confirmation visible |
| 2 | API `POST /v1/auth/account-recovery/request` | Status | Accepted |
| 3 | Email link hostname | Hostname only | Approved staging host + `/account-recovery` |
| 4 | Open link | Page result | HTTP 200 / verified page — **NOT 526** |
| 5 | Complete recovery in mobile (Google) | — | Session restored |

## Evidence template (no secrets)

```
Deployed API SHA:
Admin-web SHA:
APK SHA-256:
Request timestamp (UTC):
Forgot-password API status:
Forgot-password UI confirmation: PASS/FAIL
Reset link hostname:
Reset page result: HTTP ___ / Cloudflare 526 / other
Recovery link hostname:
Recovery page result: HTTP ___ / Cloudflare 526 / other
AUTH-001: CODE VERIFIED / E2E PASS / FAIL / TLS BLOCKED
AUTH-005: PASS / FAIL
AUTH-006: CODE VERIFIED / E2E PASS / FAIL / TLS BLOCKED
```

## Status rule

Do **not** mark AUTH-001 or AUTH-006 **PASS** while any reset/recovery link returns Cloudflare Error 526.
Code-complete with pending TLS is reported as:

`AUTH RECOVERY CODE COMPLETE — STAGING TLS QA PENDING`
