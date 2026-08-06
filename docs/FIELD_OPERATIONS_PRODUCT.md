# THE EYE Field Operations — Product Boundary

**Phase:** 7  
**Product:** THE EYE Field Operations (tablet)  
**Audience:** Patrol teams, checkpoints, responders, agency supervisors, authorised drone operators  
**Not audience:** Citizens, Super Admin infrastructure operators (default)

---

## Purpose

THE EYE Field Operations is a **dedicated 10-inch Android tablet operational console** for authorised field personnel. It is not a replacement for:

- The **citizen mobile app** (`apps/mobile`)
- The **full admin web dashboard** (`apps/admin-web`)
- **Wear OS SOS devices** (`apps/watch`)

---

## Allowed capabilities

| Domain | Allowed actions |
|--------|-----------------|
| **Incidents** | View assigned / jurisdiction-scoped incidents; accept/reject assignments; update responder status; add field evidence; create official field reports |
| **Communication** | Read/send incident-scoped messages (text, voice, photo, video); quick replies; ETA; information requests (role-gated) |
| **Navigation** | Launch external maps to incident GPS; operational map layers (authorised only) |
| **Patrol** | Start/end agency patrol; zone tracking; team identity; shift summary |
| **Checkpoint** | Start/end checkpoint; vehicle/person checks where lawful; BOLO/broadcast search; operational sightings |
| **Broadcasts** | View active public-safety broadcasts; filter by jurisdiction; submit **private** operational sightings |
| **Backup** | Request backup (immediate, medical, fire, armed, traffic, supervisor, tow, drone) |
| **Drone** | View authorised missions (read-only for most roles); limited control for `DroneOperator` / commanders per policy |
| **Team** | View team/device status within unit; shift join/leave where permitted |
| **Offline** | Cache assignments, broadcasts, drafts; queue mutations with explicit sync state |

---

## Forbidden capabilities

The field tablet must **never** expose:

| Category | Forbidden |
|----------|-----------|
| **Identity admin** | Create unrestricted admins; global user management |
| **Infrastructure** | Firebase configuration; server configuration; secret management; production feature flags |
| **Data governance** | Bulk national exports; audit deletion; unrestricted cross-jurisdiction search |
| **Platform admin** | Super Admin dashboard functions (unless explicit break-glass field session policy) |
| **Citizen flows** | Community verification voting; citizen incident reporting UX; social auth as primary identity |
| **Public leakage** | Operational sightings as public comments; automatic public exposure of all field reports |

---

## Enforcement layers

1. **Navigation** — Operational routes only; no admin settings tree.
2. **API** — Server-side permission + jurisdiction + assignment guards; 404 for out-of-scope resources.
3. **Roles** — Mapped operational roles (see architecture doc); no permission inference from visible buttons alone.
4. **Tests** — Negative tests for forbidden actions per role.
5. **Audit** — Every allowed action logged; forbidden attempts logged where detectable.

---

## Operational roles (Phase 3 target)

| Role | Primary use |
|------|-------------|
| PatrolOfficer | Patrol mode, assignments, checkpoint assist |
| PatrolTeamLead | Patrol command, team status, backup |
| CheckpointOfficer | Checkpoint mode, BOLO search, sightings |
| CheckpointCommander | Checkpoint oversight, backup, incident create |
| Dispatcher | Assignments oversight (limited tablet view) |
| AgencySupervisor | Shift approval, device approval, reassignment |
| EmergencyResponder | Assignment workflow, incident workspace |
| DroneOperator | Drone mission view (control per policy) |
| ReadOnlyObserver | Read-only operational picture |

**Mapping note:** Initial release maps these to existing `AdminRoleName` + `Responder` profiles until dedicated field roles are seeded.

---

## UX principles

- Landscape-first; portrait fallback
- Minimum 48–56 dp touch targets; glove-friendly
- Dark mode default; orange interactive accents on dark surfaces
- Icons + text labels on all primary actions
- Reduced menu depth (nav rail + workspace)
- Clear sync/offline/stale-data labels
- No stretching of phone layouts

---

## Related documents

- `docs/FIELD_OPERATIONS_ARCHITECTURE.md`
- `docs/FIELD_DEVICE_SECURITY.md` (Phase 22)
- `docs/PATROL_MODE.md` (Phase 8)
- `docs/CHECKPOINT_MODE.md` (Phase 9)
