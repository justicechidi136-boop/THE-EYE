# N12 verified-address geocoding decision

## Decision

Do not enable automatic geocoding in N12. A later, explicitly approved importer
may geocode only already-verified public agency addresses. Incident, citizen,
device, patrol, or reporter coordinates must never be sent through this path.

The future importer must require a human-approved provider contract, permanent
storage rights, Nigeria quality sampling, a provider result identifier, query
hash, matched-address components, confidence/match quality, provider and policy
version, retrieval time, reviewer, and re-verification date. A result may become
`VERIFIED_ADDRESS_GEOCODE` only after the returned State/FCT and locality match
the canonical directory record and a reviewer accepts the location. Partial or
ambiguous matches remain `UNKNOWN` and cannot participate in distance ranking.

## Provider comparison

| Provider | Cost/rate posture | Storage/licensing | Nigeria quality | Decision |
| --- | --- | --- | --- | --- |
| Google Geocoding | Usage-priced; current SKU pricing requires billing | General caching/storage is restricted; place IDs may be stored indefinitely and map display has attribution/product constraints | Broad global coverage, but must be sampled against the verified address cohort | Pending; unsuitable for storing raw geocodes under default terms |
| Mapbox Permanent Geocoding | Permanent mode is separately priced; current published tier starts at a paid per-request rate | Permanent endpoint permits storage for the customer's own business use; temporary results cannot be retained | Broad global coverage, but Nigeria exact-address quality needs a controlled sample | Preferred commercial pilot candidate, subject to owner/legal approval |
| HERE Geocoding and Search | Limited plan documents 1,000 daily requests and 5 RPS for geocoding; paid terms vary | Contract review is required before persistent storage | Global street/address service; Nigeria quality not yet measured | Pending contract and quality trial |
| Geoapify | Credit-based plans; free tier currently 3,000 credits/day and 5 RPS | Commercial/storage terms require legal review; OSM-derived attribution/licensing applies | OSM-dependent and likely variable outside mapped urban areas | Pending legal review and Nigeria quality trial |
| Public Nominatim | Hard maximum 1 request/second; systematic or recurring bulk use is restricted | Caching is encouraged, ODbL attribution/share-alike applies, and public service capacity is not an SLA | Depends on OSM coverage and address completeness | Rejected for production automatic import; acceptable only for deliberate research under policy |

## Re-verification and privacy

- Re-verify accepted geocodes at least annually and whenever the official public
  address changes.
- Retain the authoritative address as the primary fact and the geocode as derived
  provenance, never the reverse.
- Submit only a public agency address and `NG` country bias. Do not include an
  incident location or personal data.
- Keep an auditable provider result and reviewer decision; do not silently
  overwrite an authoritative coordinate.
- Rate-limit, batch off-line, and fail closed. Provider failure must not change
  recommendation eligibility.

## Official references

- Google usage and storage policy: https://developers.google.com/maps/documentation/geocoding/policies
- Google usage and billing: https://developers.google.com/maps/documentation/geocoding/usage-and-billing
- Mapbox temporary/permanent guidance: https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/
- Mapbox pricing: https://www.mapbox.com/pricing
- HERE geocoding API: https://docs.here.com/geocoding-and-search/reference/get_geocode
- HERE limited-plan limits: https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases
- Geoapify pricing: https://www.geoapify.com/pricing/
- OSMF Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
