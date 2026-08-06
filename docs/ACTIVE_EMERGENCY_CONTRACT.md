# Active Emergency API Contract

**Project:** THE EYE  
**Phase:** Emergency User Journey — Phase 2  
**Endpoint:** `GET /v1/incidents/:incidentId/active-emergency`

---

## Purpose

Single authoritative read contract for a reporter monitoring their own ongoing emergency. The client must **not** derive permissions, progress labels, or terminal routing independently.

---

## Authorization

| Actor | Access |
|-------|--------|
| Reporter (owner) | Allowed — full active contract |
| Another citizen | `404 Not Found` (no enumeration) |
| Admin (scoped) | Allowed via existing jurisdiction/agency scope |
| Unauthenticated | `403 Forbidden` |

Administrators use existing scoped incident read policy; a separate operational endpoint may be added in a later phase.

---

## Active response (`isActive: true`)

Returned when status is in the active set: `Submitted`, `Received`, `Verifying`, `Verified`, `Assigned`, `Responding`, `UnderControl`, `CancellationRequested`.

```json
{
  "isActive": true,
  "routeType": "OWN_ACTIVE_INCIDENT",
  "incidentId": "uuid",
  "ownership": "reporter",
  "category": "Emergency",
  "description": "...",
  "title": "...",
  "reportedAt": "2026-08-05T10:00:00.000Z",
  "reportedLocation": {
    "latitude": "6.601800",
    "longitude": "3.351500",
    "address": "...",
    "manualLocationAdjusted": false,
    "source": "gps",
    "quality": "reported",
    "liveLocationStale": false,
    "liveLocationUpdatedAt": null
  },
  "evidenceSummary": {
    "totalCount": 2,
    "photos": 1,
    "videos": 1,
    "voice": 0
  },
  "status": "Verified",
  "displayLabel": "Report verified",
  "statusVersion": 3,
  "progressStep": 4,
  "progressStages": [
    { "key": "submitted", "label": "Submitted", "state": "complete" },
    { "key": "verified", "label": "Verified", "state": "current" }
  ],
  "allowedActions": {
    "addEvidence": true,
    "uploadPhoto": true,
    "uploadVideo": true,
    "uploadVoice": true,
    "addUpdate": true,
    "cancel": true,
    "requestCancellation": false,
    "confirmResolved": false,
    "addWrittenUpdate": true,
    "updateLocation": true,
    "retryLiveVideo": true
  },
  "timelineSummary": [],
  "assignedAgency": null,
  "assignment": null,
  "responderEtaMinutes": null,
  "liveVideo": null,
  "communityVerificationSummary": {
    "witnessCount": 0,
    "latestConfidence": null
  },
  "cancellationSummary": { "status": "none" },
  "resolutionSummary": null,
  "lastUpdatedAt": "2026-08-05T10:05:00.000Z",
  "communication": {
    "conversationAvailable": true,
    "unreadMessageCount": 0,
    "lastMessagePreview": "Dispatcher: stay on the line",
    "lastMessageAt": "2026-08-05T10:04:00.000Z",
    "pendingInformationRequestCount": 0,
    "conversationStatus": "Active",
    "allowedCommunicationActions": {
      "sendText": true,
      "sendVoice": true,
      "sendPhoto": true,
      "sendVideo": true,
      "sendLocation": true,
      "quickReply": true,
      "openThread": true
    }
  }
}
```

---

## Terminal response (`isActive: false`)

Returned for: `Resolved`, `Closed`, `CancelledByReporter`, `FalseReport`, `ExpiredAfterReview`.

HTTP **200** — not 404 — so mobile can redirect safely without treating data as lost.

```json
{
  "isActive": false,
  "routeType": "INCIDENT_DETAILS",
  "incidentId": "uuid",
  "status": "CancelledByReporter",
  "displayLabel": "Cancelled by reporter",
  "statusVersion": 4,
  "resolutionSummary": null,
  "cancellationSummary": {
    "status": "cancelled",
    "reason": "False alarm",
    "cancelledAt": "2026-08-05T10:10:00.000Z"
  },
  "communication": {
    "conversationAvailable": true,
    "unreadMessageCount": 0,
    "lastMessagePreview": "Official notice: incident closed",
    "lastMessageAt": "2026-08-05T10:09:00.000Z",
    "pendingInformationRequestCount": 0,
    "conversationStatus": "Closed",
    "allowedCommunicationActions": {
      "sendText": false,
      "sendVoice": false,
      "sendPhoto": false,
      "sendVideo": false,
      "sendLocation": false,
      "quickReply": false,
      "openThread": true
    }
  }
}
```

Mobile should navigate to Incident Details using `routeType: "INCIDENT_DETAILS"`.

---

## Derived fields (never stored)

| Field | Source |
|-------|--------|
| `displayLabel` | Status → label map |
| `progressStep` | Current stage index |
| `progressStages` | Status history + stage definitions |
| `allowedActions` | Status + ownership + assignment + cancellation state + role |
| `isActive` / `isTerminal` | Active/terminal status sets |
| `cancellationSummary` | Cancellation fields + status |
| `resolutionSummary` | Resolution fields |
| `communication` | Incident communication summary (Phase 6) |

Implementation: `apps/api/src/modules/incidents/incident-presentation.mapper.ts`

---

## Security rules

1. Reporter ownership enforced before query expansion.
2. Dispatcher-only notes and internal metadata are **not** exposed.
3. Another citizen receives `404`, not `403`, for non-owned incidents.
4. Cross-jurisdiction admin restrictions use existing `incidentScopeWhere` policy.
5. `allowedActions` is authoritative — client must not recompute permissions.

---

## Related endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/incidents/:id/cancel` | Pre-assignment cancel |
| POST | `/v1/incidents/:id/request-cancellation` | Post-assignment cancel request |
| POST | `/v1/incidents/:id/updates` | Reporter written update (timeline) |
| POST | `/v1/incidents/:id/reporter-status` | Reporter resolution feedback |
| GET | `/v1/incidents/:id` | Full incident record (history/details) |
| GET | `/v1/incidents/:id/conversation` | Communication summary + allowed actions |
| GET | `/v1/incidents/:id/messages` | Incident-scoped message thread |
