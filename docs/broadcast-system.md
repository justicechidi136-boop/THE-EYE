# THE EYE Broadcast System

Broadcasts support emergency, crime, accident, missing person, stolen vehicle, government alert, and community warning messages.

## Approval Rules

- Government alerts, community warnings, missing person broadcasts, and stolen vehicle broadcasts require admin approval by default.
- Critical verified P1 emergency, crime, and accident broadcasts can publish automatically.
- Published broadcasts can be dispatched manually or by the scheduled auto-dispatch worker.

## Geofencing

- Broadcasts store `target_area` as PostGIS geography.
- Radius broadcasts store `target_center` and `target_radius_meters`, then derive `target_area` with `ST_Buffer`.
- Jurisdiction broadcasts inherit the jurisdiction boundary.
- Recipient selection uses PostGIS intersection against the user's latest known incident or SOS location.

## Delivery

- Each eligible user gets one `broadcast_deliveries` row per broadcast.
- Each delivery creates a linked `notifications` row and queues an FCM push job through BullMQ.
- Delivery status supports queued, sent, delivered, failed, and read.

## Scheduled Auto-Dispatch

- `scheduledAt` is stored as UTC `TIMESTAMPTZ`; admin UI displays local time only.
- Approved or auto-eligible broadcasts with a future `scheduledAt` enter `Scheduled` status instead of dispatching immediately.
- The dedicated `notification-worker` process runs a broadcast scheduler loop every 30 seconds.
- Claim mechanism: PostgreSQL `UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED)` transitions eligible rows to `DispatchQueued`.
- Enqueue mechanism: deterministic BullMQ job id `broadcast:auto-dispatch:{broadcastId}` on queue `the-eye-{env}-broadcasts`.
- The broadcast dispatch processor calls the existing recipient expansion + push enqueue path; it does not talk to FCM directly.
- Cancellation before claim: row stays cancellable until deliveries exist.
- Cancellation after claim but before recipient expansion: worker re-checks status and stops safely.
- Cancellation after deliveries exist: blocked; already queued push jobs follow normal delivery policy.

### Scheduler health

- Redis heartbeat key: `{prefix}:broadcast-scheduler:heartbeat`
- Admin metrics: `GET /v1/broadcasts/admin/scheduler-health`
- Safe fields only: due count, claimed count, next scheduled time, stale scheduled count, queue counts, last run age.

### Staging runbook

1. Deploy `notification-worker` with Redis and Postgres reachable.
2. Confirm both heartbeats exist: `notification-worker:heartbeat` and `broadcast-scheduler:heartbeat`.
3. Schedule a broadcast +1h, then temporarily set `scheduledAt` in the past in staging DB only for QA if needed.
4. Verify audit events: `broadcast.scheduled`, `broadcast.dispatch_queued`, `broadcast.auto_dispatch_started`, `broadcast.auto_dispatch_completed`.
5. Rollback: stop worker service; broadcasts remain in `Scheduled` or `DispatchQueued` without duplicate deliveries because claim + job id are idempotent.

## Citizen Feed

- `GET /v1/broadcasts/nearby` requires auth (`incident:read`); guests must log in.
- Targeting uses stored profile jurisdiction plus geofence/device location query parameters; client-submitted geography alone is not trusted for detail access.
- `GET /v1/broadcasts/:id`, `PATCH /v1/broadcasts/:id/read`, and `GET /v1/broadcasts/unread-count` are citizen-scoped.
- Feed excludes draft, cancelled, rejected, expired, and undispatched broadcasts.
- Mobile caches feed per session scope and clears on logout/account change.

## Audit

Every create, approve, reject, schedule, cancel, dispatch, auto-dispatch, and read action writes to `audit_logs` with actor type `admin`, `system`, or `user` in metadata.
