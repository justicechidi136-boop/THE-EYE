# THE EYE Notification System

## Channels

- Push: Firebase Cloud Messaging provider adapter name is `firebase-cloud-messaging`.
- SMS: placeholder provider `sms-placeholder`.
- Email: placeholder provider `email-placeholder`.
- In-app: stored notification center records.
- Watch push: smartwatch alert adapter.

## Types

- EmergencyAlert
- IncidentStatusUpdate
- BroadcastAlert
- NearbyDangerWarning
- MissingPersonAlert
- StolenVehicleAlert
- FamilySosAlert
- AdminAssignmentAlert

## Priority

- Critical
- High
- Normal
- Low

Emergency, nearby danger, and family SOS alerts default to Critical. Missing person, stolen vehicle, and admin assignment alerts default to High.

## Location Targeting

`POST /notifications/send` can target:

- `userId`
- `adminUserId`
- latitude, longitude, and radius

Location targeting uses PostGIS to find users whose latest known incident or SOS location is within the radius. The notification stores `target_latitude`, `target_longitude`, `target_location`, and `target_radius_meters`.

## Delivery Logs

Every queued notification with a `notificationId` writes to `notification_delivery_logs`.

Delivery logs store:

- Channel
- Provider
- Status
- Attempt
- Provider message ID
- Request payload
- Response payload
- Sent and delivered timestamps
- Error details

## API

- `GET /notifications`: in-app notification center.
- `GET /notifications?unreadOnly=true`: unread notifications.
- `POST /notifications/send`: create direct or location-targeted notifications.
- `POST /notifications/push-tokens`: register a Firebase Cloud Messaging token for the current user.
- `PATCH /notifications/push-tokens/deactivate`: deactivate a Firebase token.
- `PATCH /notifications/:id/read`: mark as read.
- `PATCH /notifications/:id/unread`: mark as unread.
- `GET /notifications/:id/delivery-logs`: delivery log history.
- `POST /notifications/:id/delivery-receipt`: provider receipt callback placeholder.
