# Neighborhood Watch — Dynamic Public Area QA

## Product rule

Valid GPS + no mapped public community must resolve to **Dynamic Public Area**, not a dead-end.

```text
Open Neighborhood Watch
  → Fresh GPS confirmed
  → No mapped public community
  → Dynamic Public Area
  → Start Conversation / tips / hazards remain available
```

Location failures (`LOCATION_REQUIRED` / `LOCATION_STALE` / `LOCATION_LOW_ACCURACY`) remain blocking. Community absence does not.

## API contract

`GET /v1/neighborhood-watch/context`

| Situation | `locationStatus` | `contextType` | `canPost` |
|-----------|------------------|---------------|---------|
| Mapped public geofence | `CONFIRMED` | `MAPPED_PUBLIC_COMMUNITY` | true* |
| Valid GPS, unmapped | `CONFIRMED` | `DYNAMIC_PUBLIC_AREA` | true |
| Stale / low accuracy / missing GPS | matching `LOCATION_*` | matching `LOCATION_*` | false |

\* Suspended/Banned members: `canPost=false`.

Dynamic area posts:

- `GET /v1/neighborhood-watch/dynamic-areas/feed`
- `POST /v1/neighborhood-watch/dynamic-areas/posts`
- `POST /v1/neighborhood-watch/dynamic-areas/posts/media/presign`
- `POST /v1/neighborhood-watch/dynamic-areas/reports`
- Admin: `GET /v1/neighborhood-watch/admin/dynamic-area-posts`

Server derives `areaKey` from presence. Clients cannot forge posting targets.

## Geographic key

Prefer jurisdiction polygon / nearest boundary:

`da:{COUNTRY}:{STATE}:{LGA}`

Fallback when jurisdictions unavailable: `da:gh:{geohash5}` (~km cell). Exact lat/lng is never the public id.

## Participation policy

| Action | Requirement |
|--------|-------------|
| New Dynamic Area post | Presence unexpired **and** `capturedAt` ≤ 5 minutes |
| Comment / react on existing thread | Presence unexpired for same `areaKey` (≤ 30 minutes TTL) |
| Membership | **Not** created for travel presence |

## Migration / promotion (documented, not auto)

1. Admin maps an official Public Community boundary.
2. New GPS resolves to `MAPPED_PUBLIC_COMMUNITY`.
3. Historical Dynamic Area posts keep their `dynamicAreaKey`.
4. Optional future linkage may attach a community id without rewriting geography blindly.
5. Never auto-create thousands of Community rows from GPS.

## Physical device scenarios

### Scenario A — Unmapped area

1. Stand in a staging location with no mapped public community.
2. Open Neighborhood Watch.
3. Confirm Dynamic Public Area UI (area label + Start Conversation).
4. Create Safety Discussion.
5. Create voice Security Tip.
6. Add a comment.
7. Close/reopen app; conversations remain.

Capture: APK SHA, device, Android version, GPS/context result, post IDs, screenshots, request IDs, PASS/FAIL.

### Scenario B — Move to mapped area

1. Enter approved mapped test geofence.
2. Refresh location.
3. Official mapped community loads.
4. New post attaches to mapped community, not prior Dynamic Area.
5. Old Dynamic Area posts remain under original area key.

### Scenario C — Private estate overlap

1. Enter private community geofence without membership.
2. Public Dynamic/Mapped context still works.
3. Private community shows Request Membership.
4. Private posts remain inaccessible.

## Status

**DYNAMIC PUBLIC AREA CODE COMPLETE — PHYSICAL QA PENDING**
