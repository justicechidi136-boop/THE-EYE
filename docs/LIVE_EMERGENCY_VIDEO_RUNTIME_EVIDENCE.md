# Live Emergency Video — Staging Runtime Evidence

**Last updated:** 2026-07-28  
**Branch:** `fix/live-video-public-gateway-and-url`  
**Status:** CODE FIXED — STAGING QA PENDING

## Confirmed failure (pre-fix)

| Item | Value |
|------|-------|
| Observed stage | **Stage 4** — `POST /v1/live-video/incidents/:id/start` |
| Public symptom | `Recovering: Live video could not start (LIVE-VIDEO-502)` |
| Incident state | `activeIncidentId != null` — emergency preserved |
| Internal proof | `http://api:4000` → HTTP **201** |
| Public path | `https://staging-api.theeye.com.ng` → intermittent HTTP **502** |
| Root cause class | **Case A** — Nginx/upstream gateway (no NestJS JSON body) |

## Fixes in this branch

- API returns `NEXT_PUBLIC_LIVEKIT_URL` (`wss://staging-livekit.theeye.com.ng`) — never `ws://livekit:7880`
- Stable error taxonomy `LIVE-VIDEO-001` … `LIVE-VIDEO-011`, `015`, `016`
- Nginx forwards `X-Request-ID` / `X-Client-Trace-ID`; upstream retry on 502/503
- Non-fatal initial location persist (`LIVE-VIDEO-005` warning only)
- Mobile video-only retry when incident already exists
- `LiveVideoStartupTrace` with per-phase timings

## Verification checklist (post-deploy)

- [ ] Public Stage 4: 5× `POST …/live-video/incidents/{id}/start` → 201, `livekit.url` = WSS staging host
- [ ] Physical device room join on `wss://staging-livekit.theeye.com.ng`
- [ ] Camera + microphone publish
- [ ] Retry without duplicate incident
- [ ] ICE/TURN assessment on mobile data (document `LIVEKIT-RTC-001` if media fails)

## Sprint 8

**NOT AUTHORIZED** — live video device verification incomplete.
