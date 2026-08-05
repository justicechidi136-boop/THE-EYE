# Emergency Reporting & Incident Management — Phase 1 Audit

**Project:** THE EYE  
**Date:** 2026-08-05  
**Status:** AUDIT COMPLETE — implementation blocked until this document is reviewed  
**Branch baseline:** `staging` @ PR #78 merge (live video lifecycle)

---

## Executive summary

THE EYE has substantial incident infrastructure (Prisma models, dispatch, verification scoring, Active Emergency screen, push deep links, admin command centre) but the **product journey is not wired end-to-end**. The largest gaps:

1. **Report submit → `/tracking`** instead of **Active Emergency** for all standard report flows.
2. **No Community Verification screen or API contract** for nearby verifiers — crowd confirm exists server-side but mobile has no safe verifier UX.
3. **No `GET /v1/incidents/:id/active-emergency`** aggregate contract — mobile polls three endpoints and maps status locally.
4. **Notification routing is type/heuristic-based**, not ownership-aware schema v1 — inbox taps ignore `incidentId`.
5. **`POST /v1/incidents/:id/cancel` is likely broken** — attempts `Closed` from pre-`Resolved` states blocked by lifecycle FSM.
6. **No resolution engine, reporter confirmation prompt, or community auto-resolution policy** as specified.
7. **Incident lifecycle lacks** user-facing labels, progress steps, allowed actions, terminal flags, and cancellation-request states.

**Do not patch navigation alone.** This requires API contract, lifecycle FSM extension, notification schema, mobile screens, admin controls, migrations, tests, and staging QA as one programme.

---

## Product principles (target)

| Screen | Responsibility |
|--------|----------------|
| Report Emergency | Create new report only |
| Active Emergency | Reporter monitors **own** ongoing emergency |
| Community Verification | Verify **another person's** incident safely |
| Notifications | Inform + route by ownership, purpose, state |
| Incident Status | Reporter's full history (Active / Resolved / Cancelled / All) |
| Incident Details | Permanent read-only record |

Routing inputs: **ownership**, **incident state**, **notification purpose**, **role**, **server authorization** — never raw `incidentId` alone.

---

## Current vs target lifecycle

### Implemented (`IncidentStatus` in Prisma + `@the-eye/shared`)

```
Submitted → Received → Verifying → Verified → Assigned → Responding → Resolved → Closed
                                                                               ↘ FalseReport
```

### Target (Phase 2 recommendation — mapping)

| Target state | Current equivalent | Gap |
|--------------|-------------------|-----|
| Submitted | Submitted | OK |
| Verifying | Received + Verifying | Split/merge needed for UX |
| Verified | Verified | OK |
| AgencyAssignmentPending | *(none)* | **Missing** |
| AgencyAssigned | Assigned | Rename/display only |
| RespondersEnRoute | Responding (partial) | Assignment sub-status exists; not exposed as progress |
| RespondersOnScene | Responding (partial) | Same |
| UnderControl | *(none)* | **Missing** |
| Resolved | Resolved | OK |
| CancelledByReporter | *(none)* — cancel → Closed | **Broken FSM + wrong terminal** |
| CancellationRequested | *(none)* | **Missing** |
| RejectedAsInvalid | FalseReport | OK |
| ClosedByDispatcher | Closed | OK |
| ResolvedByAgency / Community / Reporter | *(none)* | **Missing resolutionSource** |
| ExpiredAfterReview | *(none)* | **Missing** |

---

## Gap matrix

