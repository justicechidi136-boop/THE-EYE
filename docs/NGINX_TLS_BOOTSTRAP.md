# Nginx TLS Bootstrap

Two-phase TLS deployment avoids the certbot/nginx deadlock on first deploy.

## Problem

nginx previously required TLS certificate files before startup. Certbot needs nginx serving HTTP on port 80 for ACME HTTP-01 validation — a circular dependency.

## Solution

Split nginx config with HTTP bootstrap mode:

| File | Role |
|------|------|
| `snippets/upstreams.conf` | Shared upstream definitions |
| `render/http.conf.template` | Port 80 — health, ACME, optional proxy |
| `render/https.conf.template` | Port 443 — TLS (rendered only when certs exist) |
| `snippets/the-eye-locations.conf` | Shared location blocks (API, admin, LiveKit) |

Entrypoint: `infra/docker/nginx/entrypoint.d/20-render-the-eye-conf.sh`

## Phase 1 — HTTP bootstrap

```env
THE_EYE_TLS_BOOTSTRAP=auto   # default: HTTP-only when certs missing
THE_EYE_SSL_REDIRECT=false
THE_EYE_GENERATE_DEV_SSL=false
```

Start stack:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d nginx
```

nginx serves:

- `GET /healthz` — liveness
- `/.well-known/acme-challenge/` — ACME webroot
- Optional HTTP proxy to API/admin when `THE_EYE_SSL_REDIRECT=false`

## Phase 2 — Issue certificates

```bash
export THE_EYE_SERVER_NAME=staging-admin.theeye.com.ng
export CERTBOT_EMAIL=ops@example.com
bash scripts/issue-letsencrypt.sh
```

Script ensures nginx is up, runs certbot, copies certs to `infra/docker/nginx/certs/live/`.

## Phase 3 — Enable HTTPS

```env
THE_EYE_SSL_REDIRECT=true
```

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env restart nginx
```

Entrypoint detects certs and renders both `10-http.conf` and `20-https.conf`.

## Local dev (self-signed)

```env
THE_EYE_GENERATE_DEV_SSL=true
```

Or: `powershell -File scripts/generate-dev-ssl.ps1 -ServerName localhost`

## Renewal

```bash
bash scripts/renew-letsencrypt.sh
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `THE_EYE_SERVER_NAME` | `localhost` | nginx `server_name` |
| `THE_EYE_SSL_REDIRECT` | `false` | HTTP → HTTPS redirect |
| `THE_EYE_TLS_BOOTSTRAP` | `auto` | Allow HTTP-only when certs missing |
| `THE_EYE_GENERATE_DEV_SSL` | `false` | Self-signed certs (dev only) |
