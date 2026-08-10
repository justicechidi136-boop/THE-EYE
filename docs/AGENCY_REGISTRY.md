# Agency Registry

Authoritative agency records live in the existing Prisma `Agency` model (`agencies` table). There is no second agency table.

## Why

Field Device pre-provisioning and admin dispatch UIs previously had no list API. Operators were forced to paste agency UUIDs. The registry exposes scoped list/detail APIs and admin CRUD so administrators select agencies and units by human labels.

## API

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/v1/agencies` | JWT admin (scoped) |
| GET | `/v1/agencies/:id` | JWT admin (scoped) |
| GET | `/v1/agencies/:id/units` | JWT admin (scoped) |
| GET | `/v1/agencies/:id/capabilities` | JWT admin (scoped) |
| POST/PATCH/activate/deactivate | `/v1/admin/agencies…` | `agency:manage` + geography/agency scope |
| POST/PATCH units | `/v1/admin/agencies/:id/units`, `/v1/admin/agency-units/:unitId` | same |

Filters on list: `countryCode`, `stateCode`, `lgaCode`, `agencyType`, `capability`, `isDispatchable`, `isFieldOperationsEnabled`, `isActive`, `search`.

## Scope

- Super Admin: unscoped
- Country / State / LGA Admin: geography codes on the agency row
- Agency Admin: own agency and direct children (read); cannot create unrelated national agencies

## Field operations

Pre-provisioning requires an active, FO-enabled agency in actor scope. Units must belong to that agency. Operational roles and permission profiles are checked against agency type. Errors use `AGENCY-001`…`AGENCY-009`.

Administrators do not manually enter agency UUIDs in the Field Device wizard.
