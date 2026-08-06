# Incident Communication Contract

Schema version: Phase 6 (2026-08-08)

## Participants

| Role | Access | Write types |
|------|--------|-------------|
| Reporter | Own incident only | Text, Voice, Image, Video, QuickReply, LocationUpdate |
| Dispatcher/Admin | Jurisdiction + permission | OfficialNotice, SafetyInstruction, InformationRequest, Text, Voice, Image, Video |
| Assigned agency | Assigned incident | Operational official types |
| Responder | Active assignment | Text, Voice, Image, Video, operational updates |
| Community verifier | **Denied (404)** | — |
| Oversight auditor | Read-only in jurisdiction | — |

## REST endpoints

- `GET /v1/incidents/:incidentId/conversation`
- `GET /v1/incidents/:incidentId/messages` (cursor pagination)
- `POST /v1/incidents/:incidentId/messages`
- `PATCH /v1/incidents/:incidentId/messages/:messageId/read`
- `POST /v1/incidents/:incidentId/messages/:messageId/report`
- `POST /v1/incidents/:incidentId/conversation/restrict`
- `POST /v1/incidents/:incidentId/conversation/close`
- `POST /v1/incidents/:incidentId/information-requests`

## Active Emergency summary block

`GET /v1/incidents/:id/active-emergency` includes:

```json
{
  "communication": {
    "conversationAvailable": true,
    "unreadMessageCount": 0,
    "lastMessagePreview": "Dispatcher: Are you safe?",
    "lastMessageAt": "2026-08-08T12:00:00.000Z",
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

## Mobile routes

- Active thread: `/active-emergency/:incidentId/messages`
- Terminal history: `/incident-detail/:incidentId/messages` (read-only)

## Idempotency

`clientMessageId` is unique per conversation. Duplicate POST returns `{ duplicate: true, data: ... }`.

## Closure

When incident is terminal or conversation status is `Closed`/`Archived`, reporter sends are rejected; thread is read-only in UI.
