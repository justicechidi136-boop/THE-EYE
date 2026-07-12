# THE EYE — Security Audit Report

**Date:** 2026-07-10  
**Role:** Senior Cyber Security Engineer  
**Target:** OWASP Top 10 (2021) compliance  
**Scope:** JWT, RBAC, uploads, API, SQLi, XSS, CSRF, replay, rate limits, authZ, evidence/S3, secrets, Docker, Nginx, headers

---

## Executive Summary

| Result | Detail |
|--------|--------|
| **Backend security tests** | **86/86 passed** |
| **Docker / env smoke** | Passed |
| **Lint & build** | Passed |
| **Critical findings fixed** | 4 |
| **High findings fixed** | 9 |
| **Medium findings fixed** | 8 |

**Verdict:** Critical and high-severity vulnerabilities identified in audit were remediated. Residual medium/low items are documented with compensating controls.

---

## OWASP Top 10 Mapping

| OWASP | Risk | Status | Key controls |
|-------|------|--------|--------------|
| **A01 Broken Access Control** | High | **Remediated** | DB-backed JWT resolution, scoped admin device/user/notification access |
| **A02 Cryptographic Failures** | High | **Remediated** | JWT signature verify in admin middleware, production secret enforcement, refresh family invalidation |
| **A03 Injection** | Medium | **Mitigated** | Parameterized SQL, evidence key validation, ValidationPipe whitelist |
| **A04 Insecure Design** | Medium | **Mitigated** | Evidence prefix enforcement, metrics/docs blocked at nginx |
| **A05 Security Misconfiguration** | High | **Remediated** | Docker localhost bind, CSP/HSTS headers, seed blocked in prod |
| **A06 Vulnerable Components** | Low | **Accepted** | Dependencies pinned via lockfile; no known CVE patches applied this pass |
| **A07 Auth Failures** | High | **Remediated** | Live permission reload, refresh replay detection, logout revocation |
| **A08 Software/Data Integrity** | High | **Remediated** | Evidence objectKey/bucket binding, content-type signed uploads |
| **A09 Logging Failures** | Low | **Partial** | Audit hash chain; security event logging via rate-limit warnings |
| **A10 SSRF** | Low | **Mitigated** | No user-controlled outbound URL fetch paths in API |

---

## Vulnerabilities Found & Fixed

### Critical (fixed)

| ID | Issue | Fix |
|----|-------|-----|
| SEC-001 | **Evidence poisoning** — clients could attach arbitrary S3 `bucket`/`objectKey` | `assertEvidenceObjectKey()` enforces `evidence/{incidentId}/` prefix + bucket match |
| SEC-002 | **Admin session bypass** — middleware parsed JWT without signature verification | `verify-jwt.ts` verifies HS256 (Web Crypto, Edge-safe); middleware + `getAdminSession()` use it |
| SEC-003 | **Infrastructure exposure** — Postgres/Redis/MinIO on `0.0.0.0` | Docker ports bound to `127.0.0.1` only |
| SEC-004 | **Public metrics/docs** — `/metrics` and `/docs` proxied without auth | Nginx returns 403; API requires `METRICS_BEARER_TOKEN` in production |

### High (fixed)

| ID | Issue | Fix |
|----|-------|-----|
| SEC-005 | Stale/forged JWT permissions trusted from token payload | `JwtAuthGuard` reloads admin/user from DB on every request |
| SEC-006 | Refresh token reuse not detected | Revoked refresh reuse invalidates entire token family |
| SEC-007 | Smartwatch admin devices leaked global PII | `adminDevices()` filtered by admin jurisdiction |
| SEC-008 | User directory exposed all citizens to agency admins | `citizenScopeWhere()` denies non-scoped roles |
| SEC-009 | Notifications send had no geographic scope | `assertAdminCanTarget()` enforces jurisdiction |
| SEC-010 | Presigned PUT did not bind Content-Type | Signature includes `content-type;host` |
| SEC-011 | Dev OTP/reset tokens could leak in staging | `allowDevAuthCodes()` only when `NODE_ENV=development` |
| SEC-012 | Standalone smartwatch login brute-forceable | Rate limit `auth` policy applied |
| SEC-013 | Logout left refresh tokens valid | Admin logout calls `POST /v1/auth/logout` |

