# Incident Reporting Module

THE EYE supports public-safety intake for emergency and community reports.

## Supported Report Types

- Emergency
- Crime
- Accident
- Fire
- Kidnapping
- Abuse
- Suspicious activity
- Missing person
- Stolen vehicle

## Endpoints

- `POST /v1/incidents/report`: standard incident report. Accepts anonymous or identified mode.
- `POST /v1/incidents/emergency`: emergency fast path. Creates the incident and timeline first, then schedules heavier evidence/contact work outside the response path.
- `POST /v1/incidents/:id/media/presign`: returns S3/MinIO upload target metadata.
- `POST /v1/incidents/:id/media/confirm`: records uploaded evidence metadata and creates a timeline event.
- `GET /v1/incidents`: scoped incident list for the authenticated actor.
- `GET /v1/incidents/:id`: scoped incident detail with media, timeline, and status history.
- `PATCH /v1/incidents/:id/status`: protected status transition.

## Captured Fields

Every report captures:

- incident type.
- description.
- device GPS latitude/longitude.
- optional manually adjusted latitude/longitude and manual address.
- anonymous or identified reporting mode.
- emergency contact notification preference.
- optional photo, video, audio, document, or live-video recording metadata.

## Evidence Flow

1. Client requests a presigned upload URL.
2. Client uploads the file to object storage.
3. Client confirms media metadata with file hash, captured timestamp, uploader, and GPS coordinates.
4. API writes `incident_media` and `incident_timeline` rows.
5. Media access is tracked separately in `incident_media_access_logs`.

## Emergency Fast Path

Emergency submissions target less than 3 seconds by doing only the critical synchronous work:

1. validate minimal payload.
2. resolve jurisdiction.
3. create incident row.
4. create initial timeline row.
5. return incident id/status/priority.

Evidence attachment and emergency-contact notifications are scheduled after the response path.
