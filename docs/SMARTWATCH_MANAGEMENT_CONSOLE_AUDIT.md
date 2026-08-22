# Smartwatch Management Console Audit

Baseline: `ffc3dd31a31b2d2e3f26a060c47816461c1eff94`

Branch: `fix/smartwatch-management-console-closeout`

This matrix records the source-level closeout. Items that require an authenticated deployed staging session remain explicitly marked for runtime QA.

| ID | Requirement | Status | Severity | Frontend / API / database | Defect and remediation | Verification evidence |
| --- | --- | --- | --- | --- | --- | --- |
| SW-ADMIN-001 | Management home loads | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | Critical | Admin page -> `GET /watch-fleet/inventory` -> scoped Prisma query | Legacy list contract was replaced before this audit; operational metrics and attention counts are now derived from returned fleet data. | Admin tests and typecheck; authenticated staging load pending. |
| SW-ADMIN-002 | Device list success and partial metadata | PASS | High | Fleet mapper normalizes nullable model, owner, battery, signal, firmware and timestamps. | No optional field is dereferenced without a fallback. | Mapper tests cover malformed and partial rows. |
| SW-ADMIN-003 | Device list empty state | PASS | Medium | Explicit empty panel. | Empty API data is not rendered as a blank table. | Admin empty-state contract test. |
| SW-ADMIN-004 | Device list error and retry | PASS | High | Typed loader redacts backend details; segment error boundary provides retry. | API failure no longer becomes an empty success state on the main console. | Admin error-state contract test. |
| SW-ADMIN-005 | Pagination, search and filters | PASS | Medium | Cursor, search, pairing and device status query values pass to the fleet API. | Existing cursor flow retained. | Admin loader test and API fleet tests. |
| SW-ADMIN-006 | Device detail | PASS | High | `GET /smartwatch/admin/devices/:id`; scoped service query; safe mapper. | Activation/security state added; absent GPS now renders unavailable instead of a false `0,0` position. | Admin/API typecheck and smartwatch service tests. |
| SW-ADMIN-007 | Activation code generation | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | Critical | Admin BFF -> `POST /smartwatch/admin/activation-secrets` -> secure pairing session. | Third-party QR rendering sent one-time secrets to QuickChart and could fail under CSP/network controls. QR now renders locally with the existing `qrcode` dependency. | Local QR implementation inspection and activation service tests pass; authenticated staging issuance pending. |
| SW-ADMIN-008 | One active code per device | PASS | Critical | Unique `smartwatch_pairing_sessions.device_id`; upsert rotates the single row. | No latest-code-wins collection was introduced. Existing duplicate-code security migration remains unchanged. | Migration and service test inspection. |
| SW-ADMIN-009 | Three-attempt brute-force lock | PASS | Critical | Transaction row lock; attempt counters; session revoke; audit event. | Existing `TOO_MANY_FAILED_ACTIVATION_ATTEMPTS` and `DEVICE_ACTIVATION_BRUTE_FORCE_LOCKED` behavior preserved. | API tests. |
| SW-ADMIN-010 | Authorized activation recovery | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | Critical | Admin issuance resets the locked session and creates one new code. | Unregistered device IDs are now Super Admin only; registered devices require geographic access. | Unauthorized issuance and recovery tests pass; authenticated staging recovery pending. |
| SW-ADMIN-011 | Pairing session list/revoke scope | PASS | Critical | Pairing sessions joined to devices and filtered by device geography; unregistered sessions are Super Admin only. | Previously every `user:manage` admin could see/revoke every session. | API typecheck and service contract inspection. |
| SW-ADMIN-012 | Activation audit history | PASS | High | Audit rows are filtered through accessible device IDs for non-Super Admins. | Previously activation history was global. Codes and device secrets are not logged. | API typecheck and audit metadata inspection. |
| SW-ADMIN-013 | Device Health loads | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | Critical | Health page now uses `/watch-fleet/inventory`, not legacy `/smartwatch/admin/devices`. | Stale endpoint/shape assumptions caused the reported load failure. Explicit unauthorized, error, retry, empty and telemetry states added. | Admin typecheck/tests pass; authenticated staging load pending. |
| SW-ADMIN-014 | Heartbeat and online status | PASS | High | Watch sends heartbeat every five minutes; API updates last seen; UI requires a heartbeat no older than ten minutes. | Raw `isOnline` no longer leaves stale watches online indefinitely. | New stale/fresh heartbeat test and watch source inspection. |
| SW-ADMIN-015 | Missing telemetry | PASS | Medium | Null battery, signal, GPS and last-seen are supported. | Unknown values are distinct from zero and do not crash Health/detail. | Mapper tests and typecheck. |
| SW-ADMIN-016 | SOS history and canonical incident link | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | High | Watch SOS creates canonical P1 incident and scoped SOS event; admin history is scoped. | History links to the canonical admin incident detail when an incident ID is present. | API SOS tests and admin route inspection pass; runtime navigation pending. |
| SW-ADMIN-017 | Emergency live tracking | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | High | Selected active SOS event -> authenticated admin BFF -> scoped `GET /smartwatch/sos/:id/tracking`. | Polls every five seconds only while an active event is selected, aborts and clears the timer on disposal, retains the last position on transient failure, and labels stale or unavailable GPS. | Admin tests/typecheck and API geographic-scope tests; authenticated runtime tracking pending. |
| SW-ADMIN-018 | Location privacy and null handling | PASS | Critical | Incident/device geography scope enforced; absent GPS is not mapped to `0,0`. | Cross-scope device detail and action access is denied. | API scope tests and admin typecheck. |
| SW-ADMIN-019 | Deactivate/reactivate actions | PASS | Critical | Confirmed admin action -> guarded API -> scoped service -> audit. | Actions previously lacked service-level geographic checks. Confirmations and locked-device recovery routing added. | New cross-state action test. |
| SW-ADMIN-020 | Remote wipe | NOT IMPLEMENTED | High | API marker/command exists; watch client does not consume heartbeat commands. | The non-functional destructive-looking button was removed. A separate approved device command execution design is required before exposure. | End-to-end source trace. |
| SW-ADMIN-021 | Firmware release catalog/publish | PARTIAL | High | Admin firmware metadata list/publish and API watch check/download endpoints exist. | Watch client defines paths but has no firmware check/download/application service. Admin copy now explicitly says metadata publication does not deploy firmware; update counts are labeled retrievals started. | End-to-end source trace and API tests; runtime metadata publication QA pending. |
| SW-ADMIN-022 | Offline event replay | PASS | High | Watch queues SOS/GPS; API bounded replay processes supported events. | Existing architecture reused. | Watch and API offline tests. |
| SW-ADMIN-023 | Admin authorization | PASS | Critical | JWT + permission guards and service-level admin checks. | Destructive methods previously trusted route guards alone. Service now fails closed. | Typecheck and cross-scope tests. |
| SW-ADMIN-024 | Geographic isolation | PASS | Critical | User profile or organization geography checked for detail/actions/activation; fleet uses geography query filters. | Global pairing/audit/action access paths were closed. | API fleet and new cross-state tests. |
| SW-ADMIN-025 | Loading, success, empty, error and retry | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | High | Segment loading and error boundaries plus explicit page states. | Unauthorized responses are no longer mislabeled as missing data on repaired core pages. | Admin tests/typecheck pass; visual runtime QA pending. |
| SW-ADMIN-026 | Dark/light/responsive console quality | PARTIAL — STATIC/AUTOMATED PASS, RUNTIME QA PENDING | Medium | Existing THE EYE tokens, panels, badges and responsive tables retained. | Operational hierarchy and forms improved without a new design system. | Typecheck/static generation pass; authenticated screenshots at desktop/tablet widths pending. |
| SW-ADMIN-027 | Staging API environment | PASS | Critical | Existing central API client and server API origin are reused. | No localhost, production URL or environment override was added. | Static configuration guard coverage. |
| SW-ADMIN-028 | Database changes | PASS | Critical | Existing smartwatch, pairing, GPS, SOS, firmware and audit models reused. | No schema change or migration is required. | Prisma schema and migration inspection. |

