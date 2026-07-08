# Deployment Notes

Local development uses Docker Compose. Production should deploy stateless app containers separately from persistent infrastructure.

## Local Ports

- Admin web: `http://localhost:3000`
- API: `http://localhost:4000`
- API docs: `http://localhost:4000/docs`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`
- LiveKit: `ws://localhost:7880`

## Local Startup

```bash
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
```

## Production Topology

- API deployment for HTTP traffic.
- Worker deployment for BullMQ processors.
- Admin web deployment for the command dashboard.
- Managed PostgreSQL with PostGIS.
- Managed Redis or Redis-compatible service.
- S3-compatible object storage with lifecycle and retention policies.
- LiveKit managed service or dedicated media cluster.
- Secret manager for credentials and provider keys.

## Kubernetes Readiness

- Health endpoints for API and admin web.
- Separate readiness and liveness probes.
- Horizontal scaling for API, web, and workers.
- Pod disruption budgets for critical services.
- Resource requests and limits.
- Ingress with TLS.
- Central logs, metrics, and tracing.

## Backup and Recovery

- Point-in-time recovery for PostgreSQL.
- S3 object versioning for evidence buckets.
- Redis persistence for local development only; production queues should tolerate replay.
- Regular restore drills for database and evidence metadata.
