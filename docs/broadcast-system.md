# THE EYE Broadcast System

Broadcasts support emergency, crime, accident, missing person, stolen vehicle, government alert, and community warning messages.

## Approval Rules

- Government alerts, community warnings, missing person broadcasts, and stolen vehicle broadcasts require admin approval by default.
- Critical verified P1 emergency, crime, and accident broadcasts can publish automatically.
- Published broadcasts can be dispatched manually or by the auto-broadcast workflow.

## Geofencing

- Broadcasts store `target_area` as PostGIS geography.
- Radius broadcasts store `target_center` and `target_radius_meters`, then derive `target_area` with `ST_Buffer`.
- Jurisdiction broadcasts inherit the jurisdiction boundary.
- Recipient selection uses PostGIS intersection against the user's latest known incident or SOS location.

## Delivery

- Each eligible user gets one `broadcast_deliveries` row per broadcast.
- Each delivery creates a linked `notifications` row and queues an FCM push job through BullMQ.
- Delivery status supports queued, sent, delivered, failed, and read.

## Audit

Every create, approve, reject, dispatch, and auto-publish action writes to `audit_logs`.
