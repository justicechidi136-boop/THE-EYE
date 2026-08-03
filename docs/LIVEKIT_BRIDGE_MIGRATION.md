# LiveKit Bridge Network Migration — Deploy & Rollback

**Date:** 2026-08-02  
**Problem:** Mobile `Room.connect()` to `wss://staging-livekit.theeye.com.ng` returns **502 Bad Gateway**. API token mint succeeds; failure is at the nginx → LiveKit signaling hop.  
**Root cause class:** `network_mode: host` for LiveKit forced nginx (bridge) to proxy via `host.docker.internal:7880`, an unreliable host-gateway path on Linux VPS Docker.  
**Fix:** Move LiveKit onto `the-eye-internal` with Docker DNS upstream `http://livekit:7880`; publish RTC ports to the host via Compose `ports:`.

---

## 1. Is `network_mode: host` required?

**No.** It is a convenience pattern, not a LiveKit requirement.

| Concern | Host network | Bridge + published ports |
|---------|--------------|--------------------------|
| Signaling (7880) | Host bind | `livekit:7880` on Docker network; nginx/API use service discovery |
| RTC TCP (7881) | Host bind | `7881:7881` published to VPS |
| RTC UDP (7882) | Host bind | `7882:7882/udp` published to VPS |
| ICE `node_ip` | Public VPS IP in `livekit.yaml` | Same — unchanged |
| Client WSS URL | `wss://staging-livekit.theeye.com.ng` | Same — unchanged |
| Docker networks | Host only | **`the-eye-internal` + `the-eye-public`** — public network required for port publish |

Dev compose already used `ws://livekit:7880` successfully. Production/staging should match.

**Important:** Do **not** attach LiveKit only to `the-eye-internal`. That network is `internal: true`; Docker will ignore `ports:` mappings (empty `NetworkSettings.Ports`, no host listeners) even when `PortBindings` appear in inspect output.

**List `the-eye-public` first** in LiveKit `networks:` — when the primary network is internal-only, Docker may attach only `the-eye-internal` and leave `NetworkSettings.Ports` null even though `HostConfig.PortBindings` is populated.

**Keep host mode only if** bridge UDP publish fails on your VPS kernel (rare). Rollback procedure below restores host mode.

### Symptom: `LIVEKIT-DOCKER-001` with PortBindings set but Ports null

| Observation | Meaning |
|-------------|---------|
| `docker compose config` shows both networks + `ports:` | Compose file is correct |
| `HostConfig.PortBindings` populated | Create spec requested publish |
| Container on `the-eye_the-eye-internal` only | Runtime attach failed / primary network internal |
| `NetworkSettings.Ports` null, `docker port` empty | docker-proxy never bound host ports |

**Repair on VPS (no full redeploy):**

```bash
cd /path/to/the-eye
git pull   # includes network-order + repair script
bash scripts/repair-livekit-network-publish.sh
```

If networking already passes but `LIVEKIT-ICE-001` fails (host `livekit.yaml` never patched):

```bash
bash scripts/repair-livekit-node-ip.sh
```

Or manually:

```bash
docker rm -f the-eye-livekit
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --force-recreate --no-deps livekit
bash scripts/staging-livekit-network-guard.sh
```

---

## 2. Architecture (after migration)

```
Mobile / Admin
    │
    ├─ wss://staging-livekit.theeye.com.ng/rtc ──► nginx:443 (the-eye-internal)
    │                                                  │
    │                                                  ▼
    │                                         http://livekit:7880  (Docker DNS)
    │                                                  │
    │                                                  ▼
    │                                         the-eye-livekit (bridge)
    │
    └─ WebRTC media (direct, NOT via nginx)
              │
              ▼
       VPS public IP:7881/TCP, :7882/UDP  (Compose port publish)

API (bridge) ── ws://livekit:7880 ──► token mint
              returns wss://staging-livekit.theeye.com.ng to clients
```

---

## 3. Files changed

| File | Change |
|------|--------|
| `infra/docker/docker-compose.yml` | Remove `network_mode: host`; add `networks: [the-eye-internal, the-eye-public]` + `ports:` for 7880/7881/7882 |
| `infra/docker/nginx/snippets/livekit-locations.conf` | `http://livekit:7880` |
| `infra/docker/nginx/snippets/upstreams.conf` | `livekit:7880 resolve` |
| `scripts/staging-livekit-network-guard.sh` | Bridge checks + nginx→livekit probe |
| `.env.example`, `apps/api/.env.staging.example` | `LIVEKIT_URL=ws://livekit:7880` |
| `docs/LIVEKIT_DEPLOYMENT.md` | Updated architecture |

---

## 4. Deployment plan (staging VPS)

### Pre-flight

```bash
cd /path/to/the-eye
git fetch && git checkout <branch-with-migration>
```

Verify `.env`:

```env
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_NODE_IP=<vps-public-ipv4>
NEXT_PUBLIC_LIVEKIT_URL=wss://staging-livekit.theeye.com.ng
THE_EYE_LIVEKIT_SERVER_NAME=staging-livekit.theeye.com.ng
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Remove stale override if present:

```env
# DELETE or update if still set:
# LIVEKIT_URL=ws://host.docker.internal:7880
```

### Step 1 — Patch node IP (unchanged)

```bash
bash scripts/deploy-staging-vps-ci.sh   # includes patch_livekit_node_ip
# Or manually:
grep node_ip infra/docker/livekit/livekit.yaml
```

### Step 2 — Recreate LiveKit (force, not restart)

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env config | grep -A 25 '^  livekit:'
docker compose -f infra/docker/docker-compose.yml --env-file .env rm -sf livekit
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --force-recreate livekit
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --wait livekit
```

