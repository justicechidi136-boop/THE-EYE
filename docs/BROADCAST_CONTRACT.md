# Broadcast Contract

## Purpose

THE EYE broadcasts are public safety alerts separate from emergency incident reporting and Community Verification.

Citizens may publish **Missing Person** and **Stolen Vehicle** broadcasts without prior administrator approval. Authorised administrators may publish additional categories within their jurisdiction.

## Citizen policy

- Registered users may create Missing Person and Stolen Vehicle broadcasts.
- Successful validation sets status to **Active** immediately.
- No pending-approval state is used for citizen Missing Person or Stolen Vehicle broadcasts.
- Country scope is resolved server-side from profile jurisdiction and selected country; clients cannot override unrestricted country scope.
- All broadcasts are auditable and visible to administrators for monitoring, comment, verification, suspension, and removal.

## API surface

| Method | Path | Actor |
| --- | --- | --- |
| POST | `/v1/broadcasts/missing-person` | Citizen |
| POST | `/v1/broadcasts/stolen-vehicle` | Citizen |
| GET | `/v1/broadcasts/mine` | Citizen |
| GET | `/v1/broadcasts/nearby` | Citizen |
| GET | `/v1/broadcasts/:id` | Citizen / Admin |
| POST | `/v1/broadcasts/:id/resolve` | Author |
| POST | `/v1/broadcasts/:id/withdraw` | Author |
| POST | `/v1/broadcasts/:id/report` | Citizen |
| POST | `/v1/broadcasts/:id/comments` | Citizen |
| GET | `/v1/broadcasts/:id/comments` | Citizen |
| POST | `/v1/broadcasts/:id/sightings` | Citizen |
| GET | `/v1/broadcasts/:id/share` | Author |
| GET | `/v1/public/broadcasts/:id` | Public (safe fields only) |
| POST | `/v1/admin/broadcasts` | Admin |
| POST | `/v1/admin/broadcasts/:id/suspend` | Admin |
| POST | `/v1/admin/broadcasts/:id/restore` | Admin |
| DELETE | `/v1/admin/broadcasts/:id` | Admin (soft delete) |
| POST | `/v1/admin/broadcasts/:id/verify` | Admin |

## Comments and sightings

- Public comments use `/v1/broadcasts/:id/comments` with pagination.
- Comment labels: **User Comment**, **Official Admin Update**, **Verified Sighting**, **Moderator Notice**.
- Sensitive sighting coordinates must not appear in public comments; use `/v1/broadcasts/:id/sightings` for author/admin sighting intake with audit logging.

## Resolution and expiry

- Authors resolve (`POST .../resolve`) or withdraw (`POST .../withdraw`) with idempotency via `clientResolutionId`.
- Resolution and withdrawal enqueue country delivery notifications using Notification Schema v1 (`routeType: BROADCAST_DETAILS`) without private payload fields.
- Expiry review reminders are scheduled via BullMQ (`broadcast-expiry-review-<broadcastId>` job IDs, no colons).
- Authors may extend active status or resolve before automatic **Expired** transition.

## Public sharing

- Authenticated authors fetch share payloads via `GET /v1/broadcasts/:id/share`.
- Unauthenticated viewers use `GET /v1/public/broadcasts/:id` with masked registration, approximate location, and status banners for Resolved/Suspended/Withdrawn/Expired.

`Draft`, `Active`, `Updated`, `Resolved`, `Expired`, `Suspended`, `DeletedByAdmin`, `WithdrawnByAuthor`

Citizen broadcasts become **Active** immediately after validation.

## Labels

- **Citizen Broadcast** — citizen-created, not admin verified
- **Admin Broadcast** — admin-created
- **Verified by Admin** — evidence reviewed and verified by authorised admin

## Delivery

Country-wide citizen delivery is queued asynchronously via `country-delivery` jobs on the broadcasts queue. Job IDs use the form `broadcast-country-<broadcastId>-<countryCode>-<batchNumber>` without colon characters.

## Privacy

Push payloads use Notification Schema v1 and exclude sensitive personal data. Full authorised content is fetched from the API after notification open.
