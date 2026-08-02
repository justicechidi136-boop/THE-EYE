# Drone Surveillance — Staging Deployment Notes

## Migration

- **Name:** `20260802160000_drone_surveillance`
- **Type:** Additive only (9 new tables, indexes, foreign keys)
- **Run before API use:** `pnpm --filter @the-eye/api exec prisma migrate deploy`

## Rollback limitations

- No automatic down migration. Rollback requires a forward migration to drop drone tables if needed.
- Dropping tables cascades GPS tracks, evidence links, and health snapshots tied to devices/missions.

## Staging deployment order

1. Merge PR into `staging`
2. Deploy API (runs `api-migrate` profile in CI deploy)
3. Deploy admin-web
4. Seed or assign drone roles (`DroneCommander`, `DroneOperator`, `ReadOnlyObserver`) to test accounts

## Known limitations (initial release)

- No drone hardware telemetry ingestion; fleet/GPS/live-video pages may show empty states until devices are registered manually.
- No jurisdiction scoping on list endpoints yet — authorized admins see global drone data.
- Live map uses placeholder positioning, not a live map SDK.
- OversightAuditor nav entry exists but role lacks `drone:read` permission — pages redirect to `/`.

## QA checklist

- [ ] `/sailing-permit` redirects to `/drone-surveillance`
- [ ] All 15 drone admin routes render for Super Admin
- [ ] Launch mission from incident detail creates mission + timeline entry
- [ ] Unauthorized roles receive API 403 on mutations
- [ ] Migration applied on staging DB (`drone_devices` table exists)
