# Neighborhood Watch — Public Communities

Public communities are geographic safety zones.

- Discovery via trusted GPS + PostGIS containment (or nearby center fallback).
- Access mode: **LOCATION_PARTICIPANT** (presence), not permanent membership.
- Visitors may view public safety content and participate in permitted public feed actions.
- Visitors must **not** see private resident content, member directories, live patrol GPS, or admin controls.
- Optional **Home Community** preference is separate from current area.

## User-initiated conversations

- Empty communities still show **Start Conversation** (no dead-end empty state).
- Eligible users (authenticated + confirmed public context + not suspended + community allows public participation) may create discussion threads without joining as permanent members.
- Traveler example: home in Port Harcourt, currently in Lagos → may start conversations in the Lagos public community; Lagos is not made their home/membership.
- Author label for presence-only participants: **Current Area Visitor**.
- Leaving the geofence removes current-location posting rights; prior posts remain in the community where created (not deleted).
- API write paths re-check fresh presence `capturedAt` (not only TTL `expiresAt`) so stale GPS cannot establish new posting authority.
