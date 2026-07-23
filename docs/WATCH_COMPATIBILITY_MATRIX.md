# THE EYE — Watch Compatibility Matrix

**Sprint:** 7 — Smartwatch Completion, Device Management, and Field Reliability  
**Baseline:** `staging` @ Sprint 6 merge + Validate Staging #57 green  
**Last updated:** 2026-07-23  
**Rule:** Support is claimed only after APK install + API pairing + automated tests + documented QA method. Seller specs alone are not evidence.

---

## Target A — Wear OS (Google)

| Attribute | Requirement |
|-----------|-------------|
| **OS** | Wear OS 3+ |
| **Google Play Services** | Required for FCM |
| **Package ID** | `com.theeye.watch` (flavors: `development`, `staging`, `production`) |
| **Minimum SDK** | 26 (Android 8.0) — project `minSdk` in Gradle; Wear feature declared |
| **Firebase** | Per-flavor `google-services.json`; CI materializes from staging secrets |
| **Launcher** | Optional consumer default-home onboarding; **not forced** on Wear OS |
| **Standalone** | `com.google.android.wearable.standalone=true`; cellular/Wi‑Fi via watch radio |
| **GPS** | `geolocator` + runtime location permission |
| **Push** | FCM watch token → device-scoped registration |
| **Background** | Wear-approved APIs; foreground service only during active emergency |
| **Display** | Round + square layouts via Flutter responsive constraints |
| **QA method** | Wear OS emulator + physical Wear device |

**Known limits:** Phone relay via Wear Data Layer **DEFERRED to Sprint 8** (watch-side stub only; no mobile bridge). Sprint 7 Android staging gate validates **standalone HTTPS** only. Paired-phone UI shows deferred status; do not treat relay as supported.

---

## Target B — Full Android watches (square / phone-class APK)

| Attribute | Requirement |
|-----------|-------------|
| **OS** | Android 8.1+ (API 27+) |
| **Install** | Standard APK sideload or MDM; flavors `staging` / `production` |
| **Google Play Services** | Required for Firebase/FCM on most devices |
| **Launcher** | `LauncherHomeActivity` with `HOME` + `DEFAULT`; consumer onboarding to set default launcher |
| **Boot** | `RECEIVE_BOOT_COMPLETED` + boot receiver → safe launcher restart |
| **Standalone** | LTE/Wi‑Fi via `connectivity_plus`; standalone activation login |
| **GPS** | Same as Target A |
| **Push** | FCM; compact payloads only |
| **Background** | Foreground service during SOS/tracking where OEM allows; vendor battery docs required |
| **Display** | Square 320×386 and similar — tested via layout constraints |
| **QA method** | Square Android emulator + physical square watch (primary field target) |

**Known limits:** OEM battery killers (Xiaomi, Oppo, etc.) may block background SOS replay — document per-vendor guidance; mark **BLOCKED** until proven on hardware.

---

## Target C — Unsupported / provisional

| Class | Examples | Status |
|-------|----------|--------|
| Proprietary RTOS | Tizen-only, proprietary kid watches | **NOT SUPPORTED** |
| Vendor-app-only pairing | Watches without APK sideload | **NOT SUPPORTED** |
| No GPS / no network | BLE-only accessories | **NOT SUPPORTED** for SOS |
| No Google Play Services | HMS-only without FCM bridge | **BLOCKED** — no push until GMS or alternate provider |
| Fall detection / medical triggers | Unvalidated sensors | **BLOCKED** — audit only (Sprint 7 Phase 16) |
| Physical SOS button hijack | Power/home long-press | **BLOCKED** until verified per OEM |

---

## Capability matrix by target

| Capability | Wear OS (A) | Full Android (B) | Unsupported (C) |
|------------|:-------------:|:----------------:|:-----------------:|
| Pairing code flow | Y | Y | N |
| Device-scoped credential | Y | Y | N |
| Standard SOS | Y | Y | N |
| Silent SOS | Y | Y | N |
| Offline queue/replay | Y | Y | N |
| Active emergency screen | Y | Y | N |
| FCM push | Y (GMS) | Y (GMS) | BLOCKED |
| Launcher mode | Optional | Y (approved) | N |
| Boot recovery | Partial → Sprint 7 | Y (Sprint 7) | N |
| Real battery/GPS telemetry | Y | Y | N |
| Admin device console | Y | Y | N |
| Firmware/APK update policy | Y | Y | N |

---

## Firebase / environment isolation

| Flavor | Firebase project | API base |
|--------|----------------|----------|
| development | `the-eye-29cff` or local | LAN / dev URL |
| staging | `the-eye-2stg` | `https://staging-api.theeye.com.ng/v1` |
| production | production project | `https://api.theeye.com.ng/v1` |

CI guards enforce staging/production project ID separation.

---

## QA evidence requirements

| Evidence type | Acceptable for CODE COMPLETE | Acceptable for PASS |
|---------------|------------------------------|---------------------|
| Unit/widget tests | Yes | Partial |
| Emulator install + SOS | Yes (non-hardware rows) | Partial |
| FCM delivery on watch | No | **Required** |
| GPS accuracy field test | No | **Required** |
| 24h background stability | No | **Required** |
| Launcher boot after reboot | Emulator OK for code complete | Device preferred for PASS |

Do **not** mark hardware-dependent rows PASS from emulator-only runs.
