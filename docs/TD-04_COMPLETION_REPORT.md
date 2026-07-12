# TD-04 Completion Report: Admin Placeholder Audit

**Status:** Resolved  
**Date:** 2026-07-10  
**Scope:** `apps/admin-web` — full dashboard audit, live API wiring, dependency documentation

---

## Executive Summary

The admin dashboard was audited route-by-route for placeholder data, mock services, hardcoded statistics, and TODO markers. Live NestJS endpoints were wired where they already exist. Pages without backend modules keep their UI layout but no longer render invented seed data; empty states and dependency notices document what is still required.

`lib/mock-data.ts` (319 lines of seed fixtures) was **removed entirely**.

---

## Audit Findings

### Placeholders removed or replaced

| Area | Before | After |
|------|--------|-------|
| Dashboard metrics (`/`) | Hardcoded `5326` fallbacks | Live counts from `fetchUsersDirectory`, `fetchIncidents`, `fetchLiveVideoSessions` |
| Dashboard chart | 9 months of hardcoded `chartData` | `buildDashboardChart()` from live incident `createdAt` and session `startedAt` |
| `/missing-persons` | `mock-data.incidents` filter | `fetchIncidentsByType(MissingPerson)` |
| `/stolen-vehicles` | `mock-data.incidents` filter | `fetchIncidentsByType(StolenVehicle)` |
| `/police-stations` | `mock-data.policeStations` | `GET /v1/police-stations/search` via `fetchPoliceStations()` |
| `/analytics` | Mock incidents + agencies | Live incident-derived metrics |
| `/agencies` | Mock agency cards | Agencies derived from assigned incidents + dependency notice |
| `/roles` | Mock `rolePermissions` table | `@the-eye/shared` `adminRolePermissions` + `roleScope` matrix |
| `DuplicateReportPanel` | `duplicateSamples` + TODO | Lazy-load `GET /v1/verification/incidents/:id/duplicates` via BFF |
| `EvidenceAccessLog` | `evidenceAccessSamples` + TODO | `fetchEvidenceAccessLogs()` from audit API (`evidence.viewed` / `evidence.downloaded`) |
| `BroadcastCreateForm` | Local success message only | `POST /v1/broadcasts` via `/api/admin/broadcasts` BFF |
| `NotificationComposeForm` | TODO + local message | `POST /v1/notifications/send` via `/api/admin/notifications/send` BFF |
| `AuditFilter` | Client-only filter on prefetched logs | Server refetch via URL query params + `fetchAuditLogs(filters)` |

### Placeholders retained with documented dependencies (no fake data)

| Route / Component | Missing endpoint | Documentation |
|-------------------|------------------|---------------|
| `/jurisdictions` | `GET /v1/jurisdictions` | `PlaceholderNotice` + empty tree |
| `/job-vacancies` | `GET /v1/job-vacancies` | Empty table + notice |
| `/live-chats` | `GET /v1/support/chats` | Empty queue + notice |
| `/sailing-permit` | `GET /v1/sailing-permits` | Empty table + notice |
| `/agencies` (full registry) | `GET /v1/agencies` | Derived incident counts only |
| `WitnessConfirmationPanel` | `GET /v1/verification/incidents/:id/confirmations` | Empty list; crowd-request POST exists but no listing API |
| `LiveVideoViewer` stream pane | `POST /v1/live-video/sessions/:sessionId/admin-token` | Placeholder player + notice |
| Dashboard user trend bars | `GET /v1/analytics/users` | Current-month total only; footnote in chart |
| Police station create/edit form | `POST/PATCH /v1/police-stations` | List wired; forms remain UI-only |

Central dependency registry: `apps/admin-web/lib/placeholder-dependencies.ts`  
Reusable notice component: `apps/admin-web/components/placeholder-notice.tsx`

---

## New / Updated Data Layer

### `lib/api/data.ts` additions

- `fetchPoliceStations(query?)`
- `fetchIncidentsByType(type)`
- `fetchIncidentDuplicates(incidentId)`
- `fetchEvidenceAccessLogs(incidentId)`
- `createBroadcast(input)` / `sendNotification(input)`

### BFF routes (httpOnly cookie → API token)

- `POST /api/admin/broadcasts`
- `POST /api/admin/notifications/send`
- `GET /api/admin/verification/incidents/[id]/duplicates`

### Mappers / types

- `PoliceStationView`, `DuplicateReportView`, `EvidenceAccessEntry`, `DashboardChartPoint`
- `toPoliceStationView`, `toDuplicateReportView`, `toEvidenceAccessEntry`, `evidenceAccessEntriesForIncident`
- `Incident.createdAt` added for chart aggregation

### Supporting modules

- `lib/dashboard-metrics.ts` — chart builder + agency derivation
- `lib/role-matrix.ts` — RBAC matrix from shared permissions
- `lib/placeholder-dependencies.ts` — endpoint dependency catalog

---

## Routes Already Live (unchanged, confirmed)

These routes were already wired before TD-04 and required no mock replacement:

`/incidents`, `/incidents/[id]`, `/emergency`, `/verification` (queue), `/broadcasts` (list), `/notifications` (list), `/audit` (list), `/users`, `/neighborhood-watch/*`, `/live-video` (sessions), `/smartwatch/*`, `/sos-monitor`, `/settings`, `/login`

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm run lint` | Pass (shared, admin-web, api, mobile) |
| `pnpm run build` | Pass (shared, api, admin-web Next.js 15) |
| `pnpm run test:integration` | Pass — **94/94** backend tests, mobile contract + smoke, admin build smoke, docker smoke, env validation |

---

## Files Changed (summary)

**Added:** 8 files (BFF routes, placeholder deps, role matrix, dashboard metrics, placeholder notice, completion report)  
**Modified:** ~25 admin-web pages/components + mappers + types + data layer  
**Deleted:** `apps/admin-web/lib/mock-data.ts`

---

## Residual Technical Debt

| ID | Item | Priority |
|----|------|----------|
| TD-04a | Wire police station create/edit forms to POST/PATCH | Medium |
| TD-04b | Witness confirmation listing endpoint + panel wiring | Medium |
| TD-04c | LiveKit admin token + player integration | Medium |
| TD-04d | Dedicated analytics API for dashboard trends | Low |
| TD-04e | Jurisdictions, agencies, job vacancies, live chats, sailing permits modules | Low (product scope) |

---

## Conclusion

TD-04 is **resolved**. The admin dashboard no longer depends on `mock-data.ts` or hardcoded statistics where live APIs exist. Remaining gaps are explicitly documented without inventing data, and all quality gates pass.
