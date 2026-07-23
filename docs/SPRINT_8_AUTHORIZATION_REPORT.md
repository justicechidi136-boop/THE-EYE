# THE EYE — Sprint 8 Authorization Report

**Report date:** 2026-07-23  
**Prepared by:** Principal Release Gatekeeper / QA Director  
**Decision:** **SPRINT 8 NOT AUTHORIZED**

---

## 1. Staging commit

| Field | Value |
|-------|-------|
| **Certified Git head** | `841d96a217d51fd2d0ed27479b30fbed240d250a` |
| **Description** | Merge pull request #19 — staging runtime stabilization |
| **Validate Staging** | [29991936821](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29991936821) — SUCCESS |
| **Live VPS runtime** | **Not certified** — redeploy to `841d96a` not executed this cycle |

---

## 2. Mobile build and device

| Field | Value |
|-------|-------|
| **APK** | `app-staging-release.apk` (prior build from `841d96a`) |
| **Package** | `com.theeye.app.staging` |
| **Version** | `0.1.0+1` |
| **SHA-256** | `C823F10BF21576A254787C01A71F2ED39C7E3B0F53C5DA251BB656FE23C38C22` |
| **API URL** | `https://staging-api.theeye.com.ng/v1` |
| **Firebase** | `the-eye-2stg` |
| **Device** | **None** — ADB unavailable; no physical Android in session |
| **Gate A result** | **0 / 25 PASS** · 24 NOT TESTED · 1 BLOCKED BY PROVIDER |

---

## 3. Admin build and browser

| Field | Value |
|-------|-------|
| **URL** | `https://staging-dashboard8jps.theeye.com.ng` |
| **CI build** | Validate Staging admin Linux build PASS on `841d96a` |
| **Browser QA** | **Not executed** |
| **Gate B result** | **0 / 20 PASS** · 20 NOT TESTED |

---

## 4. Watch build and device

| Field | Value |
|-------|-------|
| **PR #18** | OPEN @ `723a238` (diverged +20/−4 vs staging) |
| **Watch APK** | Not built from certified staging |
| **Device/emulator** | **None** in session |
| **Gate C result** | **0 / 20 PASS** · 19 NOT TESTED · 1 BLOCKED BY HARDWARE |

---

## 5. Mobile pass/fail summary

| Outcome | Count |
|---------|------:|
| PASS | 0 |
| FAIL | 0 |
| BLOCKED BY PROVIDER | 1 (GA-MOB-008 OTP) |
| NOT TESTED | 24 |

**Blocking items:** VPS deploy required before any mobile Gate A PASS; SRB-001,003–006,011 pending device proof.

---

## 6. Admin pass/fail summary

| Outcome | Count |
|---------|------:|
| PASS | 0 |
| FAIL | 0 |
| NOT TESTED | 20 |

**Blocking items:** SRB-012 logout fix not verified in browser on live deploy; full role matrix untested.

---

## 7. Watch pass/fail summary

| Outcome | Count |
|---------|------:|
| PASS | 0 |
| FAIL | 0 |
| BLOCKED BY HARDWARE | 1 (GC-WCH-014 push on hardware) |
| NOT TESTED | 19 |

**Blocking items:** PR #18 not merged; no watch APK on certified staging; hardware QA blocked.

---

## 8. Backend/infrastructure summary

| Outcome | Count |
|---------|------:|
| PASS | 0 |
| FAIL | 0 |
| BLOCKED BY PROVIDER | 1 (GD-INF-010 Termii) |
| NOT TESTED | 17 |

**Observations (not PASS):** Remote health probe 2026-07-23T09:04Z shows API/worker/Redis/DB/Firebase healthy on **uncertified** VPS runtime. Scheduler health, migrations on VPS, crash-loop inspection, fault injection, and SMTP E2E not completed.

---

## 9. Provider summary

