# Mobile UX Remediation — UX-006 … UX-022

**Branch:** `fix/mobile-ux-006-022`  
**Status:** CODE COMPLETE — DEVICE QA PENDING  

Do not mark device/runtime items PASS until tested on a physical Android device.

## Audit matrix (summary)

| QA ID | Root cause | Ownership | Fix |
|---|---|---|---|
| UX-006 | Recorder hidden after stop; Play no-op on attachment card | Client | Keep dedicated `VoiceRecorder` preview; exclude voice-report audio from generic cards |
| UX-007 | AE evidence rendered as bare ListTiles | Client (+ API projection already present) | Submitted Evidence sections via `EyeEvidenceCard` |
| UX-009 | Mostly present; raw type labels | Client | `CitizenNotificationPresenter` + unread semantics |
| UX-011/014 | Weak hierarchy; free-text age | Client + API | Identity-first detail; exact/range age validation |
| UX-015 | Free-text cancel, silent empty | Client + API | Structured reason sheet + `reasonCode` |
| UX-016 | Ad-hoc notification copy | API + Client | Shared citizen notification copy |
| UX-018 | Dual CTAs same submit | Client | Removed “Send emergency now”; keep Submit |
| UX-019 | Empty/raw timestamps | Client | Empty state + friendly times |
| UX-020 | Step X of Y / raw timestamps / confidence | Client | Visual stages + citizen labels only |
| UX-021 | Written update timeline-only | API | Also send as communication Text message |
| UX-022 | Black stop button on dark | Client | `EyeDestructiveButton` |

## Device retest checklist

Record APK SHA, device, Android version, IDs, screenshots, PASS/FAIL.

- [ ] UX-006 voice preview/play/delete/re-record
- [ ] UX-007 mixed evidence visible on Active Emergency
- [ ] UX-009 read + mark all
- [ ] UX-011/014 missing person hierarchy
- [ ] UX-015 cancel validation
- [ ] UX-016 notification formats + deep links
- [ ] UX-018 single Submit CTA
- [ ] UX-019 communication UI
- [ ] UX-020 no Step/confidence/raw GPS timestamp
- [ ] UX-021 written update in communication
- [ ] UX-022 Stop Live Video contrast in dark mode
