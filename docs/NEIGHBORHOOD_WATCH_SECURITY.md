# Neighborhood Watch — Security

- Authenticate every endpoint.
- Enforce community visibility + membership + community role + jurisdiction.
- Never trust client role/membership/geofence claims.
- Forged lat/lng must not grant private membership.
- Push is not authorization.
- Removed/suspended members lose private access immediately.
- Public APIs strip email, phone, exact home address, internal user IDs, storage URLs, and live patrol locations.
- Audit sensitive actions (approve, moderate, escalate, alert publish).
