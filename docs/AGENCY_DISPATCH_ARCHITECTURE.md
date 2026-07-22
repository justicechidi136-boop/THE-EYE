# THE EYE — Agency Dispatch Architecture (Sprint 6)

**Status:** Architecture specification — Sprint 6 Phase 2  
**Baseline:** `staging` @ `7d71615`  
**Last updated:** 2026-07-22

---

## Purpose

Connect citizen/watch SOS and incident intake to **jurisdiction-scoped agencies**, **dispatchers**, and **field responders** with auditable routing, assignment, live location, and SLA escalation — reusing existing incidents, notifications, LiveKit, audit, and PostGIS infrastructure.

---

## Current state (audit summary)

### Exists
| Layer | Components |
|-------|------------|
| **Intake** | `IncidentsService.report`, `SmartwatchService.sos`, idempotency, jurisdiction lookup |
| **Status FSM** | `incident-lifecycle.ts` — 9 operational states |
| **Verification / triage proxy** | `VerificationService` — scoring, admin review |
| **Assignment (admin-only)** | `PATCH /incidents/:id/assign` → `assignedAgencyId`, `assignedAdminId` |
| **Agency data** | `Agency`, `PoliceStation`, `Jurisdiction` models; `GET /police-stations/nearest` |
| **Escalation rules** | `EscalationService` — manual `POST /escalation/run` |
| **Location** | `IncidentLocationUpdate`, `LiveVideoLocationUpdate`, `SmartwatchGpsTrack` |
| **LiveKit** | `LiveVideoService`, token service, admin viewer |
| **Notifications** | BullMQ push/in-app; SMS/email often disabled |
| **Audit** | Hash-chained `AuditLog` |
| **Admin** | Incident detail, assign/status BFF, SOS monitor list, LiveKit viewer, command dashboard metrics |

### Missing (Sprint 6 scope)
| Gap | Impact |
|-----|--------|
| `Responder`, `ResponseUnit`, `IncidentAssignment`, `DispatchEvent` models | No field responder lifecycle |
| `/v1/dispatch/*` API module | No dispatcher queue |
| Agency routing engine | Nearest police not wired to incidents |
| Responder availability API | Cannot accept/decline |
| SLA cron / worker | Escalation manual only |
| Assignment notifications | Citizens not notified on assign/status |
| Real GIS in admin | CSS mock maps only |
| Mobile active-emergency screen | No unified post-SOS UX |
| Responder ETA | Not computed |
| Incident conversation API | Chat buttons inert |

---

## Target architecture

```
┌─────────────┐     ┌─────────────┐
│ Mobile SOS  │     │  Watch SOS  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       v                   v
┌──────────────────────────────────┐
│         Incidents Module          │
│  report / emergency / location    │
└──────────────┬───────────────────┘
               │
       ┌───────┴────────┐
       v                v
┌─────────────┐   ┌─────────────┐
│   Triage    │   │ Verification│
│   Engine    │   │   Service   │
└──────┬──────┘   └─────────────┘
       │
       v
┌──────────────────────────────────┐
│      Agency Routing Engine        │
│  category + jurisdiction + prox   │
└──────────────┬───────────────────┘
               │
               v
┌──────────────────────────────────┐
│       Dispatch Queue API          │
│  GET/PATCH assignments, escalate  │
└──────────────┬───────────────────┘
               │
     ┌─────────┴─────────┐
     v                   v
┌─────────────┐   ┌─────────────┐
│  Responder  │   │   Admin     │
│  Mobile/Web │   │ Command Ctr │
└─────────────┘   └─────────────┘
       │                   │
       v                   v
┌──────────────────────────────────┐
│ Notifications (BullMQ) + LiveKit  │
└──────────────────────────────────┘
```

---

## Data model extensions (Phase 3 target)

Reuse `Agency` — extend with `serviceCategories`, `operatingHours`, `escalationPriority`, geofence as needed.

**New tables (proposed):**
- `responders` — links `userId` or `adminUserId` to `agencyId`, role, skills, availability, last location
- `response_units` — optional vehicle/team grouping
- `incident_assignments` — full assignment lifecycle
- `dispatch_events` — append-only operational log
- `responder_location_updates` — assignment-scoped GPS history

**Indexes:** `(agencyId, availability)`, `(incidentId)`, `(jurisdictionId, status, priority)`, PostGIS on responder location.

---

## Agency routing (Phase 6)

**Inputs:** incident type, priority, jurisdiction, coordinates, agency service categories, operating status, workload.