## Runtime gates

Authenticated staging browser QA is still required for code issuance, recovery, Health network behavior, SOS navigation, firmware publication, dark/light mode, and responsive screenshots. No production access, deployment, migration, or database mutation is part of this branch.

## Watch/backend capability matrix

| Capability | Classification | Evidence |
| --- | --- | --- |
| Heartbeat | END-TO-END IMPLEMENTED | Watch `HeartbeatService` posts authenticated device telemetry; API validates, persists last-seen/health fields, and returns interval/threat metadata. The watch currently ignores returned command metadata. |
| Device registration | END-TO-END IMPLEMENTED | Citizen-authorized registration route and persisted watch identity are consumed by the existing pairing flow. |
| Activation/pairing | END-TO-END IMPLEMENTED | Watch activation and pairing services use the API code/session contracts and store the resulting device secret securely. |
| Activation recovery | END-TO-END IMPLEMENTED | Watch can regenerate through the approved recovery contract; admin recovery is scoped and audited. Authenticated staging QA remains pending. |
| SOS | END-TO-END IMPLEMENTED | Watch posts SOS, API creates the canonical incident/event, and admin receives scoped event data. |
| Health/telemetry | END-TO-END IMPLEMENTED | Watch heartbeat sends battery, signal, connectivity and firmware metadata; API persists it; Admin Health maps nullable data safely. |
| Location updates | END-TO-END IMPLEMENTED | Watch sends emergency GPS every five seconds and idle GPS every sixty seconds; API persists scoped trails; admin polls selected active SOS tracking with bounded cleanup. Runtime QA remains pending. |
| Device status | PARTIAL | Watch reports status and admin can deactivate/reactivate through scoped, audited API actions; the watch does not consume remote-disable commands from heartbeat responses. |
| Deactivate/reactivate | BACKEND ONLY | API and Admin action are implemented, but immediate watch-side command enforcement is absent. Server endpoints reject deactivated credentials on subsequent requests. |
| Firmware | PARTIAL | Admin publishes signed metadata and API supports version check/retrieval records; watch has constants only and no check/download/verify/apply implementation. |
| Remote commands | BACKEND ONLY | API can return command names, but `HeartbeatService` discards the response and has no secure command dispatcher. |
| Remote wipe | NOT IMPLEMENTED | Admin control remains removed. API marker/credential invalidation is not a secure watch-side wipe implementation. |

REMOTE WIPE = NOT IMPLEMENTED END-TO-END.
