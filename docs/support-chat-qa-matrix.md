# Support Chat Staging QA Matrix

Mobile support chat is separate from Neighborhood Watch Community Chat.

## Preconditions

- Staging mobile APK with support routes enabled
- Citizen test account signed in
- Admin account with `incident:read` / `incident:update` (support console access)
- Push notifications enabled on test device

## Test matrix

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Citizen opens `/support` | Emergency disclaimer visible; quick actions work |
| 2 | Start new chat (text) | Conversation appears in `/support/chats` and admin `/live-chats` |
| 3 | Admin assigns conversation | Citizen receives generic push; no message body leaked |
| 4 | Citizen sends text | Admin timeline updates; internal notes hidden on mobile |
| 5 | Citizen sends voice-only request | Conversation created without typed body |
| 6 | Admin replies | Mobile polling shows reply within 5s; push deep link opens conversation |
| 7 | Offline compose + reconnect | Pending message retries with same `clientMessageId` |
| 8 | Admin internal note | Never returned on citizen GET |
| 9 | Escalate linked incident | Status `Escalated`; audit event recorded |
| 10 | State admin jurisdiction | Cannot open conversation outside assigned state |
| 11 | Resolve + reopen | Status transitions; citizen can reopen |
| 12 | Community chat route | `/neighborhood-watch/chat` unchanged; no redirect to support |

## Evidence to capture

- Screenshots of mobile support home, conversation, admin live chat detail
- API request IDs for create/reply
- Audit log entries (no message bodies in metadata)
- Push notification payload (generic text only)
