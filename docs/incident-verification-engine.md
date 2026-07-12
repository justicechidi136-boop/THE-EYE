# Incident Verification Engine

THE EYE verification engine calculates a dynamic confidence score from 0 to 100 for each incident.

## Signals

- GPS accuracy and coordinate validity.
- Media GPS alignment with incident location.
- Reporter trust score, verification level, and verified-report ratio.
- Media evidence quality (count, timeliness, hash uniqueness, chain-of-custody).
- Live video availability.
- Weighted duplicate reports nearby (distance-aware).
- Time consistency.
- Location consistency.
- Nearby user confirmations (geo-scoped crowd requests).
- Trusted reporter confirmation.
- Admin confirmation and manual review workflow.
- Historical false report behavior.

## Speed Targets

- Initial system verification: under 5 seconds end-to-end.
- Scoring computation benchmark: p95 under 5ms per incident (in-process).
- Crowd confirmation request: within 10 seconds.
- High-confidence P1 incidents: auto-escalate immediately.

## API

- `POST /v1/verification/incidents/:id/run`: calculate confidence and write verification/timeline rows.
- `GET /v1/verification/incidents/:id/duplicates`: find nearby duplicate incidents using PostGIS.
- `POST /v1/verification/incidents/:id/crowd-request`: notify geo-scoped nearby witnesses.
- `POST /v1/verification/incidents/:id/confirm`: submit nearby witness or trusted reporter confirmation.
- `POST /v1/verification/incidents/:id/admin-review`: admin confirm, reject, or request more evidence.
- `GET /v1/verification/dashboard`: dashboard data for command-center review.

## Scoring

The scoring model is weighted and explainable. Each run stores the score, decision, and signal breakdown in `incident_verifications` and writes a timeline event.

Decision bands:

- 85-100: HighConfidence.
- 70-84: LikelyValid.
- 45-69: NeedsCrowdConfirmation.
- 0-44: LowConfidence.

P1 incidents with 85+ confidence are marked verified and receive an auto-escalation timeline event.
