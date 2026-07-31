# Phase 13 Danger Alert QA — Run Log

**Status:** BLOCKED — no `adb` in PATH; physical phone + watch not reachable from this environment.

**Date:** 2026-07-31  
**Priority cases:** P13-01 (English FCM), P13-02 (Pidgin FCM), P13-03 (English relay), P13-04 (Pidgin relay)

## Prerequisites checklist

- [ ] Staging mobile APK installed (`com.theeye.app.staging`)
- [ ] Staging watch APK installed (`com.theeye.watch.staging`)
- [ ] Phone ↔ watch paired per `docs/watch-firebase-pairing.md`
- [ ] Logged in as `WATCH_PAIRED_CITIZEN`
- [ ] Admin staging test form reachable with `WATCH_ADMIN_TEST_ALERT=ON`

## Execution notes

Run manually using `docs/PHASE_13_DANGER_ALERT_PHYSICAL_QA.md`.

Capture evidence to this folder:

- `danger-alert-p13-01-en-fcm.txt` — logcat + correlationId
- `danger-alert-p13-02-pcm-fcm.txt`
- `danger-alert-p13-03-en-relay.txt`
- `danger-alert-p13-04-pcm-relay.txt`

## API test bodies (staging)

### P13-01 English watch push

```json
{
  "userId": "<WATCH_PAIRED_CITIZEN_UUID>",
  "deviceId": "staging-watch-paired-001",
  "languageHint": "en-NG",
  "priority": "CRITICAL",
  "alertCode": "DANGER_ZONE_GENERAL_ENTRY",
  "channelMode": "watch_push"
}
```

### P13-02 Pidgin watch push

Same with `"languageHint": "pcm-NG"`.

### P13-03 English phone relay

Same with `"channelMode": "phone_relay"`.

### P13-04 Pidgin phone relay

Same with `"languageHint": "pcm-NG"` and `"channelMode": "phone_relay"`.

Audit action expected: `TEST_DANGER_ZONE_ALERT`
