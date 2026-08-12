# Neighborhood Watch — Architecture (E2E)

**Branch:** `feature/neighborhood-watch-e2e`  
**Baseline:** `staging`  
**Status:** CODE COMPLETE — STAGING DEPLOYMENT PENDING

## Principle

Neighborhood Watch extends the existing Sprint 5 community platform. It does **not** replace Emergency Reporting, Broadcasts, Field Operations, or incident Community Verification.

| Domain | Canonical owner |
|--------|-----------------|
| Emergency response | Incidents + Active Emergency |
| Country/official alerts | Broadcasts |
| Agency patrol/checkpoints | Field Operations Tablet |
| Nearby incident confirm | `community-verification` module |
| Local community safety + discussion | Neighborhood Watch (`/v1/neighborhood-watch`) |

## Location participant vs membership

- **Public community:** GPS resolves an Active Public community via PostGIS. User becomes a **LOCATION_PARTICIPANT** via ephemeral `CommunityPresence`. No automatic `CommunityMembership` row.
- **Private community:** Physical presence never grants access. Approved `CommunityMembership` required.
- **Home community:** Optional preference on Profile. Never falsifies current location.

## Context resolution

`GET /v1/neighborhood-watch/context?lat=&lng=&accuracy=&capturedAt=`

Location states: `CONFIRMED` | `LOCATION_REQUIRED` | `LOCATION_STALE` | `LOCATION_LOW_ACCURACY` | `NO_PUBLIC_COMMUNITY`

Hysteresis: accuracy threshold, max age, min displacement, dwell confirmation, rate-limited presence upserts.

## Domain models

Reuse: `Community`, `CommunityMembership`, `CommunityPost*`, `PatrolSchedule*`, moderation reports.

Additive: `CommunityPresence`, `CommunityAlert`, `CommunityPinnedSafetyInfo`, expanded post types, comment media, escalation linkage, `Profile.homeCommunityId`.

## Security

Server authorizes visibility, membership, community role, jurisdiction, and geography. Push metadata is not authorization. Private feeds never leak via unscoped list endpoints.

## Realtime / offline

Polling + Notification Schema v1. Cached context/feed may show **stale** labels offline; GPS never labeled current when stale.

## Implemented E2E surface (this branch)

- `GET /context`, `PUT|PATCH /home-community`
- Official `CommunityAlert` create/list/update/cancel; pinned safety list/create/update/deactivate
- Public visitor participation via presence; private deny without membership; soft-hide moderation restore
- Voice comment metadata; reaction types aligned to Prisma; map `dangerZones` citizen projection
- Patrol join/start/pause/complete/cancel + observations; escalation idempotency with source linkage
- NW Schema v1 route types (`NW_*`) + mobile location-home, offline stale cache, deep links
- Admin rebrand to Neighborhood Watch Management; auth errors no longer swallowed as empty lists
