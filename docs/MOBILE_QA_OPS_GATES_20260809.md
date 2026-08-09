# Mobile QA ops gates — 2026-08-09

These items cannot be marked PASS from app code alone.

## AUTH-001 / FUNC-001 — Password reset / recovery Cloudflare 526

**Symptom:** Reset/recovery email links open Cloudflare Error 526 (Invalid SSL Certificate).

**Owner:** DevOps / Cloudflare

**Checklist**
- [ ] Staging origin presents a valid certificate trusted by Cloudflare
- [ ] Cloudflare SSL/TLS mode is **Full (strict)** for `staging` hostnames used in email links
- [ ] Password-reset and account-recovery link bases are HTTPS staging hosts only (not production, not localhost)
- [ ] Click a fresh reset email and confirm the app/web reset page loads without 526

## AUTH-003 — Google Sign-In AUTH-GOOGLE-003

**Symptom:** Continue with Google fails after account picker / credential exchange.

**Owner:** Firebase ops + Mobile build config

**Checklist**
- [ ] Firebase Console → Android app → add **SHA-1** and **SHA-256** for the staging signing keystore
- [ ] Download updated `google-services.json` into the staging mobile flavor
- [ ] Ensure `GOOGLE_WEB_CLIENT_ID` (Web client OAuth ID) is present in the staging build
- [ ] Rebuild staging APK and retest native Google sign-in

## Device QA matrix (post-APK)

Record for each ID: PASS/FAIL, device, APK SHA, screenshot.

| ID | Area | Notes |
| --- | --- | --- |
| UI-002 | Home cards | No text overflow |
| UI-004 / UI-005 | Auth dark theme | Create account + Or / New user contrast |
| UI-007 / UI-008 | Incident status | No UUID / LowConfidence on cards |
| UI-009 / UI-010 / FUNC-002 | Active emergency | No duplicate header; friendly live-video copy; Start enabled |
| UI-011 | Services / Broadcast / Settings | Title only, no back |
| UI-012 / UX-004 / UX-009 | Notifications | No stack spam; read/unread visible |
| UI-013 / UI-014 | Broadcast detail | Human dates; no “Expires Just now” while Active |
| UX-010+ / FUNC-007+ | Missing person form | Age, last seen, clothing, physical present |
| FUNC-006 | Notifications | One push per broadcast |
| FUNC-005 | Session | No mid-session “expired token” while signed in |
| AUTH-001 / AUTH-003 | Ops gates above | Blocked until TLS / SHA done |
