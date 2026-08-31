# Nigeria agency directory N12 operational endpoint expansion

## Scope

N12 preserves `agency-recommendation-v1` and expands only provenance-complete
operational evidence. No coordinate, contact channel, emergency status, Police
Station, dispatch authority, escalation authority, or external communication is
inferred.

## Metric semantics

- **Structural coverage cell:** a verified State agency or federal formation has
  a canonical jurisdiction match for the service category. It says nothing about
  a usable endpoint.
- **Operational endpoint:** a concrete `AgencyOffice` (or a `PoliceStation` for
  station-level policing) with verified public endpoint evidence. An address
  alone is not contact-routing readiness.
- **Routing-ready endpoint:** a concrete verified office with an operational
  public contact, current agency/office/endpoint verification, an active agency,
  and a report-receiving capability. It remains advisory and does not authorize
  dispatch or data sharing.
- **Routing-ready coverage cell:** the category/State coverage aggregate. For a
  State agency with no office, current verified agency-level operational contact
  evidence can make this aggregate `READY`. This is directory coverage, not proof
  of a concrete actionable office.
- **Actionable recommendation:** a scenario-specific office recommendation whose
  capability, jurisdiction, current verification, `canReceiveReport`, and
  operational contact all pass the unchanged recommendation rule. Structural
  agencies without offices remain `STRUCTURAL_ONLY`.

The N11 movement from 13 to 15 actionable reviews while routing-ready coverage
cells stayed 11 is therefore expected. The new FCT Fire office converted two
scenario recommendations without creating a new category/State aggregate. A
regression test now locks the inverse ambiguity too: an aggregate can be `READY`
from agency-level contact evidence while `publicOfficeVerified` remains false.

## Ranked candidate decisions

`Affected N10 incidents` counts the frozen fixture scenarios whose incident type
could legitimately use the candidate's existing or proposed capability. It is
impact potential, not a promise that routing will accept the record.

| Rank | Candidate | State | Category | Affected N10 incidents | Structural coverage | Operational endpoint | Missing evidence | Best official source | Decision |
| ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| 1 | NPF divisional stations | Lagos | Police | 2 | Yes | No | Qualified station coordinates required by `PoliceStation`; current station verification | NPF Lagos Command directory | PENDING |
| 2 | LASEMA response base | Lagos | Emergency management | 3 | Yes | No | Exact current public response-base address | Lagos disaster services | PENDING |
| 3 | LASAMBUS base | Lagos | EMS | 2 | Yes | No | Named bases/points are locality-only, not exact endpoint addresses | Lagos LASAMBUS announcement | PENDING |
| 4 | Lagos Fire response station | Lagos | Fire/rescue | 2 | Yes | No | Exact current station address tied to public response contact | Lagos disaster services | PENDING |
| 5 | FRSC RS2.1 Sector Command | Lagos | Road crash | 1 | Yes | Structural only | Current exact response-office evidence; reviewed address document is old | FRSC official publications | PENDING |
| 6 | Kano SEMA endpoint | Kano | Emergency management | 1 | Partial | No | Current office address and public operational contact | Kano State budget/news | PENDING |
| 7 | Kano State Fire endpoint | Kano | Fire/rescue | 1 | Partial | No | Current exact address and official emergency/public contact | Kano State Government | PENDING |
| 8 | FRSC RS1.2 Sector Command | Kano | Road crash | 1 | Yes | Structural only | Exact current address/contact | FRSC command publications | PENDING |
| 9 | Enugu Fire endpoint | Enugu | Fire/rescue | 2 | Partial | No | Current exact address and official public response contact | Enugu State budget | PENDING |
| 10 | FRSC RS9.1 Sector Command | Enugu | Road crash | 1 | Yes | Structural only | Current exact address; towing registry label is not sufficient | FRSC official registry | PENDING |
| 11 | Borno SEMA/Fire/EMS endpoints | Borno | Emergency, Fire, EMS | 3 | Partial | No | Current public endpoint evidence; non-service pages rejected | Borno official budget/portal | PENDING |
| 12 | NPF public stations | Kano, Enugu, Borno | Police | 6 | Yes | No | State-command station directories and qualified station coordinates | NPF official sources | PENDING |
| 13 | FCT Emergency Medical Services | FCT | EMS | 1 | No dedicated record | Yes in N12 | None for contact routing; coordinates intentionally absent | FCTA HHSS and FAQ | ACCEPTED |
| 14 | FRSC RS7.1 Sector Command | FCT | Road crash | 1 | Yes | Structural only | Exact current sector-command address/contact | FRSC annual reports | PENDING |
| 15 | Rivers/Benue fire and road response | Rivers, Benue | Fire, road crash | 4 | Partial | Partial | Current exact public response endpoints | State/FRSC official sources | PENDING |
| 16 | Oyo EMS and priority-State police | Oyo, Abia | EMS, Police | 3 | Partial | No | Current exact endpoints; PoliceStation coordinates | State/NPF official sources | PENDING |

## Accepted endpoint

`NG-FCT-HHSS` represents the FCT Health and Human Services Secretariat, with FCT
Emergency Medical Services modeled as its operational `AgencyOffice`/service
unit. The official FCTA page describes HHSS as the self-accounting mandate
secretariat responsible for the FCT health sector and lists FCT EMS among its
departments and units; it does not establish FCT EMS as an independent agency.
The page publishes the Secretariat address at Plot 1, Kapital Street, Area 11,
Garki. The official FCTA FAQ explicitly labels two numbers for medical
emergencies. N12 imports only the `Medical` capability, those two emergency
phone contacts, and the official service page.

