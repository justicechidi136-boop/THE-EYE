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
