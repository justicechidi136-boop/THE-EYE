# Field Device Activation QA — QR / Short-Code Pairing

**App:** `apps/field-ops-tablet/`
**Related:** [`FIELD_DEVICE_TRANSFER.md`](./FIELD_DEVICE_TRANSFER.md),
[`FIELD_DEVICE_PAIRING.md`](./FIELD_DEVICE_PAIRING.md),
[`FIELD_DEVICE_PREPROVISIONING.md`](./FIELD_DEVICE_PREPROVISIONING.md)

Manual QA checklist for the tablet-side pairing UX
(`PairDeviceScreen`, route `/pair-device`). Run this against a staging
backend with a real (or emulator) Android device before shipping pairing
changes.

## Preconditions

1. A supervisor account with `field:device:approve` permission on the admin
   console/API.
2. A pre-provisioned `FieldDevice`:
   - `POST /admin/field-devices/preprovision` with a valid
     `permissionProfileId` and `operationalRole`.
   - `POST /admin/field-devices/:id/pairing-code` to obtain
     `{ pairingToken, shortCode, qrPayload, expiresAt }`. Note the plaintext
     — it is shown only once.
3. A staging build of the field-ops tablet app installed on a physical
   device or emulator with a working (or emulated) camera:

   ```bash
   cd apps/field-ops-tablet
   flutter pub get
   flutter build apk --flavor staging -t lib/main.dart \
     --dart-define=FLUTTER_APP_FLAVOR=staging
   ```

   Or for iteration: `flutter run --flavor staging -t lib/main.dart
   --dart-define=FLUTTER_APP_FLAVOR=staging`.
4. To generate a scannable QR image from the raw `qrPayload` JSON string
   (any QR generator works, e.g. `qrencode -o pairing.png '<qrPayload>'` or
   an online QR generator — never paste the plaintext token anywhere
   persistent).

## Test matrix

### 1. Happy path — QR scan, auto-activate

- [ ] Pre-provision a device with `activationPolicy: AutoActivateOnPairing`.
- [ ] Fresh app install → Splash → Device registration screen.
- [ ] Tap **"I have a pairing code"** → `/pair-device` opens, chooser shown.
- [ ] Tap **Scan QR Code** → camera permission prompt appears (first run) →
      grant it → live preview shown.
- [ ] Point camera at the generated QR → screen automatically advances to
      **"Checking pairing code…"** without further taps.
- [ ] Confirmation card shows the correct device name and operational role.
- [ ] Tap **Confirm & Pair** → progresses through "Requesting a secure
      device challenge…" → "Completing secure pairing…" → success checkmark.
- [ ] App auto-navigates to the officer sign-in screen (`/login`) within ~1.5s.
- [ ] In the admin console, the device now shows `registrationStatus: Active`,
      `preProvisionStatus: Active`, and a bound `publicKey`/`installationIdHash`.

### 2. Happy path — manual short code, requires approval

- [ ] Pre-provision a device with the default
      `activationPolicy: RequireSupervisorFinalApproval`.
- [ ] From the pairing chooser, tap **Enter Pairing Code**.
- [ ] Type the code **without** dashes or in lowercase (e.g.
      `eye4f7k92mz`) — confirm the field auto-formats to `EYE-4F7K-92MZ` as
      you type.
- [ ] Tap **Continue** with an incomplete code → inline validation error,
      no network call made.
- [ ] Complete the code and tap **Continue** → same claim/confirm/challenge/
      complete progression as the QR path.
- [ ] On success, app navigates to **Approval pending** (`/approval-pending`),
      not `/login`.
- [ ] In the admin console: `preProvisionStatus: AwaitingFinalApproval`,
      `registrationStatus` still `PendingApproval`.
- [ ] Approve the device via `POST /admin/field-devices/:id/approve` → the
      pending-approval screen's poll picks it up and routes to `/login`
      (existing `ApprovalPendingScreen` behavior, unchanged by this work).

### 3. QR validation — malformed / wrong app

- [ ] Scan an arbitrary non-JSON QR code (e.g. a URL) → error: *"This QR
      code is not a THE EYE field pairing code."* — no network call made.
- [ ] Scan a JSON QR with `{"v":2,"t":"..."}` → error mentions an
      unsupported version.
- [ ] Scan a rich-envelope QR with `"type":"SOMETHING_ELSE"` → error: *"This
      QR code is not a field device pairing code."*
- [ ] Scan a rich-envelope QR with `"environment":"production"` while
      running the **staging** flavor → error explicitly names both
      environments and instructs installing the matching build. No claim
      call is made.
