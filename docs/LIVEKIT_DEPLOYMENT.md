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
```

Use staging-only keys. Never reuse production LiveKit credentials on staging.

## Validation

```bash
pnpm run test:docker:livekit
```

## Nginx proxy

WebSocket endpoint: `wss://staging-livekit.theeye.com.ng` → `livekit:7880` (see `infra/docker/nginx/snippets/livekit-locations.conf`).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `could not parse keys` | Ensure `LIVEKIT_KEYS` format is `key: secret` with space |
| Duplicate key config | Remove any `keys:` block from `livekit.yaml` |
| Client cannot connect | Verify `NEXT_PUBLIC_LIVEKIT_URL` uses `wss://staging-livekit.theeye.com.ng` (dedicated hostname, not dashboard path) |
