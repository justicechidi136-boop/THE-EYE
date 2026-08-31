# Nigeria Agency Directory N7

Status: DETERMINISTIC ADVISORY RECOMMENDATIONS IMPLEMENTED; EXTERNAL DISPATCH NOT AUTHORIZED

N6 checkpoint: `15a16180445c416a8ef7ad560337ebdfd0093503`

## Architecture

N7 extends the existing `AgencyRoutingService`; it does not introduce a competing routing abstraction or persistent recommendation rows. The protected `POST /admin/agency-directory/recommendations/preview` endpoint is non-mutating and requires the existing `agency:manage` permission.

The canonical rule version is `agency-recommendation-v1`. Inputs are an incident type, canonical Nigeria geography identifiers, optional valid incident coordinates, and optional priority. Agency relevance comes only from active `AgencyIncidentCapability` mappings.

## Deterministic ordering

Candidates are ordered by:

1. recommendation tier (`PRIMARY`, `SECONDARY`, `STRUCTURAL_ONLY`, `INFORMATIONAL`);
2. jurisdiction specificity (Ward, LGA, State, national/custom);
3. operational readiness;
4. current verification evidence;
5. configured capability priority;
6. verified physical distance, when available;
7. agency and endpoint name for a stable tie-break.

There are no opaque scores or machine-learning decisions in the advisory preview.

## Endpoint and distance safety

Agency offices are operationally actionable only when current verified evidence includes an actionable public contact and a report-receiving capability. Physical distance is calculated only for an N6 coordinate-qualified endpoint and valid incident coordinates. Structural formations remain eligible as structural information with `distanceMeters: null`.

Verified `PoliceStation` rows remain separate local operational endpoints linked to the parent Nigeria Police Force agency. Federal or State police commands remain structural formations. Federal Fire commands likewise remain structural and cannot become a nearest fire endpoint without separately qualified operational location evidence.

## Safety boundary

Recommendation preview has no dependency on SMS, email, push, webhook, external HTTP, agency integration, queue, or incident mutation services. It does not dispatch, notify, transmit incident data, create tickets, change incident status, or claim agency acceptance. Empty actionable results are valid and include an explicit operational-data limitation.
