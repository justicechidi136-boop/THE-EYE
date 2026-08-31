# Nigeria State agency verification wave 1

Retrieved: 2026-08-31

This wave covers Lagos, FCT, Rivers, Kano, Enugu, Borno, and Benue. Records are imported only when an authoritative government source proves the organization or service, its jurisdiction, a public office, and each published contact. Search-result snippets, social-media-only claims, personal contacts, and third-party directories are not accepted as verification.

## Imported

### Benue

- Benue State Emergency Management Agency
- Verified office: No. 7 Kashim Ibrahim Road, Makurdi
- Verified public contacts: one phone, one email, official website
- Source: https://sema.benuestate.gov.ng/about-us

### Rivers

- Rivers State Emergency and Ambulance Service
- Verified office: Rivers State Ministry of Health, State Secretariat Complex, Port Harcourt
- Verified public contacts: Ministry public email and official service page
- Source: https://www.riversstatemoh.gov.ng/emergency-department
- The phone numbers displayed elsewhere in the page chrome are not imported because the page identifies them with a separate health-insurance service.

## Verified identity, pending import

### Lagos

- Investigated: Lagos State Emergency Management Agency, Lagos State Fire and Rescue Service, Lagos State Ambulance Service.
- Official State sources verify the organizations and the shared emergency short codes 767 and 112.
- Pending: a service-specific official page that proves the office identity/address together with the contact contract used by this directory.
- Sources: https://lagosstate.gov.ng/services/disasters_emergencies and https://citizensgate.lagosstate.gov.ng/lasg_ministries.php

### FCT

- Investigated: FCT Emergency Management Department, FCT Fire Service, FCT Emergency Medical Services.
- FCTA verifies each service and publishes call-centre/fire contacts.
- Pending: a service-specific office/contact pairing; the general FCTA address and call centre are not represented as a department headquarters.
- Sources: https://www.fcta.gov.ng/ova_dep/abuja-metropolitan-management-council/, https://www.fcta.gov.ng/faq/, and https://www.fcta.gov.ng/ova_dep/health-and-human-services-secretariat/

### Kano

- Investigated: Kano State Emergency Management Agency.
- Official Kano budget and NEMA publications verify the agency.
- Pending: public contact and office provenance on an authoritative government source. Contacts found only on a non-government domain are not imported.
- Sources: https://kanostate.gov.ng/wp-content/uploads/2026/04/KANO-STATE-2026-Q1-BPR-FINAL.pdf and https://nema.gov.ng/stakeholders-engagement-meeting-on-nprc-2025-held-in-kano-state/

### Enugu

- Investigated: Enugu State Fire Service Department and the State incident-reporting service.
- Official budget verifies the Fire Service Department.
- Pending: authoritative service office and public contact details.
- Sources: https://enugustate.gov.ng/wp-content/uploads/2025/01/Enugu-State-FY-2025-Approved-Budget-1.pdf and https://enugustate.gov.ng/incident-report/

### Borno

- Investigated: Borno State Emergency Management Agency and Fire Service.
- Official State budget verifies SEMA; the Ministry of Information describes planned Fire Service expansion.
- Pending: authoritative service office and public contact details.
- Sources: https://budgetandplan.bornostate.gov.ng/ and https://bomiis.bornostate.gov.ng/

## Police relationship

State Police Commands are not duplicated in this wave. The existing `PoliceStation` model remains the source for verified station coordinates and nearest-station behavior. A future verified command can be linked to one `AgencyOffice` through `policeStationId`; the database already enforces that relationship as one-to-one.
