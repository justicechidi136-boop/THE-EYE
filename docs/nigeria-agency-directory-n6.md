# Nigeria Agency Directory N6

Status: OPERATIONAL ENDPOINT PROVENANCE AND SAFETY IMPLEMENTED; NATIONAL OPERATIONAL COVERAGE NOT CLAIMED

N5 checkpoint: `0c11ddf968cc41d1086e37887fe89bafaa87e137`

## Coverage language

- Core federal structural coverage: verified for the supported nationwide NPF, NSCDC, FRSC, and Federal Fire formation categories.
- Structural category coverage: measured across 259 State/FCT category cells and reported independently.
- Operational directory coverage: a verified structure plus a separately verified address or actionable public contact.
- Routing-ready coverage: a current operational endpoint with an actionable verified contact and report-receiving capability. This remains directory readiness only.
- `NOT_VERIFIED` means THE EYE lacks sufficient authoritative evidence. It never means a service does not exist.

Automatic dispatch, automatic escalation, and external incident transmission remain disabled.

## Endpoint evidence model

The additive N6 migration separates office-level evidence dimensions:

- verified address, address source, and address verification date;
- coordinate evidence class, coordinate source, and coordinate verification date;
- verified operating-hours value, source, and verification date.

Coordinate evidence classes are:

- `AUTHORITATIVE_COORDINATE`: directly published by an official agency, government directory, or government GIS source;
- `VERIFIED_ADDRESS_GEOCODE`: generated from a verified official address by an approved geocoder and kept distinguishable from direct publication;
- `THIRD_PARTY_REFERENCE`: research lead only, never eligible for verified distance ranking;
- `UNKNOWN`: no qualified coordinate evidence.

State or LGA centroids, city-only approximations, command names, postal approximations, and inferred Wards are prohibited.

## N6 controlled research

Wave 1 reviewed the existing structural and State-response records for Lagos, Federal Capital Territory, Rivers, Kano, Enugu, Borno, and Benue. The review covered Police Commands, Federal Fire formations, FRSC Sector Commands, NSCDC Commands, and existing State emergency/fire/EMS records.

Official evidence reconfirmed existing records, including:

- Lagos emergency lines and service classifications: https://lagosstate.gov.ng/services/disasters_emergencies
- FRSC field-command structure: https://staging.frsc.gov.ng/frsc-admin/uploads/2024_ANNUAL_REPORT_1_10_b52d7e1bcb.pdf
- FRSC public operational directory examples: https://rtsss.frsc.gov.ng/service/tow
- Benue SEMA public office and contact: https://sema.benuestate.gov.ng/contact
- NPF State Command structure: https://www.npf.gov.ng/news/details/635
- NSCDC command structure: https://nscdc.gov.ng/wp-content/uploads/2025/09/ZONAL-COMMANDS.pdf
- Federal Fire command structure: https://fedfire.gov.ng/commands/

No new coordinate was imported. No third-party map result was promoted to verified status. No new organization was added merely to increase coverage. Candidate addresses or contacts that could not be tied to the exact formation through current authoritative evidence remain in the admin data-quality queue.

## Police and fire separation

`PoliceStation` remains the local operational police endpoint. `AgencyOffice` remains the organization/formation directory record, with an existing optional one-to-one link to a PoliceStation. N6 reports verified PoliceStation coverage and linked NPF records without copying PoliceStations into State Command rows.

Federal Fire zonal/command structures remain structural formations. They are not treated as nearest fire stations unless a separately verified coordinate-qualified operational office exists.

## Nearest-office safety

`GET /public/agencies/nearby` ranks only active, verified offices with a complete coordinate pair, verified coordinate flag, qualified evidence class, and coordinate provenance. When no office qualifies, it returns an empty result with explicit metadata. It never substitutes 0,0 or State/LGA centroids.

## Admin data-quality queue

`GET /admin/agency-directory/reports/data-quality` is permission-protected by the existing `agency:manage` guard. It supports State, agency, category, missing-field, verification-age, and limit filters. Findings are prioritized for:

1. verified formation with no operational contact;
2. verified formation with no verified address;
3. verified address with no qualified coordinates;
4. emergency responder with no explicit verified emergency contact;
5. report-capable category with no operational endpoint;
6. stale endpoint evidence;
7. conflicting contact evidence.

The report contains no contact values and grants no dispatch authority.
