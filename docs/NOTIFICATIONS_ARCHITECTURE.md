# THE EYE — Notifications Architecture

**Sprint:** 4 — Notifications and Broadcasts  
**Branch baseline:** `staging` @ `ca227fc` (Staging RC1)  
**Status:** Phase 1 audit complete; implementation in progress

## Purpose

This document defines notification delivery terminology, channel architecture, and status semantics used across API, admin, mobile, and watch clients.

**Rule:** Do not mark a notification **Delivered** based on queue insertion, BullMQ acceptance, FCM HTTP 200 alone, simulated dispatch, or webhook HTTP 200 without provider receipt proof.

---

## Delivery status taxonomy

| Status | Meaning | When to set |
|--------|---------|-------------|
| **Created** | Notification record persisted in database | After `Notification` row insert, before enqueue |
| **Queued** | BullMQ accepted the dispatch job | After successful `queue.add`; delivery log entry |
| **Processing** | Worker picked up the job | Processor start; before provider call |
| **ProviderAccepted** | Provider accepted the send request | FCM message ID returned; SMS/email provider accepted (not yet confirmed delivered) |
| **Delivered** | Reliable delivery confirmation | Provider delivery receipt, or approved **DeviceReceived** ack where implemented |
| **DeviceReceived** | Client acknowledged receipt | Watch/mobile explicit ack endpoint (where policy allows) |
| **Read** | User opened or marked read | `PATCH /notifications/:id/read` or equivalent |
| **Failed** | Final delivery failure | Non-retryable error or retries exhausted |
| **RetryScheduled** | Transient failure; retry pending | Processor records failure with retryable flag |
| **InvalidToken** | Destination token invalid | FCM `UNREGISTERED` / `NOT_FOUND`; token deactivated |
| **Cancelled** | Scheduled broadcast cancelled before dispatch | Broadcast workflow only |

### Legacy Prisma mapping (migration path)

Current `NotificationStatus` enum (`Pending`, `Sent`, `Delivered`, `Failed`, `Read`) maps as:

| Legacy | Sprint 4 canonical |
|--------|-------------------|
| Pending | Created or Queued |
| Sent | ProviderAccepted |
| Delivered | Delivered or DeviceReceived |
| Failed | Failed or InvalidToken |
| Read | Read |

Sprint 4 implementation will extend enums and delivery logs without breaking existing rows.

---

## Channels

| Channel | Provider module | Target |
|---------|-----------------|--------|
| `push` | `fcm.provider.ts` | Mobile FCM tokens (`android`, `ios`) |
| `watch_push` | `fcm.provider.ts` | Watch FCM tokens (`android_watch`) |
| `sms` | `sms.provider.ts` | E.164 phone |
| `email` | `email.provider.ts` | Verified email |
| `in_app` | `notification-dispatcher.service.ts` | In-app inbox only (no external provider) |

---

## Queue architecture

- **Queue name:** `the-eye-{environment}-push` (see `queue-names.ts`)
- **Job name:** `dispatch`
- **Worker:** `NotificationsProcessor` (BullMQ)
- **Redis:** Mandatory in staging and production (`THE_EYE_DISABLE_REDIS` must not be active on VPS)

Job payload identifiers:

- `notificationId`
- `broadcastId` (optional)
- `recipientId` / `userId`
- `channel`
- `idempotencyKey`

---

## Environment matrix

| Environment | Firebase project | Mobile package | Watch package |
|-------------|------------------|----------------|---------------|
| Staging | `the-eye-2stg` | `com.theeye.app.staging` | `com.theeye.watch.staging` |
| Production | `the-eye-2pd-d0217` | `com.theeye.app` | `com.theeye.watch` |

`FCM_MODE=real` required in staging/production. Simulation disabled when credentials present.

---

## API endpoints (current)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/notifications/send` | Admin/system send (multi-channel) |
| GET | `/v1/notifications` | Inbox list (cursor pagination) |
| GET | `/v1/notifications/:id` | Notification detail |
| PATCH | `/v1/notifications/:id/read` | Mark read |
| POST | `/v1/notifications/push-tokens` | Register FCM token |
| PATCH | `/v1/notifications/push-tokens/deactivate` | Deactivate token |
| POST | `/v1/notifications/:id/delivery-receipt` | Client delivery ack |
| GET | `/v1/broadcasts/nearby` | Citizen geo-targeted feed |
| POST | `/v1/broadcasts` | Create broadcast |
| PATCH | `/v1/broadcasts/:id/approve` | Approve pending |
| POST | `/v1/broadcasts/:id/dispatch` | Dispatch to audience |

---

## Security

- JWT + permission guards on all routes
- Jurisdiction scoping on admin send and broadcast create
- Deep-link allowlist (mobile: `push_deep_link_router.dart`)
- No raw FCM tokens in logs
- Rate limits on broadcast create (extend to notification send in Sprint 4)

---

## Related documents

- [PRODUCTION_FUNCTIONALITY_CHECKLIST.md](./PRODUCTION_FUNCTIONALITY_CHECKLIST.md) — Sprint 4 gap table
- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) — Firebase project configuration
- [github-workflows.md](./github-workflows.md) — CI/CD and staging validation
