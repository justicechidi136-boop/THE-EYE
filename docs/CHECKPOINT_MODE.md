# Checkpoint Mode

Checkpoint operational dashboard for vehicle/person screening workflows.

## Entry

- Officer must have an **active shift**
- No active patrol session
- Launch from dashboard **Start Checkpoint** or nav rail **Checkpoint**

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/field/checkpoints/active` | Active checkpoint session |
| POST | `/v1/field/checkpoints/start` | Start checkpoint |
| POST | `/v1/field/checkpoints/pause` | Pause checkpoint |
| POST | `/v1/field/checkpoints/resume` | Resume checkpoint |
| POST | `/v1/field/checkpoints/end` | End checkpoint |
| PATCH | `/v1/field/checkpoints/queue` | Queue / vehicle check counters |
| GET | `/v1/field/checkpoints/search` | Broadcast BOLO search |

## Dashboard fields

- Checkpoint name and zone label
- Queue count and vehicle checks
- Wanted vehicles / missing persons via broadcast search
- Quick actions: plate search, person search, create incident, backup

## Officer status

Starting checkpoint sets `OfficerOperationalStatus.AtCheckpoint`.

## Privacy

Operational sightings created from checkpoint flow use `operational_sightings` (private). They are not public broadcast comments.
