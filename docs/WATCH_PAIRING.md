# THE EYE Watch — Pairing

## Flow

1. Unpaired cold start → `PairingScreen`
2. Watch issues 6-digit code + `deviceId` to API (`issuePairingCode`) with `firebaseEnv`
3. Optional companion phone path via `CompanionProtocol` (stub until Wearable Data Layer wired)
4. Poll `pairingStatus(deviceId)` every 3s until `paired` + `deviceSecret`
5. Store credentials in `SecureCredentialStore`; mark paired in preferences

## Unpair

Wipes secure store + preferences; returns to unpaired phase.

## Isolation

Pairing payload includes `firebaseEnv` so backend can reject cross-env pairing.

## Status

- Unit: pairing state machine tests — **PASS**
- Live backend code exchange — **BACKEND BLOCKED** until staging API + phone companion available
- Companion Data Layer — **PARTIAL** (stub protocol)
