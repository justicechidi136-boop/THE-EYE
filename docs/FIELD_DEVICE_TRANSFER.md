# Field Device Transfer (Tablet-side Pairing UX)

**App:** `apps/field-ops-tablet/`
**Server contract:** [`FIELD_DEVICE_PAIRING.md`](./FIELD_DEVICE_PAIRING.md) / [`FIELD_DEVICE_PREPROVISIONING.md`](./FIELD_DEVICE_PREPROVISIONING.md)

This document covers the **tablet-side UX** for binding a pre-provisioned
field tablet — i.e. what happens when a supervisor hands an officer a tablet
that already has a `FieldDevice` record (permission profile, operational
role, agency/jurisdiction) but no bound key pair yet. It is the counterpart
to the server-side pairing contract, which is unchanged by this work.

This flow is **additive**. Tablet-initiated self-registration via a
supervisor access token (`DeviceRegistrationScreen`,
`POST /field/devices/register`) continues to work exactly as before — see
[`FIELD_DEVICE_REGISTRATION.md`](./FIELD_DEVICE_REGISTRATION.md).

## When to use which flow

| Scenario | Flow | Screen |
| --- | --- | --- |
| Officer has a supervisor access token and this is a brand-new, un-provisioned device | Self-registration | `DeviceRegistrationScreen` (`/device-registration`) |
| Supervisor already pre-provisioned the device (permission profile, role, agency) in the admin console and issued a QR code / short code | QR/short-code pairing | `PairDeviceScreen` (`/pair-device`) |

`DeviceRegistrationScreen` surfaces a card — *"Handed a pre-provisioned
tablet? Pair it with a QR code or pairing code instead"* — that links to
`/pair-device` without removing or altering the supervisor-token form.

## Entry points

- `FieldRoutes.pairDevice = '/pair-device'` (`lib/screens/routes.dart`)
- Linked from `DeviceRegistrationScreen` via an `OutlinedButton`
  (`"I have a pairing code"`).
- Splash (`SplashScreen`) still boots to `/device-registration` by default
  for devices with no local session/registration; officers reach `/pair-device`
  from there in one tap. Splash itself is unchanged — it has no user
  interaction point to add a second choice to.

## UI: `PairDeviceScreen`

`lib/screens/pair_device_screen.dart`. Two entry methods, one state machine:

1. **Scan QR Code** — live camera preview (`mobile_scanner`), landscape-aware
   (camera + instructions side-by-side on wide screens, stacked on narrow
   ones). Falls back to a clear "camera unavailable" panel with a link to
   manual entry if the camera errors or permission is denied.
2. **Enter Pairing Code** — a formatted `EYE-XXXX-XXXX` text field. An input
   formatter (`PairingShortCode.format`) auto-inserts dashes and uppercases
   as the officer types, so pasting or typing without dashes still works.

### Progress states

`PairingStage` (`lib/screens/pair_device_screen.dart`):

```
idle → scanning ↘
                  claiming → confirming → challenging → completing → success
idle → (manual)  ↗                                                 ↘ failed
```

| Stage | What happens | UI |
| --- | --- | --- |
| `idle` | Choosing scan vs. manual entry | Two option cards / code text field |
| `scanning` | Camera live, waiting for a valid barcode | Camera preview + instructions |
| `claiming` | `POST /field/pairing/claim` | Spinner: "Checking pairing code…" |
| `confirming` | Claim succeeded — show device name/role for officer confirmation | Confirmation card + "Confirm & Pair" |
| `challenging` | Ensure device key pair, `POST /field/pairing/challenge`, sign the nonce locally | Spinner: "Requesting a secure device challenge…" |
| `completing` | `POST /field/pairing/complete` with signature + public key + device metadata | Spinner: "Completing secure pairing…" |
| `success` | Bound; briefly shown, then routes to login or approval-pending | Checkmark |
| `failed` | Any error along the way (invalid/expired/used code, signature failure, network) | Error message + "Try again" |

## QR payload validation

`lib/pairing/pairing_qr_payload.dart` → `PairingQrPayload.parse(raw,
currentEnvironment: AppFlavor.envName)`.

The admin API currently issues a **minimal** envelope (see
`FieldDevicePairingService.issueOrRegenerate`):

```json
{ "v": 1, "t": "<pairingToken>" }
```

The parser also accepts a **richer, forward-compatible envelope** so future
admin tooling can embed more context without a tablet update:

```json
{
  "schemaVersion": 1,
  "type": "FIELD_DEVICE_PAIRING",
  "environment": "staging",
  "pairingToken": "<pairingToken>",
  "shortCode": "EYE-4F7K-92MZ",
  "publicDeviceId": "fd_ab12cd34ef56"
}
```

Validation performed before anything is sent to the server:

