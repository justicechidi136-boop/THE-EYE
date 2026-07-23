# THE EYE — Sprint 8 Authorization Report

**Report date:** 2026-07-23 (cycle 2 — entry-gate operator session)  
**Prepared by:** Principal Release Gatekeeper / QA Director  
**Decision:** **SPRINT 8 NOT AUTHORIZED**

---

## 1. Staging commit

| Field | Value |
|-------|-------|
| **Certified Git head** | `703be04cb91c9db6080c74fe59e582a59cd9e146` |
| **Lineage** | PR #19 `841d96a` → PR #20 `be387c6` (Sprint 6) → PR #21 `703be04` (entry-gate docs) |
| **Original RC commit** | `841d96a217d51fd2d0ed27479b30fbed240d250a` (PR #19 merge) |
| **Validate Staging (PR #19)** | [29991936821](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29991936821) — SUCCESS |
| **Live VPS runtime** | **Not certified** — automated deploy failed; manual VPS deploy not executed |
| **Deploy attempt** | [29995445139](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29995445139) — **FAILED** (GitHub `staging` env missing `vars.NEXT_PUBLIC_API_BASE_URL`) |

---

## 2. Mobile build and device

| Field | Value |
|-------|-------|
| **APK** | `app-staging-release.apk` (fresh build 2026-07-23 post-`703be04`) |
| **Package** | `com.theeye.app.staging` |
| **Version** | `0.1.0+1` |
| **SHA-256** | `E5C3F9BEAE60EDD4FD5BF7F3E78E93DBFA88BE4090865082BFB01411A9355E3B` |
| **Size** | 99,137,303 bytes |
| **Git commit** | `703be04` |
| **API URL** | `https://staging-api.theeye.com.ng/v1` |
| **Firebase** | `the-eye-2stg` |
| **Device** | **None** — ADB unavailable; APK not installed |
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
| **PR #18** | OPEN @ `2b0db6e` (rebased onto `be387c6`; force-with-lease pushed) |
| **PR #18 CI** | Run [29996852196](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29996852196) — **IN PROGRESS** at report time |
| **Local validation** | API 299/299 · Watch 55/55 · secret scan PASS |
| **Merge status** | **NOT MERGED** (awaiting green CI + explicit approval) |
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
| DEP-001 | Staging VPS not redeployed to certified commit lineage |
| DEP-002 | GitHub `staging` environment missing `vars.NEXT_PUBLIC_API_BASE_URL` — blocks Deploy workflow |
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
| Entry-gate docs PR | [#21 MERGED](https://github.com/justicechidi136-boop/THE-EYE/pull/21) → `703be04` |
| PR #19 merge | `841d96a` · [PR #19](https://github.com/justicechidi136-boop/THE-EYE/pull/19) |
| PR #20 merge | `be387c6` · Sprint 6 dispatch delta |
| Deploy failure | [29995445139](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29995445139) |
| PR #18 rebase + CI | `2b0db6e` · [29996852196](https://github.com/justicechidi136-boop/THE-EYE/actions/runs/29996852196) SUCCESS |
| Fresh mobile APK | SHA-256 `E5C3F9BE…9355E3B` @ `703be04` |
| Staging health (uncertified VPS) | `GET /v1/health/ready` @ 2026-07-23T09:29Z — observational only |

---

## 15. Recommendation

**SPRINT 8 NOT AUTHORIZED**

Mandatory next actions (strict order):

1. **Set** GitHub `staging` environment variable `NEXT_PUBLIC_API_BASE_URL=https://staging-api.theeye.com.ng/v1`.  
2. **Deploy** VPS to `703be04` (or approved descendant) via Deploy workflow or manual SSH per `STAGING_DEPLOYMENT.md` with backup.  
3. **Rebuild** mobile APK from deployed commit; install on physical Android via ADB.  
4. **Execute** Gate A (25) and Gate B (20) with evidence.  
5. **Obtain explicit merge approval for PR #18** (CI green @ `2b0db6e`); merge/deploy; Gate C on hardware.  
6. **Complete** Gate D fault-injection on certified runtime.  
7. **Reissue** this report.

**Do not** create Sprint 8 branch. **Do not** begin production-readiness implementation.

---

## Authorization signature block

| Role | Decision | Date |
|------|----------|------|
| Release Gatekeeper | **SPRINT 8 NOT AUTHORIZED** | 2026-07-23 |
| QA Director | **SPRINT 8 NOT AUTHORIZED** | 2026-07-23 |
