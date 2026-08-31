# Nigeria State agency directory: verified expansion wave 2

Retrieved and reviewed on 31 August 2026. This wave adds only records supported by official government sources. Missing contacts, addresses, coordinates, and capabilities remain null or absent. Capability mappings are directory metadata only: every imported mapping has automatic dispatch and escalation disabled.

## Coverage summary

| Jurisdiction | Candidates investigated | Agencies added | Federal formations added | Offices added | Public contacts | Emergency contacts | Rejected | Pending |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Lagos | 7 | 4 | 1 | 1 | 9 | 4 | 0 | 2 |
| Federal Capital Territory | 5 | 2 | 1 | 1 | 9 | 7 | 0 | 2 |
| Kano | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 2 |
| Enugu | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 2 |
| Borno | 4 | 1 | 1 | 1 | 0 | 0 | 0 | 2 |

The five offices above are FRSC Sector Commands under the existing federal FRSC agency. No duplicate federal agency is created. State Police and NSCDC commands are the two pending candidates in each jurisdiction because sufficiently specific official State-command evidence was not accepted in this wave. Rejected third-party pages are counted as rejected sources, not as separate agency candidates.

## Accepted records and sources

### Lagos: verified coverage

- Lagos State Emergency Management Agency (LASEMA): [official disaster and emergency service page](https://lagosstate.gov.ng/services/disasters_emergencies)
- Lagos State Fire and Rescue Service: [official disaster and emergency service page](https://lagosstate.gov.ng/services/disasters_emergencies)
- Lagos State Ambulance Service (LASAMBUS): [official Lagos State service article](https://lagosstate.gov.ng/news/all/view/6890c63bfe883fedf8d71960)
- Lagos State Traffic Management Authority (LASTMA): [official Lagos State incident-response article](https://lagosstate.gov.ng/news/all/view/678d5b70db5e7ef4cd967036) and [official State directory](https://citizensgate.lagosstate.gov.ng/lasg_das.php)
- FRSC RS2.1 Lagos Sector Command: [official FRSC annual report](https://frsc.gov.ng/wp-content/uploads/2020/12/2019-Annual-Report2.pdf)

LASEMA and LASAMBUS emergency use of 767 and 112 is explicit in the official sources. LASTMA's published line is retained as a public traffic and incident hotline, not an emergency-only number.

### Federal Capital Territory: partial verified coverage

- FCT Fire Service: [official FCTA service page](https://fcta.gov.ng/ova_dep/fct-fire-service/) and [official FCTA emergency FAQ](https://www.fcta.gov.ng/faq/)
- FCT Emergency Management Department: [official AMMC department listing](https://www.fcta.gov.ng/ova_dep/abuja-metropolitan-management-council/)
- FRSC RS7.1 FCT Sector Command: [official FRSC annual report](https://frsc.gov.ng/wp-content/uploads/2020/12/2019-Annual-Report2.pdf)

FEMD is partially verified because the source confirms its identity and parent structure but does not provide a sufficiently detailed public mandate, office, or contact for further capability mapping.

### Kano: partial verified coverage

- Kano State Emergency Management Agency: [official Kano State budget publication](https://kanostate.gov.ng/wp-content/uploads/2026/04/KANO-STATE-2026-Q1-BPR-FINAL.pdf)
- FRSC RS1.2 Kano Sector Command: [official FRSC annual report](https://frsc.gov.ng/wp-content/uploads/2020/12/2019-Annual-Report2.pdf)

Public SEMA office and contact details remain pending verification.

### Enugu: partial verified coverage

- Enugu State Fire Service Department: [official Enugu State budget publication](https://enugustate.gov.ng/wp-content/uploads/2025/01/Enugu-State-FY-2025-Approved-Budget-1.pdf)
- FRSC RS9.1 Enugu Sector Command: [official FRSC annual report](https://frsc.gov.ng/wp-content/uploads/2020/12/2019-Annual-Report2.pdf)

The budget supports a conservative Fire capability mapping. Public office and contact details remain pending verification.

### Borno: partial verified coverage

- Borno State Emergency Management Agency: [official Borno State budget publication](https://budgetandplan.bornostate.gov.ng/storage/documents/tuyrlWS6ElX3KREryzq92LcLisuUOCDm9TeeIMql.pdf)
- FRSC RS12.2 Borno Sector Command: [official FRSC annual report](https://frsc.gov.ng/wp-content/uploads/2020/12/2019-Annual-Report2.pdf)

Public SEMA office and contact details remain pending verification.

## Rejected or deferred candidates

- State Police Commands: not imported in this wave; no duplicate PoliceStation records or State-specific NPF agencies were created.
- NSCDC State Commands: not imported from zonal sources because zones span multiple States and do not prove the requested State-command record.
- Federal Fire Service and NEMA formations: candidate locations without sufficiently current, formation-specific official evidence were deferred.
- Third-party emergency-number directories, blogs, search snippets, social pages, and business directories were rejected as primary evidence.

## Administrative reports

The authenticated agency-management API provides:

- `GET /admin/agency-directory/reports/freshness` for stale contacts, missing provenance, missing verification dates, retired-but-active records, and missing official URLs. `staleDays`, verification status, source, agency, State, and bounded result limit are supported.
- `GET /admin/agency-directory/reports/coverage` for all canonical Nigerian States and the FCT, scoped to the requesting administrator.

Coverage values distinguish `VERIFIED`, `PARTIAL`, `NOT_VERIFIED`, `NOT_APPLICABLE`, and `UNKNOWN`. `NOT_VERIFIED` means THE EYE does not yet hold authoritative verified data; it does not assert that a service is absent.
