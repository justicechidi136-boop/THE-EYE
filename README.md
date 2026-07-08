# THE EYE

THE EYE is a public safety platform for emergency response, crime reporting, accident reporting, broadcast alerts, community safety coordination, and government escalation.

## Stack

- Citizen Mobile App: Flutter
- Admin Dashboard: Next.js + TypeScript
- Backend API: NestJS + TypeScript
- Database: PostgreSQL + PostGIS
- Cache/Queue: Redis + BullMQ
- Storage: MinIO/S3
- Live Video: LiveKit
- Push Notifications: Firebase Cloud Messaging
- Maps: Google Maps or Mapbox
- Containerization: Docker Compose
- Future Scale: Kubernetes-ready

## Structure

```text
apps/mobile
apps/admin-web
apps/api
packages/shared
infra/docker
docs
```

## Start

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
```

## Documentation

- `docs/architecture.md`
- `docs/database-schema-plan.md`
- `docs/api-structure.md`
- `docs/rbac.md`
- `docs/incident-lifecycle.md`
- `docs/notification-architecture.md`
- `docs/audit-log-architecture.md`
- `docs/deployment.md`
- `docs/authentication-rbac.md`
- `docs/incident-reporting.md`
- `docs/incident-verification-engine.md`
- `docs/incident-lifecycle-escalation.md`
