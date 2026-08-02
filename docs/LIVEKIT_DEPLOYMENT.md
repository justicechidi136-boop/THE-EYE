# LiveKit Deployment

LiveKit runs as `livekit/livekit-server:v1.8` on the **the-eye-internal** Docker bridge network. Signaling is reached by nginx and the API via Docker DNS (`livekit:7880`). RTC media ports are **published to the VPS host** for direct client WebRTC.

## Network architecture (staging VPS)

| Component | Network | Signaling | RTC |
|-----------|---------|-----------|-----|
| LiveKit | `the-eye-internal` + published ports | `livekit:7880` (Docker DNS) | `7881/TCP`, `7882/UDP` on host via `ports:` |
| Nginx | bridge (`the-eye-internal` + `the-eye-public`) | proxies to `http://livekit:7880` | not proxied |
| API | bridge (dual-homed) | `LIVEKIT_URL=ws://livekit:7880` | n/a |

**Why not `network_mode: host`?** Host networking was used historically so RTC ports bind on the VPS directly. That is **not required**: explicit `ports:` mappings publish 7880/7881/7882 to the host while keeping signaling on Docker service discovery. The prior `host.docker.internal:7880` hop from nginx caused **502 Bad Gateway** when the host gateway could not reach LiveKit signaling reliably.

See [LIVEKIT_BRIDGE_MIGRATION.md](./LIVEKIT_BRIDGE_MIGRATION.md) for deploy/rollback steps.

## Single source for API keys

Keys are supplied **only** via the `LIVEKIT_KEYS` environment variable in `docker-compose.yml`:

```yaml
LIVEKIT_KEYS: "${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}"
```

**Critical:** LiveKit requires a **space after the colon** (`keyName: secret`). Without the space, the server fails to parse keys at startup.

Do **not** duplicate keys in `livekit.yaml` — port/RTC settings only belong there.

## Staging `.env`

```env
LIVEKIT_API_KEY=<staging-key>
LIVEKIT_API_SECRET=<staging-secret-min-24-chars>
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_NODE_IP=<vps-public-ipv4>
NEXT_PUBLIC_LIVEKIT_URL=wss://staging-livekit.theeye.com.ng
```

Deploy patches `rtc.node_ip` from `LIVEKIT_NODE_IP` (or auto-detect via ipify when unset).

Use staging-only keys. Never reuse production LiveKit credentials on staging.

## Firewall (required for mobile room join)

WebRTC media uses **direct** TCP/UDP to the VPS — not through nginx on 443:

| Port | Protocol | Purpose |
|------|----------|---------|
| 7881 | TCP | LiveKit RTC fallback |
| 7882 | UDP | LiveKit RTC primary |

```bash
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
```

Also allow the same ports in the cloud provider firewall (DigitalOcean).

## Post-deploy guard

After recreate (not restart):

```bash
bash scripts/staging-livekit-network-guard.sh
```

Verifies bridge network membership, published RTC ports, host listeners on 7880/7881/7882, `rtc.node_ip`, **nginx → livekit:7880** connectivity, proxied LiveKit vhost, and `nginx -t`.

## Validation

```bash
pnpm run test:docker:livekit
pnpm run test:docker:smoke
node scripts/validate-nginx-config.cjs
```

On the VPS after deploy:

```bash
bash scripts/staging-smoke-check.sh
# Full WSS room join (stage 5):
docker run --rm --network host --env-file .env \
  -e STAGING_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL}" \
  -e PROOF_TOKEN="<jwt>" -e PROOF_INCIDENT_ID="<uuid>" \
  the-eye-api-tools:local \
  npx tsx scripts/staging-live-video-room-join-proof.ts
```

## Nginx proxy

WebSocket endpoint: `wss://staging-livekit.theeye.com.ng` → `http://livekit:7880` (see `infra/docker/nginx/snippets/livekit-locations.conf`).

## Troubleshooting

| Symptom | Code | Fix |
|---------|------|-----|
| nginx 502 on `/rtc` | LIVEKIT-DOCKER-001 | Run network guard; confirm `docker exec the-eye-nginx wget -q --spider http://livekit:7880` |
| `docker port` empty for 7881/7882 | LIVEKIT-DOCKER-001 | Recreate LiveKit with bridge compose; verify `ports:` in compose config |
| Host sockets missing | LIVEKIT-CONFIG-001 | Check mounted `livekit.yaml`, keys, startup logs |
| ICE candidates use Docker/private IP | LIVEKIT-ICE-001 | Set `LIVEKIT_NODE_IP` to VPS public IPv4 |
| Stage 4 OK, 10–12s SIGNAL_SOURCE_CLOSE | LIVEKIT-DOCKER-001 / ICE | RTC ports not reachable — fix host sockets first |
| Mobile **LIVE-VIDEO-015** | — | Signaling or ICE failure after above fixes |
| Mobile **LIVEKIT-RTC-001** | — | Mobile data / symmetric NAT — deploy TURN |
