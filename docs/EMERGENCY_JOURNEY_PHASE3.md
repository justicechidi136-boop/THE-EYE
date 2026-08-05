# Emergency User Journey — Phase 3 Status

**Branch:** `feature/emergency-user-journey-redesign`  
**Depends on:** Phase 2 PR #79 (not merged at implementation time)  
**Status:** PHASE 3 CODE COMPLETE — STAGING QA PENDING

## Delivered

- Strict Dart model for `GET /v1/incidents/:id/active-emergency`
- Multi-incident `ActiveEmergencyStore` with legacy migration
- Active Emergency screen driven by server contract (progress, allowedActions)
- Canonical routes: `/active-emergency/:incidentId`, `/active-emergencies`, `/active-emergency/none`
- All report submission flows navigate to Active Emergency (not `/tracking`)
- `POST /v1/incidents/:id/reporter-status` (Resolved / StillOngoing / Unsure)
- Separate cancel vs request-cancellation mobile flows
- Push routing ownership verification fetch before opening reporter controls
- App restart restore via stored references + server refresh

## Blocked (Phase 0)

- PR #79 merge into staging
- Staging migration deploy (`20260805120000_emergency_journey_lifecycle`)
- Staging API deploy verification
- Physical device QA / certification APK

## Deferred (Phase 4+)

- Community Verification UI
- Full notification schema v1
- Incident Status / Details redesign
- Full evidence upload UI wiring on Active Emergency (contract supports addEvidence)
