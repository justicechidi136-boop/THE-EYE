# THE EYE — Neighborhood Watch Admin Console (CSOC)

**Generated:** 2026-07-10  
**Status:** Build PASS · Lint PASS · Integration 111/111 PASS

---

## 1. Screen Inventory

| Screen | Route | Data source | Actions |
|--------|-------|-------------|---------|
| Dashboard | `/neighborhood-watch` | Live metrics aggregator | Quick links |
| Community Map | `/neighborhood-watch/map` | Map layers API + incidents/SOS/live video | Marker detail panel, layer toggles |
| Communities | `/neighborhood-watch/communities` | `GET /v1/neighborhood-watch/communities` | Link to detail |
| Community Detail | `/neighborhood-watch/[id]` | Community + feed + map | View stats, posts, patrols |
| Residents | `/neighborhood-watch/residents` | Memberships from communities API | Directory view |
| Resident Approvals | `/neighborhood-watch/approvals` | Pending memberships | Approve (live BFF) |
| Community Feed | `/neighborhood-watch/posts` | `GET /v1/neighborhood-watch/posts` | Verify / False / Disputed |
| Incident Centre | `/neighborhood-watch/incidents` | `GET /v1/incidents` | Link to incident detail |
| Verification Queue | `/neighborhood-watch/verification` | Community posts | Verify actions |
| Emergency Broadcasts | `/neighborhood-watch/broadcasts` | `GET/POST /v1/broadcasts` | Create broadcast form |
| Missing Persons | `/neighborhood-watch/missing-persons` | Incidents filtered by type | Read-only queue |
| Stolen Vehicles | `/neighborhood-watch/stolen-vehicles` | Incidents filtered by type | Read-only queue |
| Patrol Management | `/neighborhood-watch/patrols` | Community map patrol data | Read-only schedules |
| Volunteer Network | `/neighborhood-watch/volunteers` | Community map volunteers | Category display |
| Community Chat | `/neighborhood-watch/chat` | Communities list | Channel types (messages API noted) |
| Smartwatch Console | `/neighborhood-watch/smartwatch` | Admin devices + SOS events | Fleet + SOS tables |
| Live Monitoring | `/neighborhood-watch/live-monitoring` | Incidents, broadcasts, live video, SOS | Real-time GIS |
| AI Intelligence | `/neighborhood-watch/ai-intelligence` | Posts + incidents confidence | Hotspot insights |
| Analytics | `/neighborhood-watch/analytics` | Communities, posts, volunteers, patrols | Charts / bars |
| Reports | `/neighborhood-watch/reports` | Audit + summary counts | Export placeholders |
| Audit Logs | `/neighborhood-watch/audit` | `GET /v1/audit` | Filter + chain status |
| Settings | `/neighborhood-watch/settings` | Session + theme | Dark/light toggle |

**Total CSOC screens:** 22 (including community detail)

---

## 2. Component Inventory

### CSOC shell & layout
| Component | Path | Purpose |
|-----------|------|---------|
| `CsocShell` | `components/csoc/csoc-shell.tsx` | Dedicated CSOC sidebar (20 nav items) |
| `NeighborhoodWatchLayout` | `app/neighborhood-watch/layout.tsx` | Wraps all CSOC pages |

### CSOC data display
| Component | Path | Purpose |
|-----------|------|---------|
| `CsocMetricGrid` | `components/csoc/csoc-metric-grid.tsx` | KPI cards grid |
| `CsocMap` | `components/csoc/csoc-map.tsx` | Interactive GIS with layers + detail panel |
| `CsocDataTable` | `components/csoc/csoc-data-table.tsx` | Reusable responsive table |
| `CsocActivityTimeline` | `components/csoc/csoc-activity-timeline.tsx` | Audit activity feed |
| `CsocApiNotice` | `components/csoc/csoc-data-table.tsx` | Pending API placeholder |

### CSOC actions (client)
| Component | Path | API proxy |
|-----------|------|-----------|
| `PostVerifyButton` | `components/csoc/post-verify-button.tsx` | `PATCH /api/csoc/posts/:id/verify` |
| `MembershipActionButton` | `components/csoc/membership-action-button.tsx` | `PATCH /api/csoc/memberships/:id/approve` |

### Reused THE EYE primitives
| Component | Path |
|-----------|------|
| `PageHeader`, `MetricCard`, `Panel`, `StatusBadge` | `components/ui.tsx` |
| `Button`, `FormField`, `TextInput` | `components/form-primitives.tsx` |
| `BroadcastCreateForm` | `components/broadcast-create-form.tsx` |
| `AuditFilter` | `components/audit-filter.tsx` |
| `ThemeSettingsPanel` | `components/theme-settings-panel.tsx` |
| `PlaceholderNotice` | `components/placeholder-notice.tsx` |

### CSOC lib modules
| Module | Path |
|--------|------|
| Navigation config | `lib/csoc/nav.ts` |
| Role access | `lib/csoc/access.ts` |
| Dashboard metrics | `lib/csoc/metrics.ts` |
| Map layer builder | `lib/csoc/map-data.ts` |

---

## 3. Route Map

