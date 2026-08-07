# Patrol Mode

Landscape-first patrol workflow for field tablets.

## Entry

- Officer must have an **active shift**
- No active checkpoint session
- Launch from dashboard quick action **Start Patrol** or nav rail **Patrol**

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/field/patrols/active` | Active patrol session |
| POST | `/v1/field/patrols/start` | Start patrol |
| POST | `/v1/field/patrols/pause` | Pause patrol |
| POST | `/v1/field/patrols/resume` | Resume patrol |
| POST | `/v1/field/patrols/end` | End patrol |
| POST | `/v1/field/patrols/location` | GPS route point |

## Tablet UX

- Map-first layout (landscape)
- Patrol zone label
- Emergency button
- Evidence capture hooks (photo/video/audio)
- Route recording via location posts
- Offline queue for location + lifecycle events (`/v1/field/sync/batch`)

## Map layers (target)

Patrol zones, open incidents, danger zones, nearby broadcasts, checkpoints, hospitals/police/fire, drones, road closures.

## Officer status

Starting patrol sets `OfficerOperationalStatus.OnPatrol`.
