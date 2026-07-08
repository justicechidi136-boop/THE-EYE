# THE EYE LiveKit Incident Video

THE EYE uses LiveKit rooms for emergency live video attached to incidents.

## Backend

- `POST /live-video/incidents/:incidentId/start` creates or reactivates a room and returns a publisher token.
- `PATCH /live-video/sessions/:sessionId/stop` ends the session and records the incident timeline event.
- `POST /live-video/sessions/:sessionId/admin-token` returns a subscribe-only admin viewer token after RBAC and incident scope checks.
- `PATCH /live-video/sessions/:sessionId/evidence` links a recording media item to the live video session.
- `GET /live-video/sessions/active` lists authorized active sessions for admins.
- `POST /live-video/sessions/:sessionId/location` stores a mobile GPS update for the stream.
- `GET /live-video/sessions/:sessionId/location/latest` returns the admin evidence overlay and signed internal map-opening URL.
- `GET /live-video/sessions/:sessionId/location/history` returns the full movement trail.
- `GET /live-video/sessions/:sessionId/location/open/:token` audits and returns private map links for authorized admins.

Required environment variables:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_TOKEN_TTL_SECONDS`
- `LIVE_LOCATION_LINK_SECRET`

## Timeline And Evidence

Live stream start, stop, admin token creation, and evidence linking are written to `audit_logs`. Start/stop/evidence-link events are also written to `incident_timeline`.

Every admin live stream view includes a permanent evidence overlay with incident ID, date, time, latest GPS, accuracy, reporter label, and an internal signed “Open Live Location” action. Anonymous incidents use an anonymous reporter label instead of exposing the user ID.

Every GPS update is stored in `live_video_location_updates` with captured and received timestamps for evidence trail reconstruction.

## Low-Bandwidth Mode

Citizen clients can request low-bandwidth mode. The backend stores it on `live_video_sessions` and includes it in LiveKit token metadata so the mobile client can prefer lower bitrate video and audio-first emergency publishing.

## Mobile GPS Updates

The mobile screen requests location permission before starting. If permission is denied, the stream is blocked and the user sees a warning. While streaming, the app sends a GPS update payload every 5 seconds to:

`POST /live-video/sessions/:sessionId/location`

Each update includes latitude, longitude, accuracy, speed, heading, altitude, captured timestamp, and source device ID.
