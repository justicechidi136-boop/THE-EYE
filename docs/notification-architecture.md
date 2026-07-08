# Notification Architecture

Notifications are asynchronous, auditable, and channel-aware. Incident creation must succeed even if notification providers are unavailable.

## Channels

- Push: Firebase Cloud Messaging for citizen and responder devices.
- In-app: durable notification inbox for mobile and admin users.
- SMS: future adapter for critical incidents and fallback delivery.
- Email: administrative, compliance, and digest notifications.

## Queues

- notifications: individual push, SMS, email, and in-app delivery.
- broadcast-fanout: recipient selection, batching, and publication tracking.
- escalation-watch: SLA timers and escalation triggers.
- evidence-processing: thumbnails, metadata extraction, virus scan hooks, retention tagging.

## Delivery Semantics

- Jobs must be idempotent using a stable dedupe key.
- Provider attempts are recorded in `notification_deliveries`.
- Critical notifications use exponential backoff and alert operations after final failure.
- Broadcast fanout should be batched to avoid provider rate limits.
- Users may opt out of non-critical community notifications, but not legally required emergency alerts.

## FCM Token Model

Production should add a `device_tokens` table with:

- user id.
- token hash and encrypted token value.
- platform.
- app version.
- last seen timestamp.
- revoked timestamp.

## Geofenced Broadcasts

Broadcast targeting should combine:

- broadcast target area.
- last known consenting user location.
- agency jurisdiction.
- severity and legal notification rules.
