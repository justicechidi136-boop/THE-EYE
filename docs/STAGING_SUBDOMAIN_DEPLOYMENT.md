# Staging Subdomain Deployment — Order of Operations

Safe rollout for THE EYE staging **separated hostnames** architecture. Follow steps **in order**. Do not enable HTTPS-only routing or remove legacy unified dashboard `/v1` proxy until runtime proof passes.

## Canonical URLs

| Service | URL |
|---------|-----|
| Admin dashboard | `https://staging-dashboard8jps.theeye.com.ng` |
| API base | `https://staging-api.theeye.com.ng/v1` |
| LiveKit | `wss://staging-livekit.theeye.com.ng` |

Clients **must** call the API at `staging-api.theeye.com.ng` — **not** the admin dashboard hostname.

Related runbooks: [STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md), [NGINX_TLS_BOOTSTRAP.md](./NGINX_TLS_BOOTSTRAP.md).

---

## Phase 0 — Pre-flight (repo + artifacts)

On your workstation or CI, before touching the VPS:

```bash
git checkout fix/staging-subdomain-architecture   # or merged staging
git pull

# Static nginx template validation (no Docker required for static checks)
node scripts/validate-nginx-config.cjs

# After admin-web build:
pnpm --filter @the-eye/admin-web run build
node scripts/validate-staging-artifacts.cjs --admin-next apps/admin-web/.next

# After mobile/watch staging APK builds (optional paths):
node scripts/validate-staging-artifacts.cjs \
  --mobile-apk apps/mobile/build/app/outputs/flutter-apk/app-staging-release.apk \
  --watch-apk apps/watch/build/app/outputs/flutter-apk/app-staging-debug.apk
```

Artifact rules enforced by `scripts/validate-staging-artifacts.cjs`:

- **MUST contain:** `https://staging-api.theeye.com.ng/v1`
- **MUST NOT contain:** `https://staging-dashboard8jps.theeye.com.ng/v1`, `https://api.theeye.com.ng`, `localhost`, `127.0.0.1`

---

## Phase 1 — DNS confirmation

Confirm **A** (and **AAAA** if used) records for all three hostnames point at the staging VPS **before** nginx or certbot changes.

```bash
# Replace VPS_IP with your DigitalOcean droplet IP (e.g. 134.209.190.77)
VPS_IP="134.209.190.77"

for host in \
  staging-dashboard8jps.theeye.com.ng \
  staging-api.theeye.com.ng \
  staging-livekit.theeye.com.ng
do
  echo "=== $host ==="
  dig +short "$host" A
  dig +short "$host" AAAA
  dig +short "$host" A | grep -qx "$VPS_IP" || echo "WARN: A record mismatch for $host"
done
```

**Gate:** All three hostnames must resolve to the VPS IP. **Do not proceed** if any hostname is missing or points elsewhere.

---

## Phase 2 — HTTP bootstrap nginx

Deploy with **HTTP only**. Do **not** set `THE_EYE_SSL_REDIRECT=true` until DNS is confirmed and certificates are issued.

On the VPS, ensure `.env` includes:

```env
THE_EYE_APP_ENV=staging
THE_EYE_TLS_BOOTSTRAP=auto
THE_EYE_SSL_REDIRECT=false
THE_EYE_GENERATE_DEV_SSL=false
THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
CORS_ORIGINS=https://staging-dashboard8jps.theeye.com.ng
NEXT_PUBLIC_API_BASE_URL=https://staging-api.theeye.com.ng/v1
NEXT_PUBLIC_LIVEKIT_URL=wss://staging-livekit.theeye.com.ng
```

```bash
git pull
docker compose -f infra/docker/docker-compose.yml --env-file .env config
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
```

Verify HTTP health (no TLS yet):

```bash
curl -sf http://staging-dashboard8jps.theeye.com.ng/healthz
curl -sf http://staging-api.theeye.com.ng/healthz
curl -sf http://staging-livekit.theeye.com.ng/healthz
curl -sf http://staging-api.theeye.com.ng/v1/health/ready
```