- **Schema version** must equal `PairingQrPayload.supportedSchemaVersion` (1).
  Unknown/newer versions are rejected with a clear "update the app" message
  rather than silently mis-parsed.
- **`type`** (when present) must equal `FIELD_DEVICE_PAIRING`. Any other
  value — including a smartwatch or citizen-app QR code accidentally
  scanned — is rejected outright.
- **`environment`** (when present) must case-insensitively match
  `AppFlavor.envName` (`staging` / `production`). This stops a staging
  pairing QR from being scanned into a production build (or vice versa)
  before a single network call is made.
- Malformed JSON, non-object payloads, and missing tokens all fail with a
  short, officer-safe message (never a stack trace).

### Never trust the QR for permissions

The QR/short-code is treated **only** as a pointer to a single-use,
server-side claim ticket:

- `PairingQrPayload` has no field for permissions, roles, or activation
  state — structurally, there is nothing to leak even if a QR generator
  someday added such fields.
- After `claim()`, the server-reported `deviceName` / `operationalRole` are
  displayed **only** as a human confirmation ("is this my tablet?"). They are
  never written to local state or used to make authorization decisions.
- The device's Ed25519 key pair is generated and held locally
  (`DeviceKeystoreService`); only the public key ever leaves the device.
  Binding requires signing a **fresh, server-issued** challenge
  (`POST /field/pairing/challenge` → sign → `POST /field/pairing/complete`),
  so a captured/replayed QR code cannot bind a different physical device.
- The final `registrationStatus` / `preProvisionStatus` /
  `requiresFinalApproval` used to route the officer to `/login` vs.
  `/approval-pending` come **exclusively** from the `complete()` response
  (`FieldPairingCompletion`).

## Short-code normalization

`PairingShortCode` (`lib/pairing/pairing_qr_payload.dart`) mirrors
`packages/shared/src/field-preprovisioning.ts` exactly:

- Alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no `0/O/1/I/L` ambiguity).
- `format()` reformats any loosely-typed/pasted input into `EYE-XXXX-XXXX`
  live, as the officer types.
- `normalize()` trims + uppercases without reformatting (matches the
  server's `normalizeFieldPairingShortCode`, used right before sending).
- `isValid()` checks the same pattern as
  `FIELD_PAIRING_SHORT_CODE_PATTERN` server-side.

## API client wiring

`lib/api/field_api_paths.dart`:

```dart
static const pairingClaim = '/field/pairing/claim';
static const pairingChallenge = '/field/pairing/challenge';
static const pairingComplete = '/field/pairing/complete';
static const pairingStatus = '/field/pairing/status';
```

`lib/pairing/field_pairing_service.dart` (`FieldPairingService`, exposed as
`FieldAppServices.pairing`) wraps `claim` / `requestChallenge` / `complete` /
`status`, matching the DTOs in
`apps/api/src/modules/field-operations/dto/field-device-pairing.dto.ts`.

## QR scanning dependency

`mobile_scanner` (`^7.4.0`) was added to `pubspec.yaml` — no
`qr_code_scanner`/other scanner package was previously present. It was
chosen because:

- It's the actively maintained community-standard Flutter scanner package,
  using CameraX/ML Kit on Android (this app's only target).
- It handles camera permission requests itself and exposes a typed
  `MobileScannerException` for a clean "camera unavailable → fall back to
  manual entry" path (see `_buildScannerError` in `pair_device_screen.dart`).
- Manual code entry is a fully independent, camera-free path — the QR
  scanner is a convenience, never a hard requirement, which matters for
  managed/kiosk tablets where camera access may be policy-restricted.

Android manifest changes (`android/app/src/main/AndroidManifest.xml`):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

`android:required="false"` is deliberate: tablets without a camera (or with
kiosk policy blocking it) must still be able to install and pair via manual
short code.

## Building

No new build flags are required. Standard flavor-aware build commands
continue to apply, e.g.:

```bash
cd apps/field-ops-tablet
flutter pub get
flutter build apk --flavor staging -t lib/main.dart \
  --dart-define=FLUTTER_APP_FLAVOR=staging
```

## Files changed / added

- `lib/screens/routes.dart` — `FieldRoutes.pairDevice`
- `lib/screens/pair_device_screen.dart` — new
- `lib/pairing/pairing_qr_payload.dart` — new
- `lib/pairing/field_pairing_service.dart` — new
- `lib/api/field_api_paths.dart` — pairing endpoint constants
- `lib/services/field_app_services.dart` — wires `FieldPairingService`
- `lib/main.dart` — route registration
- `lib/screens/device_registration_screen.dart` — entry point card (kept
  existing supervisor-token form unchanged)
- `pubspec.yaml` — `mobile_scanner` dependency
- `android/app/src/main/AndroidManifest.xml` — camera permission/features
- `test/pairing_qr_payload_test.dart`, `test/field_pairing_service_test.dart`
