# Port Harcourt Geolocation Physical QA Worksheet

**Environment:** Staging  
**Defects:** SRB-040, SRB-041  
**Do not mark DEVICE VERIFIED without completed rows + screenshots.**

---

## Certification identity

| Field | Value |
|---|---|
| Device | V2322 |
| Android version | 15 |
| APK package | `com.theeye.app.staging` |
| APK version | 0.1.0 (versionCode 1) |
| APK SHA-256 | `B8E6D334330E7D1EDFE8B3924DAD763854C5E4D932C13CB4BFAF1A7C1CBE4E30` |
| Application source SHA | `6d1469b` (geolocation) + `5d4d112` (LOC-TEST); branch HEAD `db8636d` |
| Deployed VPS / origin SHA | `db8636d` |
| API base URL | `https://staging-api.theeye.com.ng/v1` |
| Test account | `staging.citizen@theeye.local` (staging seed) |
| Test timestamp | ____________________ (UTC+1) |
| Tester | ____________________ |

**Note:** Rebuild/reinstall APK if application source SHA changes after LOC-TEST error-code commit. Test-only commits do not invalidate runtime QA APK.

---

## A. Test Current Location (SRB-040)

Path: **Settings → Location & Permissions**

| # | Check | Expected | Actual | Pass? | Screenshot |
|---|--------|----------|--------|:-----:|------------|
| A1 | Before test, Device location card | No city as current GPS unless labelled cached | | ☐ | |
| A2 | Button visible | **Test current location** visible | | ☐ | |
| A3 | Single tap | One probe only; duplicate taps ignored | | ☐ | |
| A4 | Loading UX | Inline loading on button/card only; permission card stays visible | | ☐ | |
| A5 | Loading terminates | Spinner clears within 15s | | ☐ | |
| A6 | Device Location headline | “Current device location” or “Last known device location” | | ☐ | |
| A7 | Locality / state | Port Harcourt / Rivers (or factual nearby locality) | | ☐ | |
| A8 | Source | Fresh GPS or Cached device location | | ☐ | |
| A9 | Accuracy | Metres shown | | ☐ | |
| A10 | Age | “Just now” / seconds / minutes | | ☐ | |
| A11 | Reverse geocode | Address shown OR “Location acquired (address unavailable)” + LOC-TEST-006 if geocode fails | | ☐ | |
| A12 | Profile Jurisdiction card | **Ikeja, Lagos, Nigeria** (staging profile) | | ☐ | |
| A13 | Disclaimer | “This is your saved profile jurisdiction, not your current GPS location.” | | ☐ | |
| A14 | No Ikeja substitution | Device card must NOT show Ikeja as GPS | | ☐ | |
| A15 | Request ID | Safe `loc-test-*` id if shown in diagnostics | | ☐ | |

**Acquisition duration:** ______ s  
**Accuracy band:** ______ m  

---

## B. Permission cases

| # | Case | Steps | Expected error / UI | LOC-TEST | Actual | Pass? |
|---|------|-------|---------------------|----------|--------|:-----:|
| B1 | Precise allowed | Grant precise | Fresh GPS acquired | — | | ☐ |
| B2 | Approximate only | Grant approximate only | Fix acquired; accuracy labelled | — | | ☐ |
| B3 | Denied | Deny once | Permission denied message | LOC-TEST-001 | | ☐ |
| B4 | Permanently denied | Deny twice / block | Open App Settings offered | LOC-TEST-002 | | ☐ |
| B5 | Location Services off | Disable system GPS | Open Location Settings offered | LOC-TEST-003 | | ☐ |
| B6 | Timeout | Weak/indoor signal | GPS timed out | LOC-TEST-004 | | ☐ |

---

## C. Cache and session

| # | Check | Expected | Actual | Pass? |
|---|--------|----------|--------|:-----:|
| C1 | Restart app | Cached fix labelled if shown | | ☐ |
| C2 | Logout / login | Profile jurisdiction separate; no stale GPS bleed | | ☐ |
| C3 | Clean reinstall | No universal Ikeja current-location default | | ☐ |

---

## D. Emergency flows (SRB-041 backend + mobile)

| # | Flow | GPS state | Expected jurisdiction | resolutionSource | Actual | Pass? |
|---|------|-----------|----------------------|------------------|--------|:-----:|
| D1 | SOS | Fresh Port Harcourt fix | Rivers/Obio-Akpor if inside staging polygon OR Awaiting manual resolution | `postgis_polygon` or `coordinates_unmapped` | | ☐ |
| D2 | SOS | GPS unavailable | Profile fallback allowed; labelled profile — not GPS | `user_profile` | | ☐ |
| D3 | Live Emergency Video | Fresh fix | No silent Ikeja assignment | explicit source | | ☐ |
| D4 | Live Emergency Video | Delayed fix | Jurisdiction may update; audit if corrected | | ☐ |
| D5 | Admin view | Any above | Admin sees factual source + status | | ☐ |

**Safe incident / request IDs:** ____________________

---

## E. Rivers staging seed verification (server-side)

Approved test coordinate: **lat 4.8156, lon 7.0498** (Port Harcourt centre)

| Check | Expected | Verified? |
|-------|----------|:---------:|
| Nigeria jurisdiction row exists | Yes | ☐ |
| Rivers State row exists | Yes | ☐ |
| Obio-Akpor LGA row exists | Yes | ☐ |
| Polygon SRID | 4326 | ☐ |
| Point inside staging polygon | ST_Covers true for test coordinate | ☐ |
| Seed idempotent (second run) | No duplicate rows | ☐ |
| Production claim | **Staging test coverage only** — not full Rivers boundary | ☐ |

---

## Sign-off

| Milestone | SRB-040 | SRB-041 |
|-----------|:-------:|:-------:|
| CODE FIXED | ✓ | ✓ |
| CI VERIFIED | ☐ | ☐ |
| DEPLOYED | ✓ (`6d1469b`) | ✓ |
| DEVICE VERIFIED | ☐ | ☐ |

**Final worksheet status:** ____________________  
**Do not promote to DEVICE VERIFIED without all mandatory Pass checkboxes and evidence attachments.**
