# Drone Operator Management — Deployment & QA

## Migration

Apply additive migration `20260802180000_drone_operator_management` before deploying API.

```bash
cd apps/api
npx prisma migrate deploy
```

## Permissions

New granular permissions under `drone:operator:*` are seeded via shared role definitions in `packages/shared/src/permissions.ts`.

## Staging QA checklist

1. Create test operator (Super Admin)
2. Duplicate detection (operator code, email, phone)
3. Upload licence document via presign → confirm
4. Verify licence (State/Country Admin)
5. Add certification and drone qualification
6. Set availability transitions
7. Assign to mission → accept → preflight
8. Block expired licence / unqualified drone
9. Suspend operator → confirm assignment blocked
10. Reactivate operator
11. State/country jurisdiction restrictions
12. Read-only observer / oversight auditor access
13. Audit trail and sensitive document access logging
14. Clean up test records

## Known limitations (MVP)

- Operator detail mission/safety metrics use assignment aggregates; full flight-time analytics depend on future telemetry integration.
- Emergency preflight override requires `drone:mission:command` and is fully audited.
- Disciplinary documents are restricted to authorised roles server-side.
