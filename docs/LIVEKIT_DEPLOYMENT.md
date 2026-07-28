# LiveKit Deployment

LiveKit runs as `livekit/livekit-server:v1.8` in Docker Compose with config at `infra/docker/livekit/livekit.yaml`.

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
NEXT_PUBLIC_LIVEKIT_URL=wss://staging-livekit.theeye.com.ng
# Optional: pin RTC candidate IP (otherwise auto-detected at deploy)
#LIVEKIT_NODE_IP=<vps-public-ipv4>
```

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

`rtc.use_external_ip` stays **false** for stable Docker startup. The staging deploy script patches `rtc.node_ip` to the VPS public IPv4 (from `LIVEKIT_NODE_IP` or auto-detect via ipify) so mobile clients receive reachable ICE candidates.

## Validation

```bash
pnpm run test:docker:livekit
```

## Nginx proxy

WebSocket endpoint: `wss://staging-livekit.theeye.com.ng` → `livekit:7880` (see `infra/docker/nginx/snippets/livekit-locations.conf`).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Docker `unhealthy` but LiveKit works | Healthcheck probes `http://127.0.0.1:7880` (returns `OK`); recreate the container after compose changes |
| `could not parse keys` | Ensure `LIVEKIT_KEYS` format is `key: secret` with space |
| Duplicate key config | Remove any `keys:` block from `livekit.yaml` |
| Client cannot connect | Verify `NEXT_PUBLIC_LIVEKIT_URL` uses `wss://staging-livekit.theeye.com.ng` (dedicated hostname, not dashboard path) |
| Mobile **LIVE-VIDEO-015** (room join) | Stage 4 OK but LiveKit connect fails — ensure deploy set `rtc.node_ip`, UDP **7882** and TCP **7881** open on VPS; optionally set `LIVEKIT_NODE_IP` |
| Mobile **LIVEKIT-RTC-001** (after join) | ICE/NAT on mobile data — consider TURN for production |
