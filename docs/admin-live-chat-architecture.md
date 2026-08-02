# Live Chat Architecture Decision

## Decision: Option B — dedicated support/incident chat model

**Date:** 2026-08-02  
**Status:** Approved for implementation

## Options considered

### A. Extend incident timeline / dispatch events
- `IncidentTimeline` is append-only audit/events, not bidirectional messaging.
- `DispatchEvent` includes internal notes but lacks conversation threading, unread counts, assignment, and citizen reply semantics.
- Cannot safely expose timeline entries to citizens without leaking internal dispatch notes.

### B. Dedicated operational chat module (selected)
- New `SupportConversation` + `SupportMessage` models.
- API namespace: `/v1/support/chats`.
- Conversations link optionally to `incidentId`, with types: `Incident`, `CitizenSupport`, `Agency`, `Responder`.
- Internal messages flagged `isInternal=true` and excluded from citizen-facing APIs.

## Canonical admin routes
- List: `/live-chats`
- Detail: `/live-chats/[conversationId]`

## Community Chat (separate product)
- Moderation console remains at `/neighborhood-watch/chat`.
- Live Chat must never redirect to Community Chat.

## Security
- Reporter identity redacted per incident privacy rules.
- Jurisdiction scoping via conversation geography + linked incident scope.
- Document attachments use existing S3 presign pattern.
- All assignment, close, escalate, and internal-note actions audited.
