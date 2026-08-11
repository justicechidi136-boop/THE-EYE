# Active Emergency UI redesign — Claude reference audit

**Reference:** https://claude.ai/public/artifacts/856bd3dc-ea95-47c0-8a66-3d93d2f9e27f  
**Captured HTML:** `artifacts/active-emergency-ref.html`  
**Branch:** `feat/active-emergency-ui-redesign`

## Claude reference audit (visual source of truth)

Single-column dark hub (`390×844` phone frame) with:

1. Circular back + title **Active Emergency** + subtitle **Help is on the way** + circular history/refresh
2. Orange **Emergency live** status rail (pulse + subline + elapsed timer)
3. Overview card: public reference + location + Reported / Response agency grid  
   *(mock shows a 27% ring — **not** implemented; citizen policy forbids numeric verification confidence)*
4. Response progress: horizontal **Submitted → Verifying → Agency → Responders → Resolved** + contextual note
5. Live video card: STREAMING label, 16:10 preview, LIVE chip, Stop / Switch camera
6. Quick actions row (4): Evidence · Location · Note · Communicate
7. Evidence strip + All
8. Your status segments: Ongoing · Resolved · Unsafe
9. Timeline + All
10. Cancel report text row

Communication is a **separate** push layer in the artifact; THE EYE keeps the canonical Phase 6 `/active-emergency/:id/messages` screen.

## Gap matrix

| Reference section | Current implementation | Difference | Required component | API/data available | Missing data | Plan |
|---|---|---|---|---|---|---|
| Header | Material `AppBar` | No subtitle, no circular icon buttons | `ActiveEmergencyHeader` | n/a | — | Match rail header; refresh action |
| Live rail | Plain “report received” copy | No pulse rail, no elapsed, no awareness line | `EmergencyLiveBanner` | `liveVideo`, `assignment`, verification copy | Exact “responders aware” count may be participantCount only | Derive factual subline; elapsed from `reportedAt` |
| Overview | Flat `_InfoRow` list | No card hierarchy; may expose technical fields | `EmergencyOverviewCard` | `publicReference`, location, agency, times | — | Friendly fields only; status chip not confidence % |
| Progress | Vertical `ListTile` list (9 stages) | Not horizontal 5-step tracker | `ResponseProgressCard` | `progressStages` | — | Collapse server stages → 5 citizen steps |
| Live video | Start/return CTA only | No inline preview, Stop, Switch | `ActiveLiveVideoCard` | `liveVideo` + existing LiveKit route | Inline LiveKit surface not hosted on AE | Preview chrome + Start/Stop/Switch via existing APIs/route |
| Communicate | Text preview + Open button | Artifact uses quick-action CTA | Quick action → Phase 6 route | `communication.*` | Recent message bodies not on AE contract | Open canonical messages; no fabricated messages |
| Evidence | Vertical EyeEvidenceCard list | Not horizontal strip | `EmergencyEvidenceCard` | `evidenceItems` / summary | Thumbnail URLs often absent | Type tiles + Add more via allowedActions |
| Quick actions | Evidence action sheet only | No 4-up grid | `EmergencyQuickActions` | `allowedActions` | — | Gate each tile by allowedActions |
| Your status | Stacked buttons (incl. Unsure) | Not 3-up Ongoing/Resolved/Unsafe | `EmergencyStatusUpdateCard` | reporter-status API | “Unsafe” label → `Unsure` | Map labels; keep API values |
| Timeline | Dense ListTiles | No colored dots / View all | `EmergencyTimelineCard` | `timelineSummary` | — | Citizen message mapping; strip confidence % |
| Safety tips | Absent | Artifact also lacks dedicated card | — | static | — | Omit (not in visual SoT) |
| Cancel | Tonal buttons mid-list | Bottom cancel text row | `EmergencyCancelCard` | cancel / requestCancellation | — | Sheet confirmation preserved |
| Loading | Full-page spinner | No skeletons | `ActiveEmergencySkeleton` | — | — | Card-shaped placeholders |
| Stale/error | Error text only | Weak cached-state framing | banner on screen | cache in state | — | “may be out of date” + Retry |

## Intentional deviations from mock HTML

1. **No 27% confidence meter** — policy / task §19.
2. **No “Verification confidence: 27%” timeline lines** — filtered via citizen presentation.
3. **Communication content** stays on Phase 6 screen (artifact screen 2), not duplicated with fake messages on the hub.
4. **Live video preview** uses authoritative session chrome; camera surface remains LiveKit via `/live-video` (no second WebRTC stack).
5. **Unsafe** UI label submits API status `Unsure`.

## Communication layer (interactive artifact screen 2)

Inspected interactively via local serving of `artifacts/active-emergency-ref.html`:
- Hub **Communicate** opens the Communication layer (slide-over in mock; Flutter uses pushNamed Phase 6 route).
- Back closes Communication and returns to Active Emergency.
- Communication includes: circular back header + reference/location subtitle, live rail, All/Mine/Responders tabs, role-colored message cards (TEXT/PHOTO/VOICE), receipt labels, Your status segments, bottom composer (`+` / pill input with camera+mic / orange send).

Presentation rebuilt in `IncidentCommunicationScreen` + `widgets/communication_*.dart` while preserving Phase 6 service, offline queue, mark-read, and allowedActions gating.

Receipt copy uses server `deliveryState` → Sent / Delivered / Seen (does **not** invent “Seen by N” counts).

## Validation snapshot

| Item | Result |
|---|---|
| Branch | `feat/active-emergency-ui-redesign` |
| Commit | `7d7ab9c8` |
| PR | https://github.com/justicechidi136-boop/THE-EYE/pull/105 |
| `flutter analyze` (redesign paths) | No issues found |
| Full mobile `flutter test` | **354/354** passed |
| Staging APK | `apps/mobile/build/app/outputs/flutter-apk/app-staging-debug.apk` |
| Package | `com.theeye.app.staging` |
| SHA-256 | `61AFED8683397E6D27AA2C5E83F3F03CE31F2C092D993DBE95FE7F5FE01530A9` |
| Physical device visual QA | **PENDING** |
| Final status | **ACTIVE EMERGENCY UI REDESIGN CODE COMPLETE — DEVICE QA PENDING** |