| # | Requirement | Current implementation | Current route / API | DB support | Notifications | Admin | Security | Tests | Required change |
|---|-------------|------------------------|---------------------|------------|---------------|-------|----------|-------|-----------------|
| **P1 — Report → Active Emergency** |
| 1 | Submit report → Active Emergency | `ReportScreen._submit` → `/tracking` | `POST /incidents/report\|emergency\|sos` | Incident created | None on submit | Queue only | Reporter scoped | Partial | Mobile: `activateActiveEmergency` + navigate; API: return active-emergency payload in create response |
| 2 | Emergency form "Send emergency now" | Same as above → `/tracking` | Same | Same | Same | Same | Same | No | Same as #1 |
| 3 | SOS bottom sheet → Active Emergency | **Works** — activate + `/active-emergency` | `POST /incidents/sos` | OK | Partial | OK | OK | Partial | Keep; align payload with new contract |
| 4 | Live video → Active Emergency option | Activates store; stays on `/live-video` | Live video start | OK | Partial | OK | OK | Partial | Post-start navigate or embed live status in Active Emergency |
| 5 | Smartwatch SOS → Active Emergency | API only; no mobile activation | `POST /smartwatch/sos` | OK | Watch push | OK | OK | Partial | Phone companion routing if applicable |
| **P2 — Active Emergency** |
| 6 | Dedicated aggregate API | Polls 3 endpoints | `GET /incidents/:id`, `/timeline`, `/live-location` | Partial | N/A | Dispatch detail | Scoped | Mobile unit tests | **New** `GET /incidents/:id/active-emergency` |
| 7 | Progress tracker UI | Phase enum mapped locally | None server-side | No progressStep | N/A | SLA panel only | N/A | Partial | Server-driven progress stages + allowedActions |
| 8 | "Report received" confirmation | Partial copy on screen | N/A | N/A | N/A | N/A | N/A | Partial | First-run message + server displayLabel |
| 9 | Add evidence from Active Emergency | Evidence pipeline exists | presign/confirm | OK | N/A | View only | Scoped | Partial | Wire actions + timeline events |
| 10 | Retry live video | Live video screen separate | live-video start | OK | livevideo type | N/A | OK | Yes | Link from Active Emergency |
| 11 | Multiple active incidents | Single stored active ID | GET /incidents (filter client-side) | One row per incident | incidentId in push | N/A | Reporter filter | No | Active Emergencies selector + list API |
| **P3 — Cancellation** |
| 12 | Reporter cancel before assignment | UI calls cancel | `POST /incidents/:id/cancel` | status → Closed | None | N/A | Ownership check | **None** | Fix FSM: allow CancelledByReporter or Submitted→Closed path; audit |
| 13 | Cancellation request after assignment | Not implemented | None | None | None | N/A | N/A | No | `POST /request-cancellation` + admin review |
| 14 | Cancel preserves record | Closed status | OK | OK | N/A | OK | OK | No | Terminal state + Incident Details routing |
| **P4 — Community Verification** |
| 15 | Dedicated verifier route | **Missing** | None | `IncidentVerification` witness; no `CommunityVerificationRequest` | Crowd push generic | Admin crowd-request | Witness confirm API | Partial | **New** mobile screen + safe payload API |
| 16 | Verifier cannot see Active Emergency | No verifier flow | N/A | N/A | Routes to `/tracking` or `/active-emergency` by type | N/A | **Gap** | Partial | `routeType: COMMUNITY_VERIFICATION` + server auth |
| 17 | Safe payload (no reporter PII) | Crowd confirm has title only | `POST /verification/.../confirm` | Partial | Body text | Admin view full | Witness scoped | Partial | Formal safe payload + distance/area |
| 18 | Response types (Confirm/NotFound/…) | `confirmed` / witness list | confirm endpoint | Partial | N/A | Dashboard | Partial | Partial | Extend model per Phase 11 |
| **P5 — Resolution** |
| 19 | Resolution engine | Manual status PATCH + assignment complete | dispatch PATCH | resolvedAt only | IncidentStatusUpdate | Resolve on legacy page | Admin only | Partial | **New** resolution service + policy |
| 20 | Community auto-resolve | Scoring only; no auto-close | verification.service | confidence on verification row | N/A | Admin review | N/A | Partial | Phase 12–13 engine |
| 21 | Reporter resolution prompt | Not implemented | None | No lastTrustedUpdateAt | None | N/A | N/A | No | Worker + `POST /reporter-status` |
| 22 | Prohibited auto-resolve categories | P1 auto-escalate only | verification | priority on incident | N/A | Manual | N/A | Partial | Category blocklist in engine |
| **P6 — Incident Status & Details** |
| 23 | Incident Status tabs (Active/Resolved/…) | `/tracking` flat list | `GET /incidents` | status enum | N/A | N/A | Reporter scope | Partial | Refactor tabs + routing rules |
| 24 | Active card → Active Emergency | Tiles not tappable | N/A | N/A | N/A | N/A | N/A | No | onTap routing by status |
| 25 | Resolved → Incident Details | Detail from tracking tap | `GET /incidents/:id` | OK | `/tracking` fallback | OK | OK | Partial | Terminal → details; add resolution block |
| 26 | Incident Details read-only | Mostly read-only | OK | timeline + statusHistory | N/A | OK | OK | Partial | Add resolution/cancellation/community summary |
| **P7 — Notifications** |
| 27 | Ownership-aware schema v1 | Heuristic `buildNotificationDeepLink` | metadata.route | metadata JSON | Partial | N/A | Partial | mapper spec | **New** schemaVersion + routeType + server re-fetch |
| 28 | Own incident → Active Emergency | type contains `incident` → `/active-emergency` | dispatch metadata | OK | Partial | N/A | Partial | push tests | Validate ownership on open |
| 29 | Community → Verification only | Falls back `/tracking` | crowd confirm | N/A | **Wrong route** | N/A | **Gap** | No | `/community-verification/:requestId` |
| 30 | Resolved → Incident Details | `/tracking` or `/active-emergency` | heuristic | N/A | Wrong for terminal | N/A | Gap | No | routeType OWN_INCIDENT_DETAILS |
| 31 | Inbox tap passes incidentId | Uses deepLink only | N/A | N/A | inbox | N/A | Gap | No | Fetch context + args |
| 32 | Push ≠ source of truth | Mobile polls 10s | OK pattern | N/A | OK | N/A | OK | Partial | version/cursor on active-emergency |
| **P8 — Admin** |
| 33 | Command centre lifecycle view | Dispatch detail + timeline | `/v1/dispatch/incidents/:id` | OK | N/A | OK | Jurisdiction | Partial | Reporter journey + resolution UI |
| 34 | Cancellation review | Not in UI | None | None | N/A | **Missing** | N/A | No | Admin accept/reject cancellation |
| 35 | Community verification analytics | Verification queue | `/verification/dashboard` | Partial | N/A | OK | OK | Partial | Link to incident resolution engine |
| 36 | Verify/resolve from dispatch | Separate `/verification` | OK | OK | N/A | Split UI | OK | Partial | Unified command centre actions |
| **P9 — Security** |
| 37 | Reporter-only Active Emergency | Service-layer reporterId check on get | OK | OK | Partial | N/A | OK | Partial | active-emergency endpoint enforce |
| 38 | Verifier cannot cancel | N/A (no verifier UI) | confirm only | OK | N/A | N/A | OK | Partial | Server-side on all mutation endpoints |
| 39 | Deep link enumeration | get() scoped | OK | OK | Partial | N/A | Partial | Partial | Auth fetch on every notification open |
| 40 | Exact location hidden from verifiers | Not formalized | witness confirm | coords on incident | N/A | Full view | **Gap** | No | Safe payload with approximate area only |
| **P10 — Database** |
| 41 | resolutionSource, progressStep, etc. | Missing fields | N/A | **Gap** | N/A | N/A | N/A | N/A | Phase 23 migration |
| 42 | CommunityVerificationRequest model | Not present | witness flow only | **Gap** | N/A | N/A | N/A | No | Phase 11 migration |
| **P11 — Accessibility & offline** |
| 43 | Voice updates / spoken status | Voice evidence pipeline | presign | OK | N/A | N/A | OK | Partial | Active Emergency voice UX |
| 44 | Offline draft + retry | pending_submission_store | OK | clientSubmissionId | N/A | N/A | OK | Yes | Extend to reporter-status queue |
| 45 | Stale status labelling | Poll only | N/A | liveLocationStale | N/A | N/A | N/A | No | Show stale badge; no fake ETA |