Expect:

```bash
docker inspect the-eye-livekit --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# Expected: the-eye_the-eye-public the-eye_the-eye-internal (public first in compose)

docker port the-eye-livekit 7880/tcp   # -> 0.0.0.0:7880
docker port the-eye-livekit 7881/tcp   # -> 0.0.0.0:7881
docker port the-eye-livekit 7882/udp   # -> 0.0.0.0:7882
docker inspect the-eye-livekit --format '{{.HostConfig.NetworkMode}}'  # NOT "host"
```

### Step 3 — Recreate API + nginx (pick up env + upstream)

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --force-recreate api nginx
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --wait api nginx livekit
bash scripts/reload-nginx-upstreams.sh
```

### Step 4 — Validate

```bash
bash scripts/staging-livekit-network-guard.sh   # must exit 0
bash scripts/staging-smoke-check.sh

# Direct upstream from nginx container:
docker exec the-eye-nginx wget -q --spider http://livekit:7880 && echo OK

# Proxied vhost:
curl -sv -H "Host: staging-livekit.theeye.com.ng" https://127.0.0.1/ 2>&1 | head -20
```

### Step 5 — End-to-end room join proof

Run full deploy proof (or proof-only):

```bash
PROOF_ONLY=true bash scripts/deploy-staging-vps-ci.sh
```

Or manually:

```bash
docker run --rm --network host --env-file .env \
  -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
  -e PROOF_TOKEN="<staging-jwt>" \
  -e PROOF_INCIDENT_ID="<incident-uuid>" \
  -e LIVEKIT_NODE_IP="${LIVEKIT_NODE_IP}" \
  the-eye-api-tools:local \
  npx tsx scripts/staging-live-video-room-join-proof.ts
```

**Pass criteria:**

- `PASS nginx -> livekit:7880 direct upstream reachable`
- `PASS LiveKit WSS connected` (room join proof)
- Mobile `Room.connect()` no longer returns 502

### Step 6 — Mobile device verification

1. Start live video on staging mobile APK.
2. Confirm checkpoints reach `ROOM_CONNECT_SUCCESS` (not `ROOM_CONNECT_EXCEPTION` with 502).
3. Confirm LiveKit server logs show room join for the incident room name.

---

## 5. Rollback plan (restore host networking)

Use if bridge UDP publish fails or an unexpected regression appears.

### Step 1 — Revert compose/nginx to previous commit

```bash
git checkout HEAD~1 -- \
  infra/docker/docker-compose.yml \
  infra/docker/nginx/snippets/livekit-locations.conf \
  infra/docker/nginx/snippets/upstreams.conf \
  scripts/staging-livekit-network-guard.sh
```

Or restore `network_mode: host` manually and `host.docker.internal:7880` upstream.

### Step 2 — Update `.env`

```env
LIVEKIT_URL=ws://host.docker.internal:7880
```

### Step 3 — Recreate stack

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env rm -sf livekit
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d --force-recreate livekit api nginx
bash scripts/reload-nginx-upstreams.sh
```

### Step 4 — Fix host-gateway path (minimum fix if staying on host mode)

If rollback still shows 502, the host-mode failure is likely:

1. LiveKit not listening on `0.0.0.0:7880` — check `bind_addresses` in `livekit.yaml`
2. `host.docker.internal` not resolving in nginx — verify `extra_hosts: host.docker.internal:host-gateway` on nginx
3. Host firewall blocking docker0 → host:7880 — allow from `172.16.0.0/12` to port 7880 or migrate to bridge (preferred)

```bash
docker exec the-eye-nginx getent hosts host.docker.internal
docker exec the-eye-nginx wget -q --spider http://host.docker.internal:7880
ss -ltn 'sport = :7880'
```

---

## 6. CI / local validation (no VPS)

```bash
pnpm run test:docker:smoke
pnpm run test:docker:livekit
node scripts/validate-nginx-config.cjs
```

These assert compose markers, nginx upstream `livekit:7880`, and LiveKit key format without a running stack.

---

## 7. Risk matrix

| Risk | Mitigation |
|------|------------|
| Brief signaling outage during recreate | Deploy in maintenance window; recreate livekit before nginx |
| RTC UDP blocked after bridge migrate | Network guard checks `docker port 7882/udp` + host UDP listener |
| Stale `.env` with `host.docker.internal` | Update `LIVEKIT_URL=ws://livekit:7880`; recreate API |
| Cloudflare 502 masking origin failure | Test with `curl -H Host: ... https://127.0.0.1/` on VPS first |

---

## 8. Success checklist

- [ ] `bash scripts/staging-livekit-network-guard.sh` exits 0
- [ ] `docker exec the-eye-nginx wget -q --spider http://livekit:7880` succeeds
- [ ] `curl -H "Host: staging-livekit.theeye.com.ng" https://127.0.0.1/` not 502
- [ ] Room join proof script: WSS connect PASS
- [ ] Mobile device: `Room.connect()` succeeds; no LIVE-VIDEO-015 / 502
