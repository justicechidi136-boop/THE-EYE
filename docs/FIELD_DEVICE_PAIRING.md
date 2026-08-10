# Secure Field Device Pairing (QR / Short Code)

Pairing is how a [pre-provisioned](./FIELD_DEVICE_PREPROVISIONING.md) device
binds its real `publicKey` and `installationIdHash` for the first time,
without ever requiring the officer's tablet to hold an admin bearer token.
It reuses the same challenge/signature infrastructure as tablet-initiated
self-registration (`FieldDevicesService.createRegistrationChallenge` /
`consumeChallenge`, and `verifyFieldDeviceSignature` from
`field-device-crypto`).

## Security model

- **Hash storage only.** `FieldDevicePairingToken` never stores the plaintext
  pairing token or short code — only `tokenHash` / `shortCodeHash`
  (SHA-256). Plaintext exists only in the one-time admin issuance response and
  briefly on the officer's device during the pairing flow. Audit log entries
  never include raw tokens.
- **Single-use.** A token moves through
  `Issued → Claimed → Completed` and cannot be reused once `Completed`,
  `Revoked`, `Failed`, or `Expired`.
- **Rate-limited.** All field-facing pairing endpoints are guarded by
  `RateLimitGuard` with the `fieldPairing` policy
  (`apps/api/src/common/rate-limit/rate-limit.policy.ts`), in addition to a
  per-token `attemptCount` / `maxAttempts` (default 5) cap enforced by
  `FieldDevicePairingService`.
- **Short codes** use a Crockford-like alphabet with no `0/O/1/I/L` ambiguity:
  `EYE-XXXX-XXXX` (`FIELD_PAIRING_SHORT_CODE_PATTERN` in
  `packages/shared/src/field-preprovisioning.ts`).
- **No plaintext admin token required on the device** — the field-side
  endpoints (`POST /field/pairing/*`) are unauthenticated by design (the
  device has no session yet); trust comes entirely from possessing the
  single-use pairing token/short code plus, at completion time, a valid
  device-key signature over a fresh challenge.

## Admin-side: issuing a pairing code

| Method & path | Permission | Notes |
| --- | --- | --- |
| `POST /admin/field-devices/:id/pairing-code` | `field:device:approve` | Issues a token + short code; rate-limited (`fieldPairing`) |
| `POST /admin/field-devices/:id/regenerate-pairing` | `field:device:approve` | Revokes any active token and issues a new one |
| `POST /admin/field-devices/:id/cancel-pairing` | `field:device:approve` | Revokes all active/claimed tokens for the device |

Preconditions enforced by `FieldDevicePairingService.issueOrRegenerate`:

- Device must be `provisioningMode: PreProvisioned`.
- Device must already have a `permissionProfileId` assigned (see
  [`FIELD_PERMISSION_PROFILES.md`](./FIELD_PERMISSION_PROFILES.md)) — you
  cannot pair a device with no defined capabilities.
- Device must not already be bound (`publicKey`/`installationIdHash` both
  `null`) — use `regenerate-pairing` instead if you need to force a re-pair.

Issuing a code moves `preProvisionStatus: Draft → AwaitingPairing` and returns
the plaintext **once**:

```jsonc
{
  "data": {
    "publicDeviceId": "fd_ab12cd34ef56",
    "pairingToken": "9f3a...",           // shown once — store nowhere server-side
    "shortCode": "EYE-4F7K-92MZ",         // shown once
    "expiresAt": "2026-08-10T15:00:00.000Z",
    "qrPayload": "{\"v\":1,\"t\":\"9f3a...\"}"
  }
}
```

`ttlMinutes` is optional (5–1440, default 15).

## Field-side flow

All endpoints are under `POST /field/pairing/*` (unauthenticated,
rate-limited) and accept either `pairingToken` (from the QR payload) or
`shortCode` (typed in manually):

1. **`POST /field/pairing/claim`** — marks the token `Claimed` and returns
   basic device info (`publicDeviceId`, `deviceName`, `operationalRole`) so
   the app can confirm "pairing to the right tablet" before proceeding.
2. **`POST /field/pairing/challenge`** — only valid once `Claimed`; delegates
   to the existing `FieldDevicesService.createRegistrationChallenge()`,
   returning a fresh challenge for the device to sign with its private key.
3. **`POST /field/pairing/complete`** — validates the signed challenge, binds
   the device, and finalizes pairing (see below).
4. **`GET /field/pairing/status`** — returns `{ status, expiresAt,
   attemptsRemaining }` for polling/UI feedback.

### Completing pairing

`FieldDevicePairingService.complete` performs, in order:

1. Re-validates the token is claimable (not expired/used/revoked/rate
   limited) and is `Claimed` — replays produce a clear `TOKEN_ALREADY_USED`
   / `TOKEN_INVALID` error rather than a confusing downstream failure.
2. Requires `publicKey`, `installationIdHash`, `challengeId`, `challenge`,
   and `challengeSignature`.
3. Consumes the challenge via the existing
   `FieldDevicesService.consumeChallenge` (shared with self-registration) —
   a failure here (and any subsequent signature failure) increments the
   token's `attemptCount` and can mark it `Failed` once `maxAttempts` is hit.
4. Verifies the device's signature with `verifyFieldDeviceSignature`
   (`FIELD-DEVICE signature invalid` → `DEVICE_SIGNATURE_INVALID`).
5. Checks `installationIdHash` isn't already bound to a **different** device
   (`DEVICE_ALREADY_BOUND`, `FIELD-PAIR-005`) — this is the duplicate-binding
   guard.
6. Binds `publicKey` / `installationIdHash` (and optional device metadata:
   manufacturer, model, app version, etc.) onto the pre-provisioned device.
7. Resolves activation based on the device's `activationPolicy`:
   - `AutoActivateOnPairing` → `preProvisionStatus: Active`,
     `registrationStatus: Active` immediately.
   - `RequireSupervisorFinalApproval` (default) →
     `preProvisionStatus: AwaitingFinalApproval`, `registrationStatus`
     unchanged (still `PendingApproval`) until a supervisor calls the
     existing `POST /admin/field-devices/:id/approve`.
8. Appends `boundAt` to the device's `authoritySnapshot` (kept, not
   overwritten — the original grant record is preserved).
9. If the device has an `operationalRole`, calls
   `FieldLauncherPolicyService.applyPairingDefaults` to seed a sensible
   launcher policy for that role/mode.
10. Marks the token `Completed` and writes an audit entry
    (`field.device.pairing_claim_completed`) — never logging the raw token.

## Error codes (`FIELD_PAIRING_ERROR_CODES`)

| Code | Meaning |
| --- | --- |
| `FIELD-PAIR-001` `TOKEN_INVALID` | Unknown, revoked, or not-yet-claimed-for-this-step token |
| `FIELD-PAIR-002` `TOKEN_EXPIRED` | Token past its `expiresAt` |
| `FIELD-PAIR-003` `TOKEN_ALREADY_USED` | Token already `Completed` (replay) |
| `FIELD-PAIR-004` `RATE_LIMITED` | Token exceeded `maxAttempts` |
| `FIELD-PAIR-005` `DEVICE_ALREADY_BOUND` | `installationIdHash` already bound to another device, or device already bound |