---

## Critical bugs found in audit

### 1. Cancel endpoint vs lifecycle FSM

`cancelEmergency` allows cancel from `Submitted`…`Assigned` but calls `updateStatus(..., Closed)`.  
`canTransitionIncident` only allows `Closed` from `Resolved`.

**Impact:** Reporter cancel from Active Emergency likely returns 400 for most statuses.  
**File:** `apps/api/src/modules/incidents/incidents.service.ts` (line ~574)

### 2. Report submit never activates Active Emergency

Only SOS path calls `activateActiveEmergency` + navigates. Emergency reports start location tracking but go to `/tracking`.

**Files:** `apps/mobile/lib/main.dart` (`ReportScreen._submit` ~4136, SOS ~8110)

### 3. Notification inbox ignores incidentId

`NotificationsScreen` navigates to `deepLink` string only — no route arguments.

**File:** `apps/mobile/lib/main.dart` (~5683)

---

## Hardcoded / mock states (mobile)

| Location | Behavior |
|----------|----------|
| `IncidentHistoryService._summaryFromJson` | confidence 85/55 fallback; "Awaiting assignment" |
| `ActiveEmergencySnapshot.fromJson` | default status `"Submitted"`, type `"SOS"` |
| `CommunityPostItem` | default `PendingVerification` |
| `AppController.submitDraft` (deprecated) | fixed Lagos coordinates |
| `FamilySafetyCircleScreen` | static member list |