**Gate:** All four curls must succeed over **HTTP** before ACME.

---

## Phase 3 — ACME challenge reachable

Confirm Let's Encrypt HTTP-01 webroot is reachable **per hostname**:

```bash
for host in \
  staging-dashboard8jps.theeye.com.ng \
  staging-api.theeye.com.ng \
  staging-livekit.theeye.com.ng
do
  echo "=== ACME probe: $host ==="
  curl -sf "http://${host}/.well-known/acme-challenge/" -o /dev/null -w "%{http_code}\n" || true
done
```

During issuance, certbot writes token files; expect `404` on the directory root but **not** connection refused or wrong host.

**Gate:** nginx must answer on port 80 for each `server_name` before running certbot.

---

## Phase 4 — Obtain TLS certificates

### Option A — Single SAN certificate (default)

One cert covering all three hostnames at `infra/docker/nginx/certs/live/fullchain.pem`:

```bash
export THE_EYE_ADMIN_SERVER_NAME=staging-dashboard8jps.theeye.com.ng
export THE_EYE_API_SERVER_NAME=staging-api.theeye.com.ng
export THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
export CERTBOT_EMAIL=ops@example.com
bash scripts/issue-letsencrypt.sh
```

### Option B — Per-hostname certificates

```bash
export THE_EYE_TLS_PER_HOST=true
# ... same hostname vars and CERTBOT_EMAIL ...
bash scripts/issue-letsencrypt.sh
```

Certs land at `infra/docker/nginx/certs/live/<hostname>/fullchain.pem`.

---

## Phase 5 — Verify certificate covers exact hostname

Before enabling HTTPS redirect, inspect each cert:

```bash
# Shared SAN cert
openssl s_client -connect staging-api.theeye.com.ng:443 -servername staging-api.theeye.com.ng </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName

# Repeat for admin and livekit hostnames
openssl s_client -connect staging-dashboard8jps.theeye.com.ng:443 -servername staging-dashboard8jps.theeye.com.ng </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName

openssl s_client -connect staging-livekit.theeye.com.ng:443 -servername staging-livekit.theeye.com.ng </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName
```

**Gate:** Each hostname you will serve over HTTPS must appear in **Subject Alternative Name**. If using per-host certs, verify the cert file path matches the hostname directory.

---

## Phase 6 — Render final HTTPS configs

Set in `.env`:

```env
THE_EYE_SSL_REDIRECT=true
```

Restart nginx so the entrypoint re-renders HTTP + HTTPS blocks:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env restart nginx
```

The entrypoint (`infra/docker/nginx/entrypoint.d/20-render-the-eye-conf.sh`) renders:

| File | Hostname |
|------|----------|
| `10-admin-http.conf` / `20-admin-https.conf` | Admin |
| `11-api-http.conf` / `21-api-https.conf` | API |
| `12-livekit-http.conf` / `22-livekit-https.conf` | LiveKit |

---

## Phase 7 — `nginx -t` (mandatory)

**Never reload nginx without a passing config test.**

```bash
docker compose -f infra/docker/docker-compose.yml exec nginx nginx -t
```

Expected output includes `syntax is ok` and `test is successful`.

If `nginx -t` fails, **stop** — fix rendered configs or cert paths before reload.

---

## Phase 8 — Reload nginx (only after `nginx -t`)

```bash
docker compose -f infra/docker/docker-compose.yml exec nginx nginx -s reload
```

Or restart the container if reload is unavailable:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env restart nginx
```

---

## Phase 9 — Runtime proof (HTTPS)

```bash
# Liveness
curl -sf https://staging-dashboard8jps.theeye.com.ng/healthz
curl -sf https://staging-api.theeye.com.ng/healthz
curl -sf https://staging-livekit.theeye.com.ng/healthz
curl -sf https://staging-api.theeye.com.ng/v1/health/ready

# TLS cert chain (API)
openssl s_client -connect staging-api.theeye.com.ng:443 -servername staging-api.theeye.com.ng </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -issuer -subject

# HTTP → HTTPS redirect (when THE_EYE_SSL_REDIRECT=true)
curl -sI http://staging-api.theeye.com.ng/healthz | grep -i '^location:'
```

