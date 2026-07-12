# System Architecture

THE EYE is a public safety platform for emergency response, crime reporting, accident reporting, broadcast alerts, community safety coordination, and government escalation.

## System Components

- Citizen Mobile App: Flutter app for incident reporting, location sharing, evidence upload, push alerts, and live video escalation.
- Admin Dashboard: Next.js command center for dispatchers, agencies, government officials, auditors, and platform admins.
- Backend API: NestJS service boundary for auth, users, incidents, broadcasts, notifications, storage, audit, and live session orchestration.
- PostgreSQL + PostGIS: System of record for identity, agencies, incidents, geospatial areas, evidence metadata, notifications, and audit logs.
- Redis + BullMQ: Async processing for notification delivery and provider retries. Additional queue-backed workflows (broadcast fanout, escalation timers, evidence processing) are planned.
- MinIO/S3: Object storage for citizen evidence, responder evidence, exported reports, and generated thumbnails.
- LiveKit: Real-time video rooms for emergency streaming and responder/admin viewing.
- Firebase Cloud Messaging: Push notification provider for citizen and responder devices.
- Google Maps or Mapbox: Map display, geocoding, geofence selection, and routing.

## Core Flows

### Incident Reporting

1. Citizen submits an incident with type, location, description, and optional evidence.
2. API validates the payload, creates the incident, writes an audit log, and enqueues notification jobs.
3. Dispatchers triage the incident, adjust priority, and assign an agency or responder.
4. Responders update field status until resolution.
5. Supervisors close the incident after review.

### Evidence Upload

1. Client requests a presigned upload URL from the API.
2. Client uploads directly to S3/MinIO.
3. Client confirms upload with object metadata.
4. API records evidence metadata and enqueues evidence processing.
5. Audit logs record upload, access, retention override, and deletion actions.

### Live Video

1. Citizen requests or accepts a live video session.
2. API creates a LiveKit room and issues scoped participant tokens.
3. Citizen publishes video from the mobile app.
4. Dispatchers and responders join with viewer or moderator permissions.
5. Session metadata is attached to the incident; recordings are optional and must follow retention policy.

### Broadcasts

1. Dispatcher or official drafts a broadcast with severity and target area.
2. Approval is required for high-impact or government-wide broadcasts.
3. Broadcast fanout selects eligible devices by location, jurisdiction, and subscription settings.
4. Delivery attempts are recorded for audit and operational visibility.

## Trust Boundaries

- Mobile clients are untrusted and must not be allowed to set privileged incident state.
- Admin dashboard requests require authenticated identity, permission checks, and resource scope checks.
- Object storage is private; clients receive short-lived presigned URLs only.
- Queue workers must be idempotent because jobs can retry.
- Audit logs are append-only from the application point of view.

## Reliability Principles

- Incident creation must not depend on FCM, LiveKit, or object storage availability.
- Notification and broadcast delivery run asynchronously.
- Status transitions are validated through a lifecycle state machine.
- Escalation timers are planned as queue-backed workflows; today only the `notifications` BullMQ queue is implemented.
- Every sensitive action has an audit trail.
