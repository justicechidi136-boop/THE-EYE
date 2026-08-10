# Field Device Security

**Project:** THE EYE — Phase 7  
**App:** `apps/field-ops-tablet/`

---

## Threat model

Field tablets operate in hostile environments. Sprint 1 mitigations:

1. **Device-bound authentication** — JWT `typ: "field"` with `fieldDeviceId`, `sessionId`, `tokenVersion`
2. **Ed25519 device keys** — registration/login challenges signed by device private key
3. **Supervisor approval** — no operational tokens while `PendingApproval`
4. **Token version revocation** — revoke/re-pair increments `tokenVersion`, invalidates sessions
5. **Hashed identifiers** — `installationIdHash`, `serialHash`; no raw IMEI/serial stored
6. **Separate session type** — field tokens cannot access unrestricted admin dashboard routes

---

## Android keystore

| Control | Implementation |
|---------|----------------|
| Key generation | Ed25519 via `cryptography` + platform bridge (`device_keystore_service.dart`) |
| Private key storage | Non-exportable where platform supports; never in SharedPreferences |
| Challenge signing | Registration, login, pairing |
| Credential wipe | On revoke/lost/re-pair policy via `secure_session_store.dart` |

---

## Root and debug policy

| Environment | Policy |
|-------------|--------|
| Development | Allow with warning telemetry |
| Staging | Allow approved test devices; report `isRootRiskDetected` |
| Production | Block or restrict per agency policy (server may reject heartbeat/login) |

Signals: root indicators, debugger, emulator, package/signature mismatch. No single signal is absolute proof.

---

## Lost / revoked behaviour

Lost or revoked devices:

- Fail refresh and new login
- Lose operational API access
- Sessions revoked (`fieldDeviceSession.revokedAt`)
- Require explicit re-pairing after recovery
- Minimal audit-safe local state retained on device

---

## Pre-provision QR / short-code pairing

`PairDeviceScreen` (`/pair-device`, `lib/screens/pair_device_screen.dart`)
binds a pre-provisioned device's key pair via a supervisor-issued QR code or
`EYE-XXXX-XXXX` short code — see
[`FIELD_DEVICE_TRANSFER.md`](./FIELD_DEVICE_TRANSFER.md) for the full UX and
[`FIELD_DEVICE_PAIRING.md`](./FIELD_DEVICE_PAIRING.md) for the server
contract. Additive to, and does not weaken, supervisor-token
self-registration.

- **QR is a pointer, never a credential.** `PairingQrPayload` (`lib/pairing/`)
  validates `schemaVersion`/`type: FIELD_DEVICE_PAIRING`/`environment` before
  a single network call is made, but structurally carries no permission,
  role, or activation fields — there is nothing for a malicious or
  malformed QR to grant.
- **Environment-locked.** A pairing QR whose `environment` doesn't match
  this build's `AppFlavor.envName` is rejected client-side, preventing a
  staging code from being scanned into a production install or vice versa.
- **Confirmation, not trust.** The device name/role shown after
  `POST /field/pairing/claim` is a human "is this my tablet?" check only;
  it is never persisted or used for authorization.
- **Same crypto floor as self-registration.** Binding still requires the
  device's local Ed25519 key pair to sign a fresh server-issued challenge
  (`POST /field/pairing/challenge` → `POST /field/pairing/complete`) — a
  captured/replayed QR or short code cannot bind a different physical
  device.
- **Single-use, hashed, rate-limited on the server** (unchanged): see
  `FIELD_DEVICE_PAIRING.md` for token lifecycle and error codes.

## Logging redaction

Never log: passwords, PINs, private keys, refresh tokens, raw hardware IDs, exact routine GPS in audit.

---

## Launcher / kiosk security

- App cannot silently become Device Owner; MDM must provision `FieldDeviceAdminReceiver`.
- Unapproved packages cannot be launched (`ApprovedAppRegistry` + audit).
- Deep links / intents must not expose restricted ops while device is locked/revoked.
- Maintenance escape requires supervisor PIN + audited API event.
- Outside Device Owner mode, Android OS limits apply — see `FIELD_ANDROID_ENTERPRISE_PROVISIONING.md`.

## References

- `apps/api/src/common/auth/field-device-crypto.ts`
- `apps/api/src/modules/field-operations/`
- `apps/field-ops-tablet/lib/security/`
- `docs/FIELD_LAUNCHER_ARCHITECTURE.md`
- `docs/FIELD_KIOSK_MODE.md`
- `docs/FIELD_DEVICE_TRANSFER.md`
- `docs/FIELD_DEVICE_PAIRING.md`
