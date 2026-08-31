# Nigeria Agency Directory N5

Status: OPERATIONAL DIRECTORY COVERAGE IMPROVED, NOT COMPLETE

N4 checkpoint: `f07206fe08126c33b456bd0e530421eac7c3a640`

N5 does not treat a verified federal formation as a verified local response endpoint. `NOT_VERIFIED` means THE EYE lacks sufficiently verified evidence; it does not mean the service does not exist.

## Coverage semantics

- Structural coverage: the organization or formation and its State/FCT jurisdiction are authoritatively verified.
- Operational directory coverage: structural coverage plus a verified public address or actionable public contact belonging to the matching State agency or federal formation.
- Routing-ready coverage: operational coverage, a current verification record, and an active report-receiving capability. This is directory readiness only. It does not authorize dispatch, escalation, or sharing incident data.
- Public contacts include verified published contact records. Operational contacts are limited to phone, emergency phone, toll-free, SMS, WhatsApp, email, or reporting portal. Website and social-media records alone do not make an endpoint operational.
- Emergency contacts require an explicit emergency classification and an emergency-capable type. An ordinary public phone is never promoted to emergency status.
- Verification is current for routing-readiness reporting when at least one applicable agency, office, or contact verification date is within 365 days.

The existing `status` field remains a structural-status alias for API compatibility. The admin report also returns `structuralStatus`, `operationalStatus`, `routingReadiness`, aggregate evidence flags/counts, and record-level evidence without contact values.

## Research waves

Thirty-four entity candidates were screened across the six waves. Five records met the N5 import threshold; 29 remain pending because the available official evidence proved only existence, lacked a usable public endpoint, was stale/ambiguous, or did not establish an independent agency relationship.

- South West: imported Oyo SEMA, Oyo Fire Services, and OYRTMA. Osun's emergency contact centre, Ekiti traffic, Ogun SEMA, and Ondo emergency/fire candidates remain pending.
- South South: Edo SEMA/fire and Delta, Bayelsa, Akwa Ibom, and Cross River emergency-management candidates remain pending. Existing Rivers EMS evidence was preserved.
- South East: imported Abia Fire Service and Abia EMS from the State's integrated public-safety service. Anambra, Imo, and Ebonyi SEMA candidates remain pending; existing Enugu Fire evidence was preserved.
- North Central: Niger SEMA/fire, Kwara SEMA, Kogi SEMA, and Plateau SEMA remain pending. Existing Benue SEMA evidence was preserved.
- North West: Kaduna SEMA, Kebbi SEMA/fire, Zamfara SEMA, and Katsina SEMA remain pending. Existing Kano partial evidence was preserved.
- North East: Adamawa, Bauchi, Gombe, Taraba, and Yobe SEMA candidates remain pending. Existing Borno partial evidence was preserved.

No coordinates were imported. No State name was geocoded. No Ward or LGA was inferred.

## Authoritative N5 sources

- Oyo SEMA contact and headquarters: https://oysema.oyostate.gov.ng/contact-us/
- Oyo State Fire Stations Directory, headquarters, public phones, and emergency line: https://oyostate.gov.ng/fire-stations-directory/
- Oyo State Fire station/control-room corroboration: https://oyostate.gov.ng/oyo-state-fire-service/distribution-of-fire-service-stations-across-local-governments/
- Oyo State 615 emergency-line corroboration: https://oyostate.gov.ng/security/
- OYRTMA establishment, mandate, headquarters, and public email: https://oyrtma.oyostate.gov.ng/ and https://oyrtma.oyostate.gov.ng/contact-us/
- Abia State Homeland Security, Fire, and Emergency Medical Services address, public phone, and service structure: https://abiastate.gov.ng/homelandsecurity/

Official existence-only sources used to retain candidates as pending include current State government pages/budgets and NEMA publications. No commercial directory, unofficial social account, crowd-sourced map, or third-party phone book was imported.

## National structural and operational coverage

| State/FCT | Emergency Management | Fire Structural | Fire Operational | Ambulance/EMS | Traffic | Police Structural | Police Operational | NSCDC Structural | NSCDC Operational | FRSC Structural | FRSC Operational | Emergency Contacts | Public Offices | Coordinates | Pending |
|---|---|---|---|---|---|---|---|---|---|---|---|---:|---:|---:|---|
| Abia | NOT_VERIFIED | VERIFIED | VERIFIED | VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 5 | 0 | YES |
| Adamawa | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Akwa Ibom | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Anambra | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Bauchi | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Bayelsa | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Benue | VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Borno | PARTIAL | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Cross River | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Delta | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Ebonyi | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Edo | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Ekiti | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Enugu | NOT_VERIFIED | VERIFIED | VERIFIED | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Federal Capital Territory | PARTIAL | VERIFIED | VERIFIED | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 7 | 4 | 0 | YES |
| Gombe | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Imo | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Jigawa | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Kaduna | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Kano | PARTIAL | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Katsina | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Kebbi | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Kogi | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Kwara | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Lagos | VERIFIED | VERIFIED | PARTIAL | VERIFIED | VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 4 | 4 | 0 | YES |
| Nasarawa | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Niger | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Ogun | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Ondo | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Osun | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Oyo | VERIFIED | VERIFIED | VERIFIED | NOT_VERIFIED | VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 2 | 5 | 0 | YES |
| Plateau | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Rivers | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Sokoto | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Taraba | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Yobe | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |
| Zamfara | NOT_VERIFIED | VERIFIED | PARTIAL | NOT_VERIFIED | NOT_VERIFIED | VERIFIED | PARTIAL | VERIFIED | PARTIAL | VERIFIED | PARTIAL | 0 | 4 | 0 | YES |

## Certification metrics

- Before: 16 agencies / 136 offices / 34 contacts / 164 jurisdictions / 43 capabilities.
- After import 1: 21 / 141 / 47 / 169 / 53.
- After import 2: 21 / 141 / 47 / 169 / 53.
- N5 added: 5 State agencies, 5 verified offices/addresses, 13 public contacts, 1 explicitly classified emergency contact, 5 jurisdictions, and 10 capabilities.
- Federal formations changed: 0.
- Verified coordinates added: 0.
- Records remaining without public address: 129.
- Records remaining without coordinates: 141.
- Verified emergency contacts: 14.
- Structural coverage: 156 of 259 category cells verified.
- Operational directory coverage: 12 of 259 category cells verified.
- Routing-ready coverage: 11 of 259 category cells ready.
- Duplicate agencies/offices/contacts/jurisdictions: 0/0/0/0.
- Orphan relationships: 0.
- Automatic dispatch/escalation mappings: 0.
- Stale findings: 0.
- Missing provenance findings: 0.

CORE FEDERAL STRUCTURAL COVERAGE = VERIFIED for the nationwide NPF, NSCDC, FRSC, and Federal Fire formation categories represented by N4. This is not blanket verification of all 259 State/FCT category cells. Structural category, operational, and routing-ready coverage remain limited to the measured counts above.