### WebSocket (LiveKit)

From a machine with `websocat` or `wscat`:

```bash
# Install: cargo install websocat  OR  npm i -g wscat
websocat -v "wss://staging-livekit.theeye.com.ng/" --text
# Expect TCP+TLS handshake; LiveKit may close immediately without auth — that is OK for proxy proof.
```

Or with `curl` (upgrade probe only):

```bash
curl -sI \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://staging-livekit.theeye.com.ng/
```

Expect `101 Switching Protocols` or a LiveKit-specific response — **not** `502`/`503`.

---

## Phase 10 — Migration gate (keep legacy unified routing)

The admin hostname still proxies `/v1/*` to the API (`DEPRECATED` block in `admin-locations.conf`). **Do not remove** this until **all** of the following are true:

| Check | Command / evidence |
|-------|-------------------|
| API hostname healthy | `curl -sf https://staging-api.theeye.com.ng/v1/health/ready` |
| LiveKit hostname healthy | WebSocket/TLS probe above |
| Admin built with canonical API URL | `node scripts/validate-staging-artifacts.cjs --admin-next apps/admin-web/.next` |
| Mobile staging APK → canonical API | `node scripts/validate-staging-artifacts.cjs --mobile-apk <path>` |
| Watch staging APK → canonical API | `node scripts/validate-staging-artifacts.cjs --watch-apk <path>` |

Only after all rows pass should you remove the `location /v1/` block from `infra/docker/nginx/snippets/admin-locations.conf`, re-run phases 7–8, and redeploy clients.

---

## Rollback — revert to unified routing

If separated hostnames cause production impact, roll back nginx **without** redeploying application code.

### Method A — Git checkout previous nginx snippets (recommended)

On the VPS (or locally, then redeploy):

```bash
# Identify last known-good commit on staging
git log --oneline -5 staging -- infra/docker/nginx/

# Restore unified routing snippet (example — use your known-good SHA)
git checkout <GOOD_SHA> -- \
  infra/docker/nginx/snippets/admin-locations.conf \
  infra/docker/nginx/entrypoint.d/20-render-the-eye-conf.sh \
  infra/docker/nginx/render/

# Re-test and reload
docker compose -f infra/docker/docker-compose.yml exec nginx nginx -t
docker compose -f infra/docker/docker-compose.yml exec nginx nginx -s reload
```

To temporarily restore dashboard `/v1` proxy while keeping per-hostname blocks, ensure `admin-locations.conf` includes the legacy `location /v1/` block (present on `fix/staging-subdomain-architecture`).

### Method B — Disable HTTPS redirect (emergency HTTP)

```env
THE_EYE_SSL_REDIRECT=false
```

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env restart nginx
```

Clients expecting HTTPS will fail — use only for break-glass diagnosis.

### Method C — Full stack rollback

```bash
git checkout staging
git pull
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --force-recreate nginx
```

Document the incident and re-run this runbook from Phase 1 when retrying.

---

## CI integration

Pushes to `staging` run `.github/workflows/validate-staging.yml`, which:

- Validates staging API URL env vars
- Builds admin-web and runs `scripts/validate-staging-artifacts.cjs`
- Builds mobile/watch staging APKs when Firebase secrets are present
- Runs `scripts/validate-nginx-config.cjs` in the docker job

**Merge readiness:** PR must pass **Validate Staging** workflow and receive operator approval before merge to `staging` and VPS deploy.

---

## Quick reference — do / do not

| Do | Do not |
|----|--------|
| Confirm DNS for all 3 hostnames first | Enable `THE_EYE_SSL_REDIRECT=true` before certs exist |
| Run `nginx -t` before every reload | Reload nginx on failed config test |
| Validate client artifacts before cutover | Remove legacy `/v1` on admin hostname until migration gate passes |
| Keep rollback commit SHA noted | Commit `.env`, private keys, or cert PEMs to git |
