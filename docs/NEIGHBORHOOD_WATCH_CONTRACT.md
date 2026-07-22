# THE EYE — Neighborhood Watch Community Contract (Sprint 5)

**Baseline:** `staging` @ `fe7bb3d`  
**Branch:** `feature/sprint-5-neighborhood-watch`  
**Status:** Phase 2 specification — implementation follows Phase 1 audit

---

## Canonical community model

| Field | Type | Rules |
|-------|------|-------|
| `communityId` | UUID | Server-generated; immutable |
| `name` | string | Required; unique within `(country, state, lga, ward, estate)` scope |
| `description` | string | Optional; max length validated |
| `country` | string | Required; ISO or server enum |
| `state` | string | Required when country requires subdivisions |
| `lga` | string | Required for Nigeria citizen flows |
| `ward` | string | Optional hierarchy |
| `neighborhood` / `estate` / `street` | string | Optional hierarchy levels (`CommunityLevel`) |
| `geofence` | MultiPolygon (EPSG:4326) | Optional; server-validated topology |
| `center` | Point (EPSG:4326) | Required when geofence absent for proximity discovery |
| `visibility` | `Public` \| `Private` | Controls join semantics |
| `membershipType` | derived from visibility | Public → instant join; Private → pending approval |
| `status` | `Active` \| `Archived` \| `Suspended` | Archived/suspended reject new activity |
| `ownerAdmin` | userId | Community creator or assigned CommunityAdmin |
| `moderators` | membership roles | Community Moderator, Estate Admin, etc. |
| `memberCount` | computed | Approved memberships only |
| `rules` | text / JSON | Community rules; versioned on change |
| `emergencyContact` | structured contact | Optional; no raw PII in public responses |
| `jurisdictionId` | UUID | Server-resolved; must match creator/admin scope |
| `createdAt` / `updatedAt` | timestamptz | Audit-backed |

---

## Visibility and join policy

| Visibility | Join behavior | Mobile UX |
|------------|---------------|-----------|
| **Public** | `POST …/join` → `Approved` immediately (if eligible) | “Join” |
| **Private** | `POST …/join` → `Pending`; moderator approves/rejects | “Request access” |
| **Invite-only** (future) | Requires invite token | Not in Sprint 5 unless schema extended |

**Guest policy (citizen mobile):** Discovery may be read-only for guests; join/post/comment/volunteer/patrol actions require authentication. Exact guest read scope is product-approved per endpoint.

---

## Creation policy

| Actor | Allowed action |
|-------|----------------|
| Platform admin (jurisdiction-scoped) | `POST /v1/neighborhood-watch/communities` — creates active community |
| Citizen | `POST /v1/neighborhood-watch/community-requests` (Sprint 5) — pending approval; **no** immediate admin privilege |
| Community moderator | Cannot create top-level communities outside assigned jurisdiction |

**Duplicate detection:** Reject create/request when normalized name + `(country, state, lga, ward, estate)` collides with an active community.

**No hardcoded defaults:** Server must reject client payloads with placeholder geography (e.g. fixed Lagos/Ikeja coordinates) unless user's verified profile jurisdiction matches.

---

## Roles and permissions (Sprint 5 target matrix)

| Role | Post | Comment | React | Join approve | Verify post | Patrol create | Checkpoint | Convert incident | Assign roles |
|------|:----:|:-------:|:-----:|:------------:|:-----------:|:-------------:|:----------:|:----------------:|:------------:|
| Member | Y | Y | Y | N | N | N | N* | N | N |
| Volunteer | Y | Y | Y | N | N | N | Y** | N | N |
| PatrolLead | Y | Y | Y | N | N | Y | Y | N | N |
| Moderator | Y | Y | Y | Y | Y | Y | Y | Y | N |
| CommunityAdmin | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Platform admin | scoped | scoped | scoped | Y | Y | Y | Y | Y | Y |

\* Checkpoint only when assigned to active patrol.  
\*\* Volunteer profile + active patrol assignment required.

Permissions are enforced **server-side** via JWT permissions **and** community membership role checks. DB-stored `CommunityRole.permissions` must align with guards (Sprint 5 gap S5-006).

---

## API response rules (citizen)

Citizen responses **must not** expose:

- Moderator-only notes
- Pending membership PII (phone/email) of other users
- Internal verification signals beyond public status
- Suspended/banned user identifiers

Include for list/detail:

- `membershipStatus` for current user
- `memberCount` (aggregate)
- `activeAlertsCount` (verified + non-expired)
- `latestActivityAt`

---

## Media

Community post media uses the existing evidence presign pipeline with **community-scoped object keys**. No public bucket URLs. MIME/size validation required. Orphan cleanup on failed post create.

**Staging note:** E2E media remains **BLOCKED** until INF-006 (S3/Spaces) verified on staging VPS.

---

## Notifications (Sprint 4 pipeline)

Events enqueue through Sprint 4 notification worker with factual delivery statuses. Sprint 5 adds event types only — no fake “Delivered” without provider or device ack.

| Event | Recipients | Deep link |
|-------|------------|-----------|
| Join request | Community moderators | Admin/moderator approvals |
| Join approved/rejected | Requesting user | Community detail |
| New community alert (verified) | Approved members | `/neighborhood-watch/alerts` |
| Comment reply | Post author | Post detail |
| Patrol assignment | Assigned volunteers | Patrol detail |

Delivery **DEVICE/INFRA QA PENDING** until Sprint 4 runtime verified on staging.

---

## Audit

All state-changing actions write immutable `audit_logs` with actor, communityId, target id, and action code. Required for: create, join, approve/reject, leave, role change, post verify, moderation, patrol lifecycle, incident convert.