- [ ] Confirm none of the above malformed-QR cases ever reach
      `POST /field/pairing/claim` (check API/audit logs — no attempt should
      be recorded for structurally invalid payloads).

### 4. Server-side rejections surface clearly

For each, confirm the tablet shows the failed-state screen with a clear,
non-technical message (not a raw stack trace or HTTP status):

- [ ] **Expired token** (`FIELD-PAIR-002`) — wait past `expiresAt`, or set a
      short `ttlMinutes` when issuing → *"Pairing code expired"*.
- [ ] **Already used** (`FIELD-PAIR-003`) — pair once successfully, then
      retry the same code → *"Pairing code already used"*.
- [ ] **Invalid/unknown code** (`FIELD-PAIR-001`) — type a code that was
      never issued → *"Invalid pairing code"*.
- [ ] **Rate limited** (`FIELD-PAIR-004`) — deliberately submit a wrong
      short code 5 times (or trigger signature failures) → after
      `maxAttempts`, further attempts show a "request a new pairing code"
      message.
- [ ] **Already bound** (`FIELD-PAIR-005`) — attempt to pair a second
      physical device (different `installationIdHash`) against a token
      already completed, or reuse an installation already bound elsewhere →
      clear "already bound" message, no partial/corrupted local state left
      behind (re-launching the app returns to a clean pairing chooser).
- [ ] After any failure, **"Try again"** returns to the chooser (not a crash
      or blank screen), and a fresh attempt with a valid code succeeds.

### 5. Camera fallback

- [ ] Deny the camera permission when prompted → the scanner surface shows
      the "camera unavailable" panel with an **"Enter code instead"**
      button, not a crash or frozen preview.
- [ ] On a device/emulator with no camera hardware at all, confirm the app
      still installs and the manual-entry path fully completes pairing
      end-to-end.
- [ ] From the manual entry screen, **"Scan QR code instead"** correctly
      switches to the camera view and vice versa, preserving no stale state
      between switches (previous partial code is cleared).

### 6. Accessibility & layout

- [ ] With a screen reader (TalkBack) enabled, confirm the two chooser
      options ("Scan QR Code" / "Enter Pairing Code") announce clear,
      distinct labels, and progress-state text (e.g. "Checking pairing
      code…") is announced as it changes (`Semantics(liveRegion: true)`).
- [ ] Confirm all interactive elements meet the app's existing large
      touch-target sizing (buttons ≥56dp height, consistent with
      `buildFieldTheme()`).
- [ ] Rotate/confirm the device stays in landscape (per existing app-wide
      orientation lock) and the QR scanner + instructions lay out
      side-by-side on a tablet-width screen, stacked on a narrow one.
- [ ] Confirm dark theme colors match the rest of the app (`FieldColors`) —
      no stray light-mode widgets, sufficient contrast on error/success text.

### 7. Regression — self-registration untouched

- [ ] `DeviceRegistrationScreen`'s existing supervisor-token flow still
      registers a **non-pre-provisioned** device end-to-end (no changes to
      `FieldDeviceService.registerDevice` or its request/response shape).
- [ ] The new "I have a pairing code" card does not block or alter the
      existing device name / supervisor token form fields, validation, or
      submit behavior.

## Automated coverage

Run before manual QA to catch regressions early:

```bash
cd apps/field-ops-tablet
flutter analyze
flutter test
```

Relevant automated tests:

- `test/pairing_qr_payload_test.dart` — QR schema/version/type/environment
  validation, short-code normalization and live-formatting, and an explicit
  test documenting that permissions/roles cannot be smuggled through the
  payload structurally.
- `test/field_pairing_service_test.dart` — request/response wiring for
  `claim` / `requestChallenge` / `complete` / `status` against the
  `/field/pairing/*` contract, including that challenge signatures are
  produced from the device keystore.

## Sign-off

| Item | Result | Notes |
| --- | --- | --- |
| Happy path (QR, auto-activate) | ☐ Pass ☐ Fail | |
| Happy path (manual code, requires approval) | ☐ Pass ☐ Fail | |
| Malformed/wrong-environment QR rejected pre-network | ☐ Pass ☐ Fail | |
| Server rejections surfaced clearly | ☐ Pass ☐ Fail | |
| Camera-denied / no-camera fallback | ☐ Pass ☐ Fail | |
| Accessibility & landscape layout | ☐ Pass ☐ Fail | |
| Self-registration regression check | ☐ Pass ☐ Fail | |
