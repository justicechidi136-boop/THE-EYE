# Prisma Database Layer

THE EYE uses Prisma for schema ownership and migrations, with custom SQL for PostgreSQL/PostGIS features that Prisma cannot model natively.

## Files

- `schema.prisma`: Prisma models, enums, relationships, and unsupported PostGIS fields.
- `migrations/20260705180000_initial_public_safety_schema/migration.sql`: full initial SQL migration.
- `seed.ts`: development seed data for roles, jurisdiction, agencies, admin user, citizen, incident, evidence, alerts, and reports.

## PostGIS Pattern

Tables that require GPS use `latitude`, `longitude`, and a native `geography(Point,4326)` column:

- `incidents.gps_location`
- `incident_media.gps_location`
- `police_stations.gps_location`
- `sos_events.gps_location`
- optional report-location fields for stolen vehicles and missing persons

Database triggers populate `gps_location` from latitude and longitude before insert/update. GiST indexes support radius and proximity queries.

## Jurisdiction Access

Admins are scoped by `country`, `state`, and `lga`. The SQL helper `can_admin_access_incident(admin_id, incident_id)` returns true only when an active admin and incident share the same jurisdiction scope.

Application services should use this function or equivalent query predicates for every incident read/update.

## Audit

The migration creates row-level audit triggers for operational tables. Application code should set these session variables per request before writes where possible:

```sql
SELECT set_config('app.actor_user_id', '<uuid>', true);
SELECT set_config('app.actor_admin_id', '<uuid>', true);
SELECT set_config('app.request_id', '<request-id>', true);
```

If no actor is set, the audit row is written as `system`.

## Commands

```bash
cd apps/api
npm install
cp prisma/.env.example prisma/.env
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```