**Outputs:** ranked agency list + recommended capabilities + escalation deadline.

**Provider-neutral agency types** (examples — configured per jurisdiction, not hardcoded globally):

| Category | Agency type tags |
|----------|------------------|
| Crime / security | `police`, `nscdc`, `private_security` |
| Medical | `ambulance`, `hospital_emergency` |
| Fire | `fire_service` |
| Road / traffic | `frsc`, `police`, `ambulance` |
| Disaster | `emergency_management`, `fire`, `medical` |

**Rules:**
- Server-side only
- Dispatcher override with audited reason
- Cross-jurisdiction requires escalation policy
- Fallback escalation when no agency available

---

## Dispatch queue API (Phase 7 target)

Prefix: `/v1/dispatch` (new module)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/dispatch/incidents` | `incident:read` + agency scope |
| GET | `/dispatch/incidents/:id` | scoped |
| POST | `/dispatch/incidents/:id/assign` | `incident:assign` |
| POST | `/dispatch/incidents/:id/escalate` | `incident:assign` |
| POST | `/dispatch/incidents/:id/request-information` | scoped |
| PATCH | `/dispatch/assignments/:id` | responder / dispatcher |

Features: pagination, filters, priority sort, claim lock, idempotency, SLA timers.

---

## Responder actions (Phase 8)

| Action | API | Audit |
|--------|-----|-------|
| Go available / unavailable | `PATCH /dispatch/responders/me/availability` | yes |
| Accept / decline | `PATCH /dispatch/assignments/:id` | yes |
| En route / arrived / complete | status transitions | yes |
| Request backup | `POST /dispatch/incidents/:id/escalate` | yes |

Concurrency: row version or `SELECT FOR UPDATE` on assignment claim.

---

## Location (Phase 9)

| Stream | Storage | Consumer |
|--------|---------|----------|
| Citizen | `IncidentLocationUpdate` | Dispatcher map, ETA |
| Watch | `SmartwatchGpsTrack` | SOS monitor |
| Responder | `responder_location_updates` (new) | Command center |
| Live video | `LiveVideoLocationUpdate` | Admin LiveKit overlay |

Admin maps must use **real coordinates** (Leaflet/MapLibre or equivalent) — remove CSS mock markers.

---

## SLA / escalation (Phase 17)

Worker cron (reuse broadcast scheduler pattern):

| Condition | Action |
|-----------|--------|
| Unreviewed > threshold | Notify dispatcher |
| No assignment | Requeue + escalate |
| Not accepted | Reassign |
| Stale responder GPS | Warn + escalate |
| Agency unavailable | Alternate agency recommendation |

Idempotent job ids; bounded retries; audit every action.

---

## Command center (Phase 13)

Single admin surface (extend `/` + `/emergency` + new `/dispatch`):

- Active emergencies, unassigned queue, SLA timers
- Real map layers (incidents, responders)
- Actions: verify, assign, reassign, escalate, live location, LiveKit, resolve
- Worker/Redis/FCM health widgets (existing health endpoints)

Agency-scoped views (Phase 14): filter by `agencyId` + jurisdiction — shared components, role-based nav.

---

## Security (Phase 20)

| Control | Mechanism |
|---------|-----------|
| Jurisdiction | `assertAdminJurisdiction`, agency membership |
| Location privacy | Field-level DTOs for citizen vs dispatcher |
| Role escalation | Permission matrix + regression tests |
| LiveKit | Short-lived scoped tokens |
| Rate limits | Existing `@RateLimit` on SOS/report |

---

## Testing strategy (Phase 21)

Priority suites:
- `dispatch.service.spec.ts` — routing, assignment race, FSM
- `incidents.service.spec.ts` — extend SOS + cancel
- Mobile `active_emergency_*_test.dart`
- Watch offline replay + silent SOS flow tests
- Admin dispatch queue integration tests

---

## Infrastructure blockers (unchanged)

| ID | Blocker |
|----|---------|
| INF-005 | Redis required for queue workers on staging VPS |
| INF-006 | S3 for evidence (existing) |
| INF-003 | LiveKit staging credentials for runtime A/V QA |
| SMS/email webhooks | Emergency contact SMS |

---

## Sprint 6 delivery phases

1. ✅ Audit + contracts (this document + gap table)  
2. Schema + dispatch module foundation  
3. Triage + routing engine  
4. Mobile/watch active emergency UX  
5. Command center real maps + queue UI  
6. Responder availability + assignment FSM  
7. SLA worker + notifications wiring  
8. Tests + checklist update — **no PASS without staging device QA**
