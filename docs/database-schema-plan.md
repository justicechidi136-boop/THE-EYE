# Database Schema Plan

PostgreSQL with PostGIS is the source of truth. The local bootstrap schema is in `infra/docker/postgres/init.sql`; production should use versioned migrations.

## Core Tables

- agencies: police, fire, medical, emergency management, local government, and other responding bodies.
- users: citizens, responders, dispatchers, agency admins, officials, platform admins, and auditors.
- incidents: current incident state, type, priority, location, assignment, reporter, and operational metadata.
- incident_status_events: append-only state transition history for accountability and timeline reconstruction.
- evidence_objects: S3/MinIO object references for photos, videos, audio, documents, and exports.
- broadcasts: geofenced public safety messages and government notices.
- notification_deliveries: delivery attempts across push, SMS, email, and in-app channels.
- audit_logs: append-only security, compliance, and operational trail.

## Geospatial Fields

- `incidents.location`: `geography(Point, 4326)` for nearby incidents, clustering, and responder assignment.
- `agencies.jurisdiction`: `geography(MultiPolygon, 4326)` for jurisdiction lookup and automatic assignment.
- `broadcasts.target_area`: `geography(MultiPolygon, 4326)` for geofenced broadcast fanout.

## Index Strategy

- GiST index on incident location for radius and proximity queries.
- Composite index on incident status and creation time for command-center queues.
- Agency and user foreign key indexes for assignment dashboards.
- Audit indexes by actor, entity, and timestamp.

## Migration Plan

1. Convert `init.sql` into versioned migrations before production.
2. Add seed data for roles, default agencies, and development users.
3. Add monthly partitions for `audit_logs`, `notification_deliveries`, and high-volume event tables.
4. Add retention metadata to evidence and audit tables.
5. Add reporting views that redact citizen PII for analytics.

## Data Retention

- Critical incident records should be retained according to government policy.
- Evidence objects need retention class, legal hold flag, and deletion eligibility.
- Audit logs should be immutable and retained longer than operational records.
