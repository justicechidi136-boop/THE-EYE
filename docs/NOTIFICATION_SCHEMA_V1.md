# Notification Schema V1

**Project:** THE EYE  
**Phase:** Emergency User Journey — Phase 3.5

---

## Purpose

Replace client-side heuristic notification routing with a **server-authoritative** contract. The mobile app must never guess where a reporter notification should open.

---

## Payload fields

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `1` | Contract version |
| `routeType` | enum | Routing category (see below) |
| `incidentId` | UUID string | Related incident when applicable |
| `status` | string | Incident status at send time |
| `notificationType` | string | Notification type (e.g. `IncidentStatusUpdate`) |
| `destination` | path | Canonical in-app route |

FCM data also includes legacy `route` / `deepLink` mirroring `destination` for backward compatibility.

---

## Route types

| routeType | destination | Use |
|-----------|-------------|-----|
| `OWN_ACTIVE_INCIDENT` | `/active-emergency` | Reporter while incident is active |
| `OWN_INCIDENT_DETAILS` | `/incident-detail` | Terminal states (resolved, cancelled, expired, false report) |
| `COMMUNITY_VERIFICATION` | `/neighborhood-watch` | Community verification (future phase) |
| `SYSTEM` | varies | Broadcasts, SOS entry, settings |

---

## Reporter ownership routing

| Event | Active? | destination |
|-------|---------|-------------|
| Report received | yes | Active Emergency |
| Verification started | yes | Active Emergency |
| Agency assigned | yes | Active Emergency |
| Responders en route | yes | Active Emergency |
| On scene | yes | Active Emergency |
| Under control | yes | Active Emergency |
| Resolved | no | Incident Details |
| Cancelled | no | Incident Details |
| False report | no | Incident Details |
| Expired | no | Incident Details |

**Never** route reporter notifications to `/tracking`.

---

## Phase 6 communication notifications

| notificationType | Recipient | destination (active) | destination (terminal) |
|------------------|-----------|----------------------|-------------------------|
| `IncidentMessageReceived` | Reporter | `/active-emergency/:id/messages` | `/incident-detail/:id/messages` |
| `IncidentMessageReceived` | Dispatcher/admin | `/dispatch/incidents/:id` | `/dispatch/incidents/:id` |
| `IncidentInformationRequest` | Reporter | `/active-emergency/:id/messages` | `/incident-detail/:id/messages` |

Push allowlist includes message subpaths under active-emergency and incident-detail routes.

---

## Server implementation

- `apps/api/src/modules/notifications/notification-routing.schema.ts` — routing builder
- `apps/api/src/modules/notifications/notification-inbox.mapper.ts` — inbox + deep link resolution
- `apps/api/src/modules/notifications/providers/fcm.provider.ts` — FCM data envelope
- `apps/api/src/modules/dispatch/dispatch.service.ts` — reporter status notifications

---

## Mobile implementation

- `apps/mobile/lib/push/notification_routing.dart` — schema parser
- `apps/mobile/lib/push/push_navigation.dart` — navigation request builder
- `apps/mobile/lib/push/push_deep_link_router.dart` — allowlist + fallback
- Notification inbox tap handler in `main.dart` — respects `destination` + `incidentId`

---

## Inbox API

`GET /v1/notifications/inbox` items include:

```json
{
  "deepLink": "/active-emergency",
  "routing": {
    "schemaVersion": 1,
    "routeType": "OWN_ACTIVE_INCIDENT",
    "incidentId": "uuid",
    "status": "Responding",
    "notificationType": "IncidentStatusUpdate",
    "destination": "/active-emergency"
  }
}
```

Sensitive routing fields remain in `routing`; sanitized `metadata` excludes duplicate route keys.