```
/neighborhood-watch                          → CSOC Dashboard
/neighborhood-watch/map                      → Community Map
/neighborhood-watch/communities              → Communities list
/neighborhood-watch/[id]                     → Community detail
/neighborhood-watch/residents                → Resident management
/neighborhood-watch/approvals                → Pending approvals
/neighborhood-watch/posts                    → Community feed moderation
/neighborhood-watch/incidents                → Incident centre
/neighborhood-watch/verification             → Verification queue
/neighborhood-watch/broadcasts               → Emergency broadcasts
/neighborhood-watch/missing-persons          → Missing persons
/neighborhood-watch/stolen-vehicles          → Stolen vehicles
/neighborhood-watch/patrols                  → Patrol management
/neighborhood-watch/volunteers               → Volunteer network
/neighborhood-watch/chat                     → Community chat
/neighborhood-watch/smartwatch               → Smartwatch console
/neighborhood-watch/live-monitoring          → Live monitoring
/neighborhood-watch/ai-intelligence          → AI intelligence
/neighborhood-watch/analytics                → Analytics
/neighborhood-watch/reports                  → Reports
/neighborhood-watch/audit                    → Audit logs
/neighborhood-watch/settings                 → CSOC settings

BFF routes:
/api/csoc/posts/[postId]/verify              → PATCH → /v1/neighborhood-watch/posts/:id/verify
/api/csoc/memberships/[membershipId]/approve → PATCH → /v1/neighborhood-watch/communities/:id/memberships/:id/approve
```

**Main admin entry:** Sidebar → Neighborhood Watch → CSOC Console (`/neighborhood-watch`)

---

## 4. API Integration Report

### Fully connected (live data)
| Feature | Backend endpoint(s) |
|---------|---------------------|
| Communities | `GET /v1/neighborhood-watch/communities` |
| Community detail | `GET /v1/neighborhood-watch/communities/:id`, `.../feed`, `.../map` |
| Residents / approvals | Memberships embedded in communities response |
| Community posts / feed | `GET /v1/neighborhood-watch/posts`, `.../feed` |
| Post verification | `PATCH /v1/neighborhood-watch/posts/:id/verify` |
| Membership approve | `PATCH /v1/neighborhood-watch/communities/:cid/memberships/:mid/approve` |
| Incidents | `GET /v1/incidents`, `GET /v1/incidents/:id` |
| Broadcasts | `GET/POST /v1/broadcasts` |
| Patrols / volunteers | `GET /v1/neighborhood-watch/communities/:id/map` |
| Smartwatch fleet | `GET /v1/smartwatch/admin/devices` |
| SOS events | `GET /v1/smartwatch/admin/sos-events` |
| Live video | `GET /v1/live-video/sessions/active` |
| Police stations | `GET /v1/police-stations/search` |
| Audit logs | `GET /v1/audit`, `GET /v1/audit/verify-chain` |
| Notifications | `GET /v1/notifications` |
| Auth / session | JWT cookies + `lib/verify-jwt.ts` |

### Partial / placeholder (UI ready, API pending)
| Feature | Missing endpoint |
|---------|------------------|
| Membership reject | No reject PATCH endpoint |
| Community chat messages | Per-channel message load in UI |
| Report PDF/Excel export | `POST /v1/reports/generate` |
| Predictive crime AI | `GET /v1/analytics/crime-prediction` |
| Map: hospitals, safe houses, flood zones | Empty arrays in map API |
| Resident suspend/ban/bulk import | Admin resident CRUD endpoints |

### Security & RBAC
- JWT middleware gates all non-login routes
- CSOC nav filtered by `lib/csoc/access.ts` per admin role
- Jurisdiction scoping enforced server-side on API
- Audit chain verification displayed on audit page
- BFF routes require httpOnly access token cookie

### Role access matrix (CSOC)
| Role | CSOC access |
|------|-------------|
| Super / Country / State / LGA Admin | Full CSOC nav |
| Community Moderator | Full CSOC nav |
| Oversight Auditor | Dashboard, audit, analytics, reports, incidents, verification, posts |
| Call Center Agent | Dashboard, incidents, verification, live monitoring, broadcasts, missing persons, smartwatch, map |
| Police/Security Officer | Dashboard, map, incidents, live monitoring, smartwatch, patrols, verification |
| Agency Admin | Dashboard, map, incidents, verification, live monitoring |

---

## 5. Build Report

| Check | Result |
|-------|--------|
| `apps/admin-web` TypeScript lint | **PASS** |
| `apps/admin-web` `next build` | **PASS** (all 22 CSOC routes compiled) |
| `apps/api` `nest build` | **PASS** |
| Integration tests | **PASS** (111/111) |
| Brand/theme smoke | **PASS** |
| Admin build smoke | **PASS** |

### New files added
- `app/neighborhood-watch/layout.tsx`
- 12 new CSOC route pages (communities, residents, incidents, broadcasts, missing-persons, stolen-vehicles, chat, smartwatch, live-monitoring, ai-intelligence, reports, audit, settings)
- `components/csoc/*` (6 components)
- `lib/csoc/*` (4 modules)
- `app/api/csoc/posts/[postId]/verify/route.ts`
- `app/api/csoc/memberships/[membershipId]/approve/route.ts`

### Preserved
- THE EYE branding, dark-default theme, Montserrat typography
- Existing main admin routes and functionality
- Reused `Panel`, `MetricCard`, `StatusBadge`, form primitives
- No changes to shared design tokens or logo assets

### Access
- **URL:** http://localhost:3000/neighborhood-watch
- **Login:** `dev-admin@theeye.local` / `change_me_dev_admin_password`
- **Requires:** API on port 4000, admin-web on port 3000
