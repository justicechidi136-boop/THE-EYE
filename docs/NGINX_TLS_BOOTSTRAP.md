# Nginx TLS Bootstrap

Two-phase TLS deployment avoids the certbot/nginx deadlock on first deploy.

## Problem

nginx previously required TLS certificate files before startup. Certbot needs nginx serving HTTP on port 80 for ACME HTTP-01 validation — a circular dependency.

## Solution

Split nginx config with per-hostname server blocks and HTTP bootstrap mode:

| File | Role |
|------|------|
| `snippets/upstreams.conf` | Shared upstream definitions |
| `snippets/healthz.conf` | Shared `/healthz` (included once per server block) |
| `snippets/admin-locations.conf` | Admin dashboard upstream |
| `snippets/api-locations.conf` | NestJS API `/v1/*` routes |
| `snippets/livekit-locations.conf` | LiveKit WebSocket proxy |
| `render/http.conf.template` | Port 80 — per-hostname server block |
| `render/https.conf.template` | Port 443 — per-hostname TLS server block |

Entrypoint: `infra/docker/nginx/entrypoint.d/20-render-the-eye-conf.sh`

Rendered conf files:

| File | Hostname env var | Upstream |
|------|------------------|----------|
| `10-admin-http.conf` / `20-admin-https.conf` | `THE_EYE_ADMIN_SERVER_NAME` | admin-web |
| `11-api-http.conf` / `21-api-https.conf` | `THE_EYE_API_SERVER_NAME` | api:4000 |
| `12-livekit-http.conf` / `22-livekit-https.conf` | `THE_EYE_LIVEKIT_SERVER_NAME` | livekit:7880 |

## Phase 1 — HTTP bootstrap

```env
THE_EYE_TLS_BOOTSTRAP=auto   # default: HTTP-only when certs missing
THE_EYE_SSL_REDIRECT=false
THE_EYE_GENERATE_DEV_SSL=false
THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
```

Start stack:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d nginx
```

Each hostname serves:

- `GET /healthz` — liveness
- `/.well-known/acme-challenge/` — ACME webroot
- Service-specific proxy (when `THE_EYE_SSL_REDIRECT=false`)

## Phase 2 — Issue certificates

### Option A — Single SAN certificate (default)

One certificate covering all three hostnames, stored at `infra/docker/nginx/certs/live/fullchain.pem`:

```bash
export THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
export THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
export THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
export CERTBOT_EMAIL=ops@example.com
bash scripts/issue-letsencrypt.sh
```

### Option B — Per-hostname certificates

Set `THE_EYE_TLS_PER_HOST=true` before running `issue-letsencrypt.sh`. Certificates are stored at:

```text
infra/docker/nginx/certs/live/<hostname>/fullchain.pem
infra/docker/nginx/certs/live/<hostname>/privkey.pem
```

The entrypoint resolves per-hostname certs first, then falls back to the shared `certs/live/fullchain.pem` path.

## Phase 3 — Enable HTTPS

```env
THE_EYE_SSL_REDIRECT=true
```

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env restart nginx
```

Entrypoint detects certs and renders HTTP + HTTPS blocks for all three hostnames.

## Local dev (self-signed)

```env
THE_EYE_GENERATE_DEV_SSL=true
```

Or: `powershell -File scripts/generate-dev-ssl.ps1 -ServerName localhost`

Self-signed certs are written to the shared `certs/live/` path and used for all hostnames in dev.

## Renewal

```bash
bash scripts/renew-letsencrypt.sh
```

Set `THE_EYE_TLS_PER_HOST=true` in `.env` when using per-hostname certificates.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `THE_EYE_ADMIN_SERVER_NAME` | `THE_EYE_SERVER_NAME` or `localhost` | Admin dashboard `server_name` |
| `THE_EYE_API_SERVER_NAME` | `localhost` | API `server_name` |
| `THE_EYE_LIVEKIT_SERVER_NAME` | `localhost` | LiveKit `server_name` |
| `THE_EYE_SERVER_NAME` | *(legacy)* | Fallback for admin hostname only |
| `THE_EYE_SSL_REDIRECT` | `false` | HTTP → HTTPS redirect |
| `THE_EYE_TLS_BOOTSTRAP` | `auto` | Allow HTTP-only when certs missing |
| `THE_EYE_GENERATE_DEV_SSL` | `false` | Self-signed certs (dev only) |
| `THE_EYE_TLS_PER_HOST` | `false` | Issue separate certs per hostname |

## Legacy unified routing

The admin hostname may still proxy `/v1/*` to the API for migration (marked `DEPRECATED` in `admin-locations.conf`). Clients must use `https://staging-api.theeye.com.ng/v1` — not the dashboard hostname.
