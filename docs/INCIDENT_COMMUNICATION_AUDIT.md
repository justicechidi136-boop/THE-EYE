# Phase 6 — Incident Communication Audit (Phase 1)

Date: 2026-08-06  
Branch baseline: `staging`

## Gap matrix

| Capability | Existing reusable asset | Missing for Phase 6 | Mobile | Admin | Responder | Notifications | Security risk | Tests | Required change |
|------------|-------------------------|---------------------|--------|-------|-----------|---------------|---------------|-------|-----------------|
| Incident-scoped thread | `SupportConversation.incidentId` (unused from citizen) | Dedicated `IncidentConversation` lifecycle | No | Partial link | No | Partial | Medium — wrong product boundary if reused blindly | Support chat only | New incident-communications module |
| Bidirectional messaging | `SupportChatsService` patterns | `/incidents/:id/messages` API | Support UI only | Live Chat console | No | Support types | Medium | Support specs | Incident API + Active Emergency panel |
| Dispatcher notes | `DispatchEvent`, timeline | Not chat | N/A | Dispatch timeline | N/A | One-way | Low | Yes | Complement, not replace |
| Push deep links | Schema v1, inbox mapper | `INCIDENT_MESSAGE_RECEIVED` route | Partial | N/A | No | Gap in allowlist | Medium — content leakage if bodies in push | Partial | Extend NOTIFICATION_SCHEMA_V1 |
| Voice/media in thread | S3 presign, voice worker, support attachments | Wire to incident messages | Evidence only | Support | No | N/A | High if public URLs | Voice specs | Reference attachmentId / objectKey |
| Realtime | None (5s poll in support) | WS/SSE optional | Poll only | Poll | No | Push refresh | Low | None | Push-triggered refresh + poll |
| Offline queue | Pending submission store (incidents) | Message offline queue | No | N/A | No | N/A | Medium duplicate send | Partial | Mobile queue store |
| Community access | Community messaging separate | Must deny | N/A | N/A | N/A | N/A | **Critical** if crossed | CV specs | Hard deny in auth layer |
| Audit | `support_chat.message_sent` | `communication.message_sent` | N/A | Partial | N/A | N/A | Medium | Partial | Incident comm audit actions |
| Terminal archive | Phase 5 incident archive | Communication history section | Phase 5 partial | N/A | N/A | Route to archive | Low | Phase 5 | Read-only when conversation Closed |

## Reuse decision

- **Reuse:** S3 presign helpers, BullMQ notification pipeline, audit service, cursor pagination, incident scope guards, voice transcription queue, Active Emergency shell.
- **Do not reuse as-is:** Support chat citizen create flow (hardcodes `CitizenSupport`), broadcast comments, community channels, dispatch one-way events.
- **New:** `IncidentConversation`, `IncidentMessage`, `IncidentMessageReceipt`, `IncidentInformationRequest` models and `incident-communications` API module.

## Implementation order

1. Audit doc (this file) + contract docs  
2. Prisma migration  
3. API module + authorization  
4. Information requests + receipts  
5. Active Emergency summary extension  
6. Mobile communication panel + offline queue  
7. Admin dispatch panel  
8. Notification schema + deep links  
9. Security/moderation tests  
10. Readiness docs + PR  