### Medium (fixed)

| ID | Issue | Fix |
|----|-------|-----|
| SEC-014 | Missing CSP on API/admin/nginx | CSP added to API middleware, Next.js headers, nginx |
| SEC-015 | CSRF cookie policy lax | Session cookies `sameSite: "strict"` |
| SEC-016 | Production seed with known passwords | `seed.ts` exits in production |
| SEC-017 | Community post media unvalidated | Evidence prefix validation on NW media |
| SEC-018 | JWT dev secret fallbacks in production path | `requireJwtAccessSecret()` / `requireJwtRefreshSecret()` |
| SEC-019 | Refresh DB expiry ignored JWT_REFRESH_TTL | `parseTtl()` drives DB `expiresAt` |
| SEC-020 | METRICS not required in prod env | `validate-env.ts` requires `METRICS_BEARER_TOKEN` |
| SEC-021 | Nginx missing Permissions-Policy | Added to global nginx headers |

---

## Security Test Results

```
pnpm run test:backend     → 86/86 passed
  - jwt-security.spec.ts
  - security-hardening.spec.ts
  - evidence-security.spec.ts
  - metrics.controller.spec.ts (bearer auth)
pnpm run test:docker:smoke → passed (127.0.0.1 bind, metrics blocked)
pnpm run test:deploy:env   → passed (19 variables)
pnpm run lint              → passed
pnpm run build             → passed
```

New tests:
- `evidence-security.spec.ts` — prefix traversal, bucket mismatch, content-type signing
- `security-hardening.spec.ts` — production `METRICS_BEARER_TOKEN` requirement
- `metrics.controller.spec.ts` — bearer token gate

---

## Residual Risks & Compensating Controls

| Risk | Severity | Notes |
|------|----------|-------|
| MinIO root credentials in API container | Medium | Bucket anonymous access disabled; scoped IAM user recommended for production hardening |
| Access JWT lacks `jti`/denylist | Medium | 15m TTL + DB permission reload reduces blast radius |
| Google `tokeninfo` endpoint | Medium | Aud/email_verified checked; migrate to `google-auth-library` for cert pinning |
| Smartwatch GPS replay without nonce | Medium | Device secret + rate limits; HMAC timestamp window recommended |
| WKT geometry DoS | Low | PostGIS inputs parameterized; vertex limits not yet enforced |
| LiveKit/mobile token consumption | Low | Operational — tokens issued server-side correctly |

---

## Production Security Checklist

1. Set all secrets in `.env` (≥24 chars, no `change_me` / `dev` prefixes)
2. Set `METRICS_BEARER_TOKEN` and scrape via internal network only
3. Set `THE_EYE_SSL_REDIRECT=true` after TLS certificates are installed
4. Keep `ALLOW_DEV_AUTH_CODES=false`
5. Do not expose Postgres/Redis/MinIO ports publicly (localhost bind default)
6. Rotate JWT secrets and invalidate refresh tokens on compromise
7. Use dedicated MinIO IAM user with `evidence/*` scope (recommended follow-up)

---

## Files Changed (Security Pass)

| Area | Files |
|------|-------|
| JWT/Auth | `jwt-secrets.ts`, `resolve-auth-user.ts`, `jwt-auth.guard.ts`, `optional-jwt-auth.guard.ts`, `auth.service.ts` |
| Admin session | `verify-jwt.ts`, `session.ts`, `middleware.ts`, `login/route.ts`, `logout/route.ts` |
| Evidence/S3 | `s3-presign.ts`, `incidents.service.ts`, `neighborhood-watch.service.ts` |
| RBAC scope | `users.service.ts`, `smartwatch.service.ts`, `notifications.service.ts` |
| API/Infra | `metrics.controller.ts`, `main.ts`, `validate-env.ts`, `docker-compose.yml`, nginx configs |
| Headers | `next.config.ts`, `nginx.conf` |
| Tests | `evidence-security.spec.ts`, `security-hardening.spec.ts`, `metrics.controller.spec.ts` |

---

## Sign-Off

Security audit complete. All identified **Critical** and **High** vulnerabilities have been remediated with automated test coverage. Deploy using `.env.example` as the configuration baseline and complete the production checklist before go-live.