The controlled `Agency.type` remains `EMS` because it classifies the verified
operational service represented by the directory record; it does not assert
that the EMS unit is a legally independent agency.

No operating-hours claim or coordinate is imported. The record is not eligible
for distance ranking and no automatic dispatch or external call is enabled.

## Source decisions

### Accepted

- FCT Health and Human Services Secretariat: explicit FCT EMS unit and official
  public address.
- FCTA FAQ: two numbers explicitly identified for medical emergencies.

### Pending

- Lagos official pages confirm services and emergency contacts, but named
  LASAMBUS points are locality-only and reviewed Fire/LASEMA material does not
  establish an exact current response endpoint.
- NPF Lagos Command publishes station names, addresses, and public numbers, but
  the current `PoliceStation` model requires exact coordinates. No qualified
  authoritative coordinates were published, so zero stations are imported.
- FRSC sources verify commands and the national `122` line. Older or indirect
  command addresses are not promoted as current exact response endpoints.
- Kano, Enugu, Borno, Rivers, Benue, Oyo, and Abia sources establish structures
  or partial services but do not close the required endpoint evidence gaps.

### Rejected evidence

- Google Maps/business directories and crowd-sourced emergency-number sites as
  authority for endpoint import.
- Lagos general State Secretariat address as a service response endpoint.
- FRSC driver-license centres as road-crash response bases.
- Borno portal pages containing generic, foreign, or generated emergency text.
- Budget lines alone as proof that a response office is currently operational.

## PoliceStation strategy

Controlled official sourcing is practical only State by State. The official NPF
Lagos Command directory is a useful address/contact candidate source, but it does
not satisfy the model's coordinate requirement. N12 preserves the canonical
relationship `Nigeria Police Force -> State Command -> PoliceStation`, imports no
generated station list, and does not turn stations into independent agencies or
ordinary offices. A later station wave needs an authoritative coordinate source
or an approved verified-address geocode workflow.

## Geocoding

The decision is recorded in
`docs/nigeria-agency-directory-n12-geocoding-decision.md`. Automatic geocoding is
not implemented. The preferred pilot is a contractually approved permanent-
storage provider, with Mapbox Permanent Geocoding as the leading commercial
candidate. Google default geocodes cannot be persisted as proposed, public
Nominatim is unsuitable for production bulk automation, and every provider still
requires Nigeria-specific quality sampling and human review.

## Authoritative sources

- FCTA Health and Human Services Secretariat: https://www.fcta.gov.ng/ova_dep/health-and-human-services-secretariat/
- FCTA medical emergency contacts: https://www.fcta.gov.ng/faq/
- Lagos disaster services: https://lagosstate.gov.ng/services/disasters_emergencies
- Lagos LASAMBUS service update: https://lagosstate.gov.ng/news/all/view/6890c63bfe883fedf8d71960
- NPF Lagos Command directory: https://www.npf.gov.ng/lagos/home/contact/command?page=10
- FRSC command evidence: https://frsc.gov.ng/commands/sector-commands/
- FRSC annual report: https://staging.frsc.gov.ng/frsc-admin/uploads/2024_ANNUAL_REPORT_1_10_b52d7e1bcb.pdf
- Kano State Fire response evidence: https://kanostate.gov.ng/governor-yusuf-arrives-at-scene-of-second-singer-market-fire-incident/

## Safety invariants

The importer writes directory evidence only. SMS, email, WhatsApp, webhooks,
agency API calls, outbound jobs, incident dispatch mutations, and incident
escalation mutations remain zero. Automatic dispatch and escalation remain
disabled.

## Measured result

The source and database validators passed. The importer was run twice against an
isolated migrated certification database; the second run left every directory
count unchanged and reported zero duplicates and zero orphan relationships.

N12 changed the directory from 21 to 22 agencies, 142 to 143 offices, 50 to 53
public contacts, 16 to 18 verified emergency contacts, 169 to 170
jurisdictions, 53 to 54 incident capabilities, and 13 to 14 verified public
addresses. Qualified coordinates and Police Stations remain zero. Missing
public addresses remain 129, while records missing coordinates increase from
142 to 143 because the new verified office intentionally has no qualified
coordinate. Stale verification and missing-provenance findings remain zero.

Operational coverage cells move from 12 to 13 and routing-ready coverage cells
from 11 to 12. Fire endpoints remain 4; EMS endpoints move from 2 to 3; FRSC
and emergency-management endpoints remain 1 and 3 respectively.

The frozen `n10-v1` cohort remains 47 incidents. Reviews move from 183 to 184
because the FCT medical scenario now has one additional legitimate candidate.
Actionable reviews move from 15 to 16, insufficient-operational reviews remain
168, and zero-actionable incidents move from 34 to 33. Wrong-jurisdiction,
wrong-capability, and distance-qualified counts remain zero. The improvement is
fully attributable to the FCT EMS office under `NG-FCT-HHSS`; no fixture or recommendation-rule change is
involved.

The comparable fresh before/final-corrected runs measured 13.21/18.06 ms
average, 12.61/16.04 ms p50, 16.78/29.35 ms p95, and 33.89/34.82 ms maximum. A
second final-corrected execution reused all 184 reviews and created none,
demonstrating cohort idempotency; its timing was 16.01 ms average, 13.67 ms p50,
35.83 ms p95, and 47.73 ms maximum. No material performance regression was
identified.

Safety counters remained zero for directory mutation during QA, non-QA incident
mutation, dispatch mutation, notification mutation, outbound communication,
cross-State leakage, and unqualified-distance leakage. Automatic dispatch and
automatic escalation remain disabled.
