# Emergency User Journey — Phase 3.5

**Status:** Code complete — staging QA pending  
**Branch:** `feature/active-emergency-phase-3-5`

---

## Reporter-centric flow

```
Report Emergency
        ↓
Active Emergency (live dashboard)
        ↓
Evidence / Voice / Written updates (same incident)
        ↓
Start Live Video → stream → stop → Active Emergency
        ↓
Terminal status → Incident Details
```

Reporters **never** land on Incident Status (`/tracking`) while an incident is active.

---

## Phase 3.5 deliverables

| Area | Status |
|------|--------|
| Evidence upload on Active Emergency | Complete |
| Voice update recording + upload | Complete |
| Live video return to Active Emergency | Complete |
| Notification schema v1 | Complete |
| Ownership routing (push + inbox) | Complete |
| Active Emergency summary + live video card | Complete |
| Accessibility (semantics, haptics, voice recorder) | Complete |
| Offline evidence retry queue | Complete |
| Tests | API + mobile suites updated |

---

## Deferred (later phases)

- Community Verification UI
- Incident Status redesign
- Incident Details redesign
- Emergency Chat

---

## Phase 14 — Citizen broadcast journey (Missing Person / Stolen Vehicle)

```
Services → Create broadcast
        ↓
Missing Person OR Stolen Vehicle form (voice-first optional)
        ↓
Active immediately + country delivery queued
        ↓
My Broadcasts / feed / detail
        ↓
Comments · Report abuse · Share · Submit sighting
        ↓
Mark Found/Recovered OR Withdraw
        ↓
Resolution notification (BROADCAST_DETAILS deep link)
```

Broadcast navigation is separate from emergency incident reporting. Job Vacancies and unrelated menu items must not route to broadcast creation.

---

## Related docs

- [ACTIVE_EMERGENCY_CONTRACT.md](./ACTIVE_EMERGENCY_CONTRACT.md)
- [NOTIFICATION_SCHEMA_V1.md](./NOTIFICATION_SCHEMA_V1.md)
- [RELEASE_CANDIDATE_TEST_MATRIX.md](./RELEASE_CANDIDATE_TEST_MATRIX.md)