| Provider | Code status | Live staging E2E | Gate status |
|----------|---------------|------------------|-------------|
| **SMTP** | Merged PR #19 (`SmtpEmailProvider`) | **NOT TESTED** | NOT TESTED |
| **Termii SMS** | Merged PR #19 (`TermiiSmsProvider`) | **BLOCKED BY PROVIDER** (Sender ID) | BLOCKED BY PROVIDER |
| **Firebase Auth/FCM** | Config ok on probe | Push E2E not tested | NOT TESTED |
| **S3/Spaces** | Presign code fixed | Upload E2E not tested | NOT TESTED |
| **LiveKit** | Nginx healthz 200 | Room join not tested | NOT TESTED |

---

## 10. Open P0 defects

| ID | Description |
|----|-------------|
| DEP-001 | Staging VPS not redeployed to certified commit `841d96a` |
| SRB-001 | Password reset email — no live SMTP inbox proof |
| SRB-003 | Notification inbox — device QA pending |
| SRB-004 | Broadcasts — device QA pending |
| SRB-005 | Avatar upload — Spaces E2E pending |
| SRB-006 | SOS/report flows — per-type device QA pending |
| SRB-008 | LiveKit join or honest disable — runtime unverified |
| SRB-012 | Admin logout — browser QA pending |
| PR18-001 | Sprint 7 watch code not on staging |

---

## 11. Open mandatory P1 defects

| ID | Description |
|----|-------------|
| SRB-009 | Police station filters vs verified dataset |
| SRB-011 | Theme contrast — device verification pending |
| SRB-007 | Media UI honesty — device verification pending |

All tracked as **NOT TESTED**, not closed.

---

## 12. Provider / hardware / data blockers

| Type | Item | Impact |
|------|------|--------|
| Provider | Termii Sender ID `THE EYE` pending approval | GA-MOB-008, GD-INF-010 |
| Hardware | No physical Android device / ADB | Gate A entirely |
| Hardware | No physical watch for FCM/GPS/reboot | Gate C |
| Data | Police station verified nationwide seed unconfirmed | GA-MOB-023 |
| Deploy | VPS pre-PR-#19 runtime | All live E2E tests invalid until redeploy |

---

## 13. Deferred Release 1 features

| Feature | Deferral basis |
|---------|----------------|
| Job Vacancies | Coming soon snackbar (SRB-010) |
| Wear Data Layer phone relay | Documented on PR #18 |
| Fall detection / heart rate / physical SOS buttons | Hardware-only; not R1 |
| LiveKit full E2E | Allowed if GA-MOB-024 honest-disable PASS |

---

## 14. Evidence references

| Evidence | Reference |
|----------|-----------|
| PR #19 merge | `841d96a` · [PR #19](https://github.com/justicechidi136-boop/THE-EYE/pull/19) |
| PR CI green | [29991834750](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29991834750) |
| Validate Staging | [29991936821](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29991936821) |
| Runtime blockers | `docs/STAGING_RUNTIME_BLOCKERS.md` |
| Test matrix | `docs/RELEASE_CANDIDATE_TEST_MATRIX.md` (83 rows) |
| Entry gate criteria | `docs/SPRINT_8_ENTRY_GATE.md` |
| Staging health probe | `GET /v1/health/ready` @ 2026-07-23T09:04:24Z |
| Mobile APK hash | SHA-256 `C823F10B…38C22` @ commit `841d96a` |

---

## 15. Recommendation

**SPRINT 8 NOT AUTHORIZED**

Mandatory next actions (strict order):

1. **Deploy** staging VPS to `841d96a` (API, worker, admin) with backup and migration gate.  
2. **Rebuild** mobile APK from deployed commit; install on physical Android.  
3. **Execute** Gate A matrix (25 flows) with evidence.  
4. **Execute** Gate B in staging browser across roles.  
5. **Rebase and merge PR #18** only after steps 1–4 stable; rebuild watch APK; execute Gate C.  
6. **Complete** Gate D on certified runtime including SMTP inbox test and provider fault checks.  
7. **Update** matrix rows to PASS only with evidence; re-run this authorization report.

**Do not** create Sprint 8 branch. **Do not** begin production-readiness implementation.

---

## Authorization signature block

| Role | Decision | Date |
|------|----------|------|
| Release Gatekeeper | **SPRINT 8 NOT AUTHORIZED** | 2026-07-23 |
| QA Director | **SPRINT 8 NOT AUTHORIZED** | 2026-07-23 |
