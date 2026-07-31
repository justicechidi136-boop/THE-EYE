# Watch Ownership & Fleet Management — Final Report

## 1. Existing ownership model

Before this work, standalone watches used a **device-centric, single-user model**:

- `SmartwatchDevice.userId` was required; one watch implied one paired user.
- Admin listing (`GET /smartwatch/admin/devices`) loaded up to **100 devices** with no pagination.
- No distinct concepts for organization ownership, inventory stock, departments, or assignment vs ownership.
- Pairing created/updated devices but did **not** append ownership, assignment, or pairing history records.
- No bulk fleet operations, idempotent transfers, or blocked states (lost/stolen/retired).

## 2. New ownership model

Eight lifecycle states are modeled via shared enums in `packages/shared/src/watch-ownership.ts`:

| State | Enum |
|-------|------|
| Unassigned inventory | `UNASSIGNED_INVENTORY` |
| Person owned | `PERSON_OWNED` |
| Organization owned | `ORGANIZATION_OWNED` |
| Org assigned to person | `ORGANIZATION_ASSIGNED_TO_PERSON` |
| Transferred | `TRANSFERRED` |
| Retired | `RETIRED` |
| Lost/stolen | `LOST_OR_STOLEN` |
| Replacement pending | `REPLACEMENT_PENDING` |

Separate append-only / effective-dated entities:

- **Person** — existing `User` + `Profile`
- **Organization** — `WatchOrganization`
- **Department** — `WatchDepartment`
- **Watch device** — extended `SmartwatchDevice` with denormalized current fields
- **Ownership record** — `WatchOwnershipRecord` (`validFrom` / `validTo`)
- **Assignment record** — `WatchAssignmentRecord` (`assignedAt` / `unassignedAt`)
- **Transfer record** — `WatchTransferRecord` (idempotency key, actor, IP, correlation ID)
- **Pairing record** — `WatchPairingHistoryRecord`
- **Inventory location** — `WatchInventoryLocation`
- **Bulk job** — `WatchBulkOperationJob`
- **Audit** — existing `AuditLog` via `AuditService`

Denormalized fields on each device: `currentOwnerType`, `currentOwnerId`, `currentAssigneeId`, `currentOrganizationId`, `currentDepartmentId`, `ownershipStatus`, `assignmentStatus`, `inventoryStatus`.

## 3. Prisma migrations

- `apps/api/prisma/migrations/20260731120000_watch_ownership_fleet/migration.sql`
- Makes `user_id` nullable; adds fleet columns; creates fleet tables; backfills existing paired devices as `PERSON_OWNED`.

## 4. Indexes added

On `smartwatch_devices`: owner type+id, organization, department, assignee, ownership/assignment/inventory status, serial, IMEI, EID, composite owner-status-lastSeen, org-assignment-online.

On history tables: device+validFrom / transferredAt / pairedAt.

On organizations: country/state/lga; bulk jobs: status+createdAt.

## 5. APIs added

