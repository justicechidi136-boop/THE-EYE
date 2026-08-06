# Community Verification Contract (Phase 4)

## Purpose

Enable nearby citizens to safely verify another user's incident report without accessing reporter identity, exact coordinates, Active Emergency controls, dispatcher notes, responder positions, or private evidence.

## Gap Matrix (Phase 1 Audit)

| Area | Existing | Gap | Phase 4 Action |
|------|----------|-----|----------------|
| Witness endpoints | `/v1/verification/incidents/:id/confirm` (binary) | No ownership-scoped request flow | New `/v1/community-verifications/:requestId` |
| Data model | `IncidentVerification` aggregate rows | No per-user request/response lifecycle | `CommunityVerificationRequest` + `CommunityVerificationResponse` |
| Nearby selection | `findNearbyWitnesses` in verification service | No eligibility policy, cooldown, or request records | `CommunityVerificationEligibilityService` |
| Notifications | Generic crowd push, no schema v1 routing | Routes verifiers toward Active Emergency | `COMMUNITY_VERIFICATION` schema v1 with `verificationRequestId` |
| Safe payload | N/A | Full incident exposure risk | Sanitized GET contract |
| Trust scoring | `ConfidenceScorerService` (incident-level) | No community aggregate scoring | `CommunityVerificationScoringService` |
| Active Emergency summary | `witnessCount`, `latestConfidence` only | Missing aggregate community block | Extended `communityVerificationSummary` |
| Admin | Incident verification queue | No community verification analytics/actions | Admin community verification workspace |
| Mobile | Witness confirm via generic API | No dedicated screen/route | `/community-verification/:requestId` |
| Voice accessibility | Voice on broadcasts/reports | No verifier screen voice guidance | Spoken summary + optional voice note |
| Anti-abuse | Partial (reporter exclusion in SQL) | No idempotency, device dup weighting, revoke | Request lifecycle + audit + rate limits |
| Resolution policy | Auto-escalation paths exist | No `COMMUNITY_RESOLUTION_RECOMMENDED` gate | Scoring recommendation only; no auto-close |

## Request Lifecycle

1. **Issue** — Admin/system/crowd-request creates `CommunityVerificationRequest` for eligible nearby user.
2. **Deliver** — Push notification with schema v1 `COMMUNITY_VERIFICATION` routing.
3. **Open** — Target user opens deep link; `openedAt` recorded.
4. **Respond** — One final structured response (idempotent via `clientActionId`).
5. **Terminal** — `Skipped`, `Expired`, `Revoked`, or `Cancelled` end the workflow.

Expired and revoked requests cannot be answered. Reporter cannot verify own incident.

## Safe GET Contract

Returns only: requestId, category, categoryDisplayLabel, approximateArea, approximateDistance/distanceBand, reportTime, sanitizedDescription, approvedEvidencePreviews, safetyNotice, allowedResponses, spokenSummaryTemplate, expiry, alreadyResponded, isExpired.

Never returns reporter identity, exact coordinates, internal notes, responder positions, cancellation controls, or private evidence.

## Notification Schema v1

```json
{
  "schemaVersion": 1,
  "routeType": "COMMUNITY_VERIFICATION",
  "eventType": "NEARBY_INCIDENT_VERIFICATION",
  "incidentId": "...",
  "verificationRequestId": "...",
  "category": "Fire",
  "distanceBand": "WITHIN_500_M",
  "issuedAt": "...",
  "expiresAt": "...",
  "deepLink": "/community-verification/<requestId>"
}
```

## Response Types

Confirmed, NotFound, StillOngoing, AppearsResolved, UnsafeToVerify, Skipped, Unsure.

Responses never change incident status directly.

## Resolution Policy

Scoring may emit `COMMUNITY_RESOLUTION_RECOMMENDED` for admin review on eligible low-risk categories only. Never auto-close kidnapping, violence, armed robbery, terrorism, serious fire, medical emergency, missing child, or incidents with active responders.

## Security

- Target-user authorization (404 for others to prevent enumeration)
- Idempotent responses via `clientActionId`
- Rate limits on open/respond/skip
- Trust-weighted scoring (not raw vote count)
- Device/account duplication signals
- Audit trail for admin actions
