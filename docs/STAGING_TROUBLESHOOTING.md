# Staging Troubleshooting

Quick reference for THE EYE staging VPS (Ubuntu 24.04, Docker Compose).

## API container won't build

**Symptom:** `pnpm: not found` or lockfile errors

**Fix:** Use current `apps/api/Dockerfile` with Corepack + `pnpm install --frozen-lockfile`. Build from repo root. See [DOCKER_BUILD.md](./DOCKER_BUILD.md).

```bash
docker build -f apps/api/Dockerfile --target production -t the-eye-api:test .
```

## LiveKit fails to start

**Symptom:** `could not parse keys` in livekit logs

**Fix:** `LIVEKIT_KEYS` must be `"keyName: secret"` with a **space after colon**. See [LIVEKIT_DEPLOYMENT.md](./LIVEKIT_DEPLOYMENT.md).

```bash
pnpm run test:docker:livekit
docker logs the-eye-livekit 2>&1 | tail -20
```

## Mobile LIVE-VIDEO-015 (unable to join live video room)

**Symptom:** Stage 4 HTTP 201, WSS 101, ICE candidates include VPS public IP, then ~10–12s `SIGNAL_SOURCE_CLOSE` / `could not restart participant`. Mobile shows `MediaConnectException: Timed out waiting for PeerConnection to connect` (LIVE-VIDEO-015).

**Timeline (LiveKit SDK default `connection` timeout = 10s):**

| Phase | Client | Server |
|-------|--------|--------|
| 0–2s | WSS connect + `EngineJoinResponseEvent` | Participant joins signaling |
| 2–10s | ICE / DTLS / primary PeerConnection | Waiting for media |
| ~10s | `MediaConnectException` (LIVE-VIDEO-015) | `SIGNAL_SOURCE_CLOSE`, participant removed |

This is **not** a Flutter parsing bug. The failure is at `EnginePeerStateUpdatedEvent` (ICE never reaches connected). Track publish (`TRACKS_PUBLISHED`) is never reached.

### Stage 5 vs Stage 6 proofs

| Proof | Script | What it validates |
|-------|--------|-------------------|
| **Stage 5** | `staging-live-video-room-join-proof.ts` | HTTP 201, TCP 7881 from VPS, **WSS open only** (closes immediately) |
| **Stage 6** | `staging-live-video-webrtc-media-proof.ts` | Full `Room.connect()` — **PeerConnection / ICE / DTLS** (must run **outside** the VPS) |

Stage 5 passing does **not** prove external clients can complete WebRTC. VPS-to-own-public-IP TCP probes can succeed while phone/laptop ICE still fails.

**Run stage 6 from a developer machine or GitHub Actions runner (not on the VPS):**

```bash
export STAGING_API_BASE_URL=https://staging-api.theeye.com.ng/v1
export STAGING_TEST_CITIZEN_EMAIL=...
export STAGING_TEST_CITIZEN_PASSWORD=...
pnpm --filter @the-eye/api exec tsx scripts/staging-live-video-webrtc-media-proof.ts
```

If stage 6 **fails** externally → RTC path from internet to VPS (UDP 7882, Docker UDP publish, or missing TURN).  
If stage 6 **passes** externally but Android fails → capture mobile logcat (`live_video checkpoint=`) and compare ICE candidates in LiveKit logs during the join.

**TURN:** Staging `livekit.yaml` has **no TURN** configured. Direct host ICE to `LIVEKIT_NODE_IP` must work. TURN is only needed for symmetric NAT once direct path is proven.

**If `staging-livekit-network-guard.sh` passes:** signaling and host port publish are healthy on the VPS. Remaining failures are usually **external client → host RTC media** (UDP 7882 / TCP 7881), not nginx/WSS.

**Checks:**

```bash
# On VPS — listeners (guard already covers this)
ss -lun 'sport = :7882'
ss -ltn 'sport = :7881'

# From OUTSIDE the VPS (phone hotspot or external host) — UDP often blocked in cloud firewall even when localhost passes
nc -vz <VPS_PUBLIC_IP> 7881
# UDP probe: use staging-live-video-room-join-proof or WebRTC ICE test from mobile network

PROOF_ONLY=false bash scripts/deploy-staging-vps-ci.sh   # stage-5 room join proof
```

**Fix:**

```bash
bash scripts/staging-livekit-network-guard.sh
# DigitalOcean/cloud firewall: allow inbound 7881/tcp and 7882/udp to the droplet
# ufw on VPS:
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
```

Ensure `.env` has `LIVEKIT_URL=ws://livekit:7880` and `LIVEKIT_NODE_IP=<vps-public-ipv4>`.