---

## Existing assets to reuse (do not rewrite)

| Area | Reuse |
|------|-------|
| Incident create | `IncidentsService.report/reportEmergency/reportSos` |
| Active Emergency UI | `active_emergency_screen.dart` + service (extend, don't replace) |
| Evidence | presign/confirm pipeline |
| Dispatch | `DispatchService` assignment FSM |
| Verification scoring | `verification.service.ts` |
| Push infra | `NotificationsService`, FCM provider, BullMQ worker |
| Admin dispatch | `command-centre-console.tsx`, dispatch BFF |
| Audit hash chain | `AuditService` (extend coverage) |
| Mobile push router | `PushDeepLinkRouter` (extend with server-validated routing) |

---

## Recommended implementation sequence

| Sprint slice | Phases | Deliverable |
|--------------|--------|-------------|
| **A — Docs + lifecycle** | 2, 28 | Shared lifecycle package, transition rules, incident status DTO |
| **B — API contracts** | 4, 7, 8, 11, 13, 23 | active-emergency, cancel fix, request-cancellation, community verification API, resolution engine |
| **C — Mobile reporter journey** | 3, 5, 6, 15, 16, 17 | Submit → Active Emergency, refactor screen, Incident Status tabs |
| **D — Mobile verifier journey** | 9, 10, 18 | Community Verification screen + routing |
| **E — Notifications** | 18, 19, 20 | Schema v1, ownership fetch-on-open, all notification types |
| **F — Admin** | 21, 22 | Resolution controls, cancellation review, audit coverage |
| **G — Tests + QA** | 26, 27, 29 | Automated suites + staging device matrix |

**Branch:** `feature/emergency-user-journey-redesign` (from latest green `staging`)  
**PR policy:** One PR to staging; **do not auto-merge**; wait for CI + explicit approval.

---

## Phase 1 exit criteria

- [x] Gap matrix documented
- [x] Current routes and APIs mapped
- [x] Lifecycle gap identified
- [x] Critical bugs flagged
- [x] Reuse inventory listed
- [x] Implementation sequence proposed
- [ ] Stakeholder review of audit (human gate before Phase 2)

---

## Related existing docs

- `docs/EMERGENCY_RESPONSE_CONTRACT.md` — prior emergency contract (may need merge into Phase 28 set)
- `docs/AGENCY_DISPATCH_ARCHITECTURE.md` — dispatch command centre
- `docs/STAGING_TROUBLESHOOTING.md` — live video (orthogonal)

Phase 28 will add: `EMERGENCY_USER_JOURNEY.md`, `ACTIVE_EMERGENCY_CONTRACT.md`, `COMMUNITY_VERIFICATION_CONTRACT.md`, `INCIDENT_LIFECYCLE.md`, `INCIDENT_RESOLUTION_POLICY.md`, `NOTIFICATION_DEEP_LINK_CONTRACT.md`, `RELEASE_CANDIDATE_TEST_MATRIX.md`.
