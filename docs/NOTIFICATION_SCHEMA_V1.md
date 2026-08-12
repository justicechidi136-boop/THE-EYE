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
| `COMMUNITY_VERIFICATION` | `/neighborhood-watch` | Nearby incident community verification prompts |
| `BROADCAST_DETAILS` | `/broadcasts/:id` | Public safety broadcasts |
| `FIELD_DEVICE_STATUS` | `/device-registration` | Field tablet registration refresh |
| `NW_COMMUNITY_ALERT` | `/neighborhood-watch/alerts` | Official community leadership alerts |
| `NW_POST_ACTIVITY` | `/neighborhood-watch/post/:postId` | New/updated community feed activity |
| `NW_POST_COMMENT` | `/neighborhood-watch/post/:postId` | Comment on author's post |
| `NW_PATROL_INVITATION` | `/neighborhood-watch/patrol/:patrolId` | Patrol assignment / invite |
| `NW_PATROL_UPDATE` | `/neighborhood-watch/patrol/:patrolId` | Patrol start/pause/complete status |
| `NW_MEMBERSHIP_APPROVED` | `/neighborhood-watch/private/:communityId/membership` | Private membership approved |
| `NW_MEMBERSHIP_REJECTED` | `/neighborhood-watch/private/:communityId/membership` | Private membership rejected |
| `NW_AREA_CHANGED` | `/neighborhood-watch` | Location presence switched public community |
| `NW_ESCALATION_UPDATE` | `/neighborhood-watch/post/:postId` or incident detail | Post escalated to incident |
| `SYSTEM` | varies | Broadcasts, SOS entry, settings |

See also `docs/NEIGHBORHOOD_WATCH_NOTIFICATION_CONTRACT.md`.

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

## Phase 7 field device notifications

| notificationType | Recipient | destination | Notes |
|------------------|-----------|-------------|-------|
| `FIELD_DEVICE_APPROVED` | Assigned officer tablet | `/device-registration` | Triggers status refresh only |
| `FIELD_DEVICE_REJECTED` | Assigned officer tablet | `/device-registration` | No credentials in payload |
| `FIELD_DEVICE_SUSPENDED` | Assigned officer tablet | `/locked` | Session should lock |
| `FIELD_DEVICE_REVOKED` | Assigned officer tablet | `/locked` | Clear operational access |
| `FIELD_DEVICE_REPAIR_REQUIRED` | Assigned officer tablet | `/device-registration` | Re-pair flow |
| `FIELD_SESSION_REVOKED` | Assigned officer tablet | `/locked` | Remote force sign-out |

**routeType:** `FIELD_DEVICE_STATUS`  
**Builder:** `buildFieldDeviceNotificationMetadata()` in `notification-routing.schema.ts`

FCM data must not include device credentials, private keys, or raw hardware identifiers.

---

## Phase 7 Sprint 3 field operational notifications

| notificationType | Recipient | destination | Notes |
|------------------|-----------|-------------|-------|
| `FIELD_ASSIGNMENT` | Field tablet | `/assignments` | Safe metadata only |
| `FIELD_ASSIGNMENT_REASSIGNED` | Field tablet | `/assignments` | Includes assignmentId when present |
| `FIELD_MESSAGE` | Field tablet | `/comms` | Incident-scoped comms refresh |
| `FIELD_BACKUP_REQUEST` | Dispatcher/admin | `/backup` | Monitoring + nearby units per policy |
| `FIELD_BACKUP_ASSIGNED` | Field tablet | `/backup` | Assigned support metadata |
| `FIELD_OFFICER_SAFETY_ALERT` | Dispatcher/admin | `/safety` | Panic / officer-down |
| `FIELD_CHECKPOINT_ALERT` | Supervisor | `/checkpoint` | BOLO match / escalation |
| `FIELD_BOLO_ALERT` | Field tablet | `/bolo` | No witness identity |
| `FIELD_DRONE_MISSION` | Field tablet | `/drone` | Read-only mission link |
| `FIELD_DEVICE_HEALTH_WARNING` | Admin | `/device-status` | Battery/GPS/sync backlog |
| `FIELD_SHIFT_ALERT` | Field tablet | `/dashboard` | Shift approval / alerts |

**routeType:** `FIELD_OPERATIONAL`  
**Builder:** `buildFieldOperationalNotificationMetadata()` in `notification-routing.schema.ts`

On open: authenticate → validate field session + device → validate assignment/jurisdiction → fetch current state → route safely.

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
