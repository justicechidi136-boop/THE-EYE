# Incident Details Communication Contract

**Project:** THE EYE  
**Phase:** 6 — Incident-scoped communication  
**Mobile route:** `/incident-detail/:incidentId/messages` (read-only)

---

## Purpose

After an incident reaches a terminal status, reporters retain access to the **read-only communication record** from Incident Details and push deep links. This is not a public chat channel.

---

## Authorization

| Actor | Access |
|-------|--------|
| Reporter (owner) | Read thread; send disabled when terminal |
| Dispatcher / agency admin (scoped) | Read + official send while incident still operational; read-only after close |
| Community verifier | `404 Not Found` |
| Another citizen | `404 Not Found` |

---

## Mobile surfaces

| Surface | Behavior |
|---------|----------|
| Incident Details screen | Shows communication summary card when `conversationAvailable` |
| Communication screen | Opens with `readOnly: true` for terminal incidents |
| Active Emergency terminal redirect | Includes `communication` block for summary badge |

---

## API endpoints (reused)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/incidents/:id/conversation` | Summary + allowed actions |
| GET | `/v1/incidents/:id/messages` | Paginated thread |
| PATCH | `/v1/incidents/:id/messages/:messageId/read` | Mark read |

Write endpoints return `400` when incident is terminal and actor is reporter.

---

## Summary fields

Same shape as Active Emergency `communication` block — see `docs/ACTIVE_EMERGENCY_CONTRACT.md` and `docs/INCIDENT_COMMUNICATION_CONTRACT.md`.

When terminal:

- `allowedCommunicationActions.openThread` = `true`
- All send flags = `false`
- `conversationStatus` may be `Closed` after auto-close on terminal transition

---

## Related docs

- `docs/INCIDENT_COMMUNICATION_CONTRACT.md`
- `docs/INCIDENT_COMMUNICATION_SECURITY.md`
- `docs/ACTIVE_EMERGENCY_CONTRACT.md`