Base path: **`/watch-fleet`** (admin, `user:manage`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/owners` | Owner summaries (cursor pagination) |
| GET | `/owners/:ownerType/:ownerId` | Owner detail + histories |
| GET | `/inventory` | Paginated watch inventory + filters |
| GET | `/inventory/unassigned` | Unassigned stock |
| GET | `/organizations/:id/inventory` | Org fleet |
| POST | `/devices/register-inventory` | Register warehouse device |
| POST | `/devices/assign` | Assign to person/org |
| POST | `/devices/transfer` | Transfer ownership (idempotent) |
| POST | `/devices/:id/return-to-inventory` | Return to stock |
| POST | `/devices/:id/lost-or-stolen` | Block reassignment |
| POST | `/devices/:id/restore` | Recover lost device to inventory |
| POST | `/devices/:id/retire` | Retire device |
| GET | `/devices/:id/ownership-history` | Ownership timeline |
| GET | `/devices/:id/assignment-history` | Assignment timeline |
| GET | `/devices/:id/transfer-history` | Transfer timeline |
| POST | `/bulk` | Enqueue bulk operation |
| GET | `/bulk/:jobId` | Job progress |
| POST | `/bulk/:jobId/cancel` | Cancel job |

## 6. Admin pages changed

- **`/devices/smart-watches/fleet`** — Owner summary table; **Total Watches** links to inventory.
- **`/devices/smart-watches/fleet/inventory`** — Server-paginated fleet inventory.
- **`/devices/smart-watches/fleet/owners/[ownerType]/[ownerId]`** — Owner profile, summaries, histories.
- Smartwatch subnav: **Fleet Management** link.

## 7. Assignment workflow

1. Admin calls `POST /watch-fleet/devices/assign` with owner type, IDs, optional department/assignee, reason, idempotency key.
2. Service closes active ownership/assignment records (`validTo` / `unassignedAt`).
3. Appends new ownership + assignment rows.
4. Updates denormalized device fields in a **single transaction**.
5. Writes audit event `watch.device.assigned`.

Citizen pairing (`registerDevice`) sets `PERSON_OWNED` and blocks silent re-pair to a different assignee without transfer.

## 8. Transfer workflow

1. `POST /watch-fleet/devices/transfer` with idempotency key (required).
2. Duplicate key returns existing transfer (safe retry).
3. Creates `WatchTransferRecord`, closes prior ownership, opens new ownership row.
4. Audit: `watch.device.transferred`.

Lost/stolen and retired paths block further assignment via `WATCH_OWNERSHIP_BLOCKED_STATUSES`.

## 9. Inventory workflow

- Register via `register-inventory` → `UNASSIGNED_INVENTORY` + ownership history row.
- Return via `return-to-inventory` (transfer to inventory location).
- Restore recovered devices via `restore` after `LOST_OR_STOLEN`.

## 10. Bulk-operation architecture

- Queue: `WATCH_FLEET_BULK_QUEUE_NAME` (BullMQ), processor `WatchFleetBulkProcessor`.
- Chunk size: **100 devices** per inner loop; progress persisted on `WatchBulkOperationJob`.
- Falls back to **inline processing** when Redis/BullMQ unavailable.
- Supports assign, transfer, mark lost/stolen, retire (extensible enum in shared package).
- Failure rows stored in job metadata (first 500); `failureReportKey` reserved for S3 export.

## 11. Role and privacy controls

- Geography scoping reuses `adminGeographyWhere` (Super → global; Country/State/LGA admins scoped).
- Sensitive fields (phone, email, IMEI, EID) masked unless role is Super/Country/State/LGA/Agency admin.
- Audit access logged for fleet mutations.

## 12. Tests added

- `apps/api/src/modules/watch-fleet/__tests__/watch-ownership.service.spec.ts`
  - Person assignment, org→person assignment, duplicate rejection, lost/stolen block, idempotent transfer, admin gate, IMEI masking.

## 13. Performance findings

- Owner summaries use **Prisma `groupBy`** on indexed `(currentOwnerType, currentOwnerId)` — avoids full-table scans for grouping.
- Per-page stats loaded with a **single batched device query** (`OR` of owner keys) instead of N+1 per owner.
- Inventory uses cursor pagination on `(lastSeenAt, id)` with `take: limit+1`.
- Composite indexes support org+fleet admin filters.

## 14. Remaining scalability risks

| Risk | Mitigation path |
|------|-----------------|
| Owner summary geography filter loads profiles/orgs for each page | Move to materialized owner summary table or SQL aggregation with JOIN |
| `loadOwnerStats` fetches all devices for owners on page | For 1M devices under one owner, use SQL `FILTER` aggregates only (no row fetch) |
| No dedicated export streaming endpoint yet | Add chunked CSV job reusing bulk queue |
| Replacement-pending workflow not fully wired in UI | API enum exists; add admin action + device linking |
| Million-device query plan not load-tested in CI | Run `EXPLAIN ANALYZE` against representative staging volume |

## Completion checklist

- [x] Person can own multiple watches
- [x] Organization can own multiple watches
- [x] Organization-owned watch assignable to person
- [x] Unassigned inventory supported
- [x] Reassignment preserves history (append-only, `validTo`)
- [x] Transfers audited with idempotency
- [x] Server-side pagination on lists
- [x] Bulk actions use queued processing
- [x] Role-based geography restrictions enforced
