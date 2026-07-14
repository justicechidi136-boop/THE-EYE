# THE EYE Watch — SOS

## Hold → countdown → submit

1. User holds SOS (~3s) with haptic pulses
2. Countdown (3s) — **cancel stops the countdown timer** (audit fix)
3. Submit payload: device credentials, GPS sample, connectivity mode, emergency mode, idempotency key
4. On success: emergency GPS tracking (5s interval) + active emergency UI
5. Offline / API failure: enqueue `OfflineEvent` and surface queued state

## Offline queue

- Persisted in preferences as JSON
- Manual flush: Connection Status → “Flush Offline Queue”
- Auto flush: when connectivity monitoring detects online after offline (audit fix)

## Tests

- Hold cancel — **PASS**
- Countdown cancel prevents submit — **PASS**
- Offline enqueue — **PASS**
- Live SOS against staging API — **BACKEND BLOCKED**
- Real GPS on hardware — **HARDWARE BLOCKED** / emulator limited
