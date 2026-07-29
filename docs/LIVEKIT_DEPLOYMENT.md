# LiveKit Deployment

LiveKit runs as `livekit/livekit-server:v1.8` on the staging VPS using **host networking** so RTC ports bind directly on the VPS.

## Network architecture (staging VPS)

| Component | Mode | Signaling | RTC |
|-----------|------|-----------|-----|
| LiveKit | `network_mode: host` | `0.0.0.0:7880` on host | `7881/TCP`, `7882/UDP` on host |
| Nginx | bridge + `host.docker.internal` | proxies to `http://host.docker.internal:7880` | not proxied |
| API | bridge + `host.docker.internal` | `LIVEKIT_URL=ws://host.docker.internal:7880` | n/a |

**Do not** combine `network_mode: host` with Compose `ports:` mappings. With host networking, `docker port the-eye-livekit` returns nothing — that is expected. Prove RTC with host `ss` and TCP/UDP reachability instead.

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
LIVEKIT_URL=ws://host.docker.internal:7880
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

Verifies host network mode, host listeners on 7880/7881/7882, TCP 7881 connect, `rtc.node_ip`, nginx upstream, and `nginx -t`.

## Validation

```bash
pnpm run test:docker:livekit
pnpm run test:docker:smoke
```

## Nginx proxy

WebSocket endpoint: `wss://staging-livekit.theeye.com.ng` → `http://host.docker.internal:7880` (see `infra/docker/nginx/snippets/livekit-locations.conf`).

## Troubleshooting

| Symptom | Code | Fix |
|---------|------|-----|
| `docker port` empty, 7881 refused | LIVEKIT-DOCKER-001 | Use host networking; recreate container; run network guard |
| Host sockets missing | LIVEKIT-CONFIG-001 | Check mounted `livekit.yaml`, keys, startup logs |
| ICE candidates use Docker/private IP | LIVEKIT-ICE-001 | Set `LIVEKIT_NODE_IP` to VPS public IPv4 |
| Stage 4 OK, 10–12s SIGNAL_SOURCE_CLOSE | LIVEKIT-DOCKER-001 / ICE | RTC ports not reachable — fix host sockets first |
| Mobile **LIVE-VIDEO-015** | — | Signaling or ICE failure after above fixes |
| Mobile **LIVEKIT-RTC-001** | — | Mobile data / symmetric NAT — deploy TURN |