If signaling passes but mobile still drops at ~10s on cellular NAT, plan **TURN** (see LIVEKIT_DEPLOYMENT.md LIVEKIT-RTC-001).

## Mobile LIVE-VIDEO-016 (track is null on second stream)

**Symptom:** First live video attempt succeeds (UDP, audio + video published, participant active). Second attempt without reinstall or re-login fails during publish with `RTCConnection::addTransceiver(): track is null` (LIVE-VIDEO-016). Third+ attempts may degrade to LIVE-VIDEO-015 (`MediaConnectException` / `wait_pc_connection timed out`).

**Server logs (failed retry):** `SIGNAL_SOURCE_CLOSE`, `connectionType = unknown`, no `participant active`, no `mediaTrack published`, `could not restart participant`.

**Cause:** `stop(keepPreview: true)` kept the camera `LocalVideoTrack` that was already published to the prior LiveKit room. The next `connectPublisher` reused that stale track instead of creating a fresh one. WebRTC tracks cannot be republished to a new room without recreation.

**Fix (mobile):** Recreate camera (and fresh audio) at the start of each `connectPublisher` session; refresh the preview track after stop-with-preview.

**Distinguishing from LIVE-VIDEO-015:** If the **first** attempt after fresh install/login succeeds over UDP, the RTC path is working. Retry failures with `track is null` are a **client track lifecycle** issue, not blocked UDP 7882.

## Mobile intermittent live video (client lifecycle)

**Symptom:** Some sessions succeed end-to-end; others fail under identical conditions. Successful sessions may end with `CLIENT_REQUEST_LEAVE`. No consistent auth/token/ICE failure on server.

**Cause (typical):** Overlapping start/stop, stale async cleanup disconnecting a newer `Room`, or camera track reuse between sessions.

**Fix (mobile):** Strict lifecycle state machine, `connectionAttemptId` per start/retry, serialized start/stop via operation lock, owned-room cleanup (`cleanupRoom(oldRoom, oldAttemptId)`), stale-attempt guards after every await. Filter logcat:

```powershell
adb logcat -s flutter | Select-String "connectionAttemptId=|disconnectReason=|lifecyclePhase="
```

**CLIENT_REQUEST_LEAVE callers (instrumented):** `stopSession` / `_stopStream` (`user_stop`), `connectPublisher:preconnect_cleanup` (`retry_replacement`), connect/publish failure cleanup, `safeReconnect`, `LiveVideoSessionController.dispose` (`widget_dispose`), `RoomDisconnectedEvent` (SDK).

## nginx exits on first deploy

**Symptom:** `ERROR: TLS certificates missing`

**Fix:** Use TLS bootstrap — `THE_EYE_TLS_BOOTSTRAP=auto`, `THE_EYE_SSL_REDIRECT=false`. See [NGINX_TLS_BOOTSTRAP.md](./NGINX_TLS_BOOTSTRAP.md).

## Invalid Firebase Identity Token (mobile)

**Symptom:** Mobile staging login fails; API returns 401 on `/v1/auth/exchange`

**Fix:** Ensure API has `FCM_PROJECT_ID=the-eye-2stg` and `FIREBASE_PROJECT_ID=the-eye-2stg`. Rebuild mobile with `--flavor staging`. See [FIREBASE_STAGING_AUTH.md](./FIREBASE_STAGING_AUTH.md).

```bash
docker exec the-eye-api printenv FIREBASE_PROJECT_ID FCM_PROJECT_ID THE_EYE_APP_ENV
```

## Admin login fails after deploy

**Fix:** Run idempotent bootstrap:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env --profile tools run --rm api-create-admin
```

See [ADMIN_BOOTSTRAP.md](./ADMIN_BOOTSTRAP.md).

## Health checks

```bash
curl -sf http://localhost/healthz                    # nginx
curl -sf http://localhost/v1/health/ready            # API (via nginx HTTP bootstrap)
docker compose -f infra/docker/docker-compose.yml ps
```

## Logs

```bash
docker logs the-eye-api --tail 100
docker logs the-eye-nginx --tail 50
docker logs the-eye-livekit --tail 50
```

## Validation scripts

```bash
pnpm run test:docker:smoke
pnpm run test:deploy:env
pnpm run test:docker:livekit
```

## Environment isolation checklist

- [ ] `THE_EYE_APP_ENV=staging`
- [ ] `FCM_PROJECT_ID=the-eye-2stg`
- [ ] `FIREBASE_PROJECT_ID=the-eye-2stg`
- [ ] No `the-eye-29cff` or `the-eye-2pd-d0217` in staging `.env`
- [ ] Staging LiveKit keys (not production)
- [ ] `CORS_ORIGINS` matches staging admin URL
