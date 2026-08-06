# Citizen Activity History Contract

Phase 5 unifies citizen-created emergencies, SOS events, and citizen broadcasts into one activity history feed with dedicated archive screens.

## Endpoints

| Method | Path | Audience | Purpose |
| --- | --- | --- | --- |
| `GET` | `/v1/users/me/activity-history` | Citizen | Unified activity feed with filters, search, pagination |
| `GET` | `/v1/incidents/:id/archive` | Reporting citizen | Read-only incident archive |
| `GET` | `/v1/broadcasts/:id/archive` | Broadcast creator | Read-only broadcast archive |

## Activity item shape

Each history card includes:

- `sourceType`: `incident` or `broadcast`
- `kind`: `EmergencyReport`, `SOS`, `SilentSOS`, `MissingPersonBroadcast`, `StolenVehicleBroadcast`
- `id`, `category`, `status`, `lifecycle`, `occurredAt`
- `location`, `agency`, `verificationStatus`, `broadcastReach`
- `latestUpdate`, `unreadUpdatesCount`, `timelinePreview`
- `navigation.destination`:
  - `active-emergency` for active incidents
  - `incident-archive` for terminal incidents
  - `broadcast-archive` for citizen broadcasts

## Filters

`section` supports:

`All`, `Active`, `Resolved`, `Cancelled`, `Broadcasts`, `EmergencyReports`, `SOS`, `MissingPersons`, `StolenVehicles`

Search query parameters:

- `q`
- `incidentId`
- `broadcastId`
- `vehiclePlate`
- `missingPersonName`
- `category`
- `status`
- `from`
- `to`
- `location`

Pagination:

- `cursor`
- `limit`

## Privacy

- Incidents are scoped to `reporterId = actor.sub`
- Broadcast archives are scoped to `creatorUserId = actor.sub`
- Timeline payloads use citizen audience filtering via `IncidentTimelineService`
- No other citizen private data is exposed

## Mobile routing

| Destination | Route |
| --- | --- |
| Active emergency | `/active-emergency/:incidentId` |
| Incident archive | `/incident-archive/:incidentId` |
| Broadcast archive | `/broadcast-archive/:broadcastId` |

Notifications with incident or broadcast identifiers deep-link into the same destinations.
