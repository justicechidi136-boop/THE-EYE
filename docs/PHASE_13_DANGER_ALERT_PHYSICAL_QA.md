# Phase 13 — Danger Alert Physical QA Worksheet

Physical device certification for smartwatch spoken danger-zone alerts on paired phone + watch.

## Test equipment

- Android phone with staging mobile APK (`com.theeye.app.staging`)
- Paired THE EYE watch with staging watch APK (`com.theeye.watch.staging`)
- Optional: standalone-capable watch, Bluetooth earphones
- Wi‑Fi + mobile data
- Noisy environment (for speech verification)

## Record for each run

| Field | Value |
|-------|-------|
| Phone model / Android version | |
| Watch model / Wear OS version | |
| Mobile APK hash / commit | |
| Watch APK hash / commit | |
| Backend commit / staging deploy | |
| Test account | `WATCH_PAIRED_CITIZEN` |
| Watch device ID | `staging-watch-paired-001` |
| Feature-flag snapshot | from `/admin/watch-notifications/feature-flags` |
| Timestamp (UTC+1) | |

## Priority pass — English + Pidgin (run first)

### P13-01 — English direct watch FCM

1. Admin → Safety Alerts → Watch analytics → **Send TEST_DANGER_ZONE_ALERT**
2. User ID: watch-paired citizen UUID
3. Device ID: `staging-watch-paired-001`
4. Language: `en-NG`
5. Channel mode: **Watch push only**
6. Priority: CRITICAL

**Expected:** Watch vibrates, danger screen appears, English TTS plays, ack stops repeats.

| Expected | Actual | Pass |
|----------|--------|------|
| Vibration + screen wake | | ☐ |
| English speech | | ☐ |
| Ack suppresses repeats | | ☐ |
| correlationId in admin response | | ☐ |
| `TEST_DANGER_ZONE_ALERT` in audit log | | ☐ |

### P13-02 — Pidgin direct watch FCM

Same as P13-01 with language `pcm-NG`.

**Expected:** Pidgin speech (e.g. “Abeg avoid that place” for general entry).

| Expected | Actual | Pass |
|----------|--------|------|
| Pidgin speech | | ☐ |
| No duplicate speech cycle | | ☐ |

### P13-03 — English phone relay

1. Keep phone logged in and paired
2. Channel mode: **Phone relay only**
3. Language: `en-NG`
4. Send test alert

**Expected:** Phone receives relay notification → Wear Data Layer → watch speaks in English. Phone does not duplicate speech.

| Expected | Actual | Pass |
|----------|--------|------|
| Phone relay path used | | ☐ |
| Watch receives via relay | | ☐ |
| English speech on watch | | ☐ |

### P13-04 — Pidgin phone relay

Same as P13-03 with `pcm-NG`.

### P13-05 — Both channels + dedupe

Channel mode: **Both channels**. Send once.

**Expected:** Single vibration/speech cycle (dedupe suppresses duplicate).

### P13-06 — Acknowledgement sync

Ack on watch after any alert above.

**Expected:** Telemetry shows `acknowledged`; repeat timer stops.

### P13-07 — Admin telemetry visibility

Open Watch analytics after P13-01..06.

**Expected:** Events include `received`, `displayed`, `speech_started`, `speech_completed`; geography scoped to admin role; device IDs masked.

## Full matrix (remaining cases)

| # | Case | Status |
|---|------|--------|
| 8 | Offline acknowledgement + later sync | ☐ |
| 9 | Watch disconnected → reconnected | ☐ |
| 10 | Phone disconnected | ☐ |
| 11 | Standalone Wi‑Fi | ☐ |
| 12 | Standalone mobile data | ☐ |
| 13 | Headphone-only privacy | ☐ |
| 14 | Headphones disconnected during speech | ☐ |
| 15 | Quiet hours | ☐ |
| 16 | Critical quiet-hours override | ☐ |
| 17 | Missing TTS language | ☐ |
| 18 | English fallback | ☐ |
| 19 | Recorded Pidgin fallback | ☐ |
| 20 | Alert expiry | ☐ |
| 21 | Danger-zone cleared alert | ☐ |
| 22 | Device restart with active alert | ☐ |
| 23 | Low-battery mode | ☐ |
| 24 | Admin telemetry visibility | ☐ |
| 25 | Staging test-alert audit trail | ☐ |

## Evidence per test

- Expected vs actual result
- Screenshot of watch screen
- `adb logcat -s flutter THE_EYE` excerpt
- Backend `correlationId` from staging test response
- Pass/fail + defect reference

## Commands

```powershell
adb devices
adb install -r artifacts\mobile\THE-EYE-staging-mobile-*.apk
adb install -r artifacts\watch\THE-EYE-staging-watch-*.apk
adb logcat -s flutter THE_EYE > .device-qa\danger-alert-qa-logcat.txt
```

## Staging test API body

```json
{
  "userId": "<watch-paired-citizen-uuid>",
  "deviceId": "staging-watch-paired-001",
  "languageHint": "en-NG",
  "priority": "CRITICAL",
  "alertCode": "DANGER_ZONE_GENERAL_ENTRY",
  "channelMode": "watch_push"
}
```

Use `"languageHint": "pcm-NG"` for Pidgin cases.
