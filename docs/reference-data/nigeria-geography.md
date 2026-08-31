# Nigeria geography reference data

## Canonical hierarchy

THE EYE stores an additive canonical hierarchy for Nigeria:

- Nigeria (`NG`)
- 36 states and the Federal Capital Territory
- 774 Local Government Areas and FCT Area Councils
- 8,809 INEC Registration Areas/Wards

The hierarchy supplements the existing string-based `Jurisdiction` contract. Existing authorization paths remain intact while new records can reference stable canonical identifiers.

## Source and provenance

The committed snapshot was retrieved on 2026-08-31 from the Independent National Electoral Commission (INEC) public polling-unit locator APIs. Its provenance block records the organization, source URLs, retrieval date, expected totals, transformation rules, and excluded source anomalies.

INEC's published national totals are treated as authoritative: 37 state/FCT entries, 774 LGA/Area Council entries, and 8,809 Registration Areas/Wards.

The live locator returned 8,810 raw ward rows. Investigation found one exact same-code/same-name duplicate in Benue, Gwer East: `09 - MBAIKYAAN`, source IDs `1462` and `8810`. The importer excludes only that provable duplicate and records it in snapshot provenance. Ambiguous code/name collisions fail validation.

No names, identifiers, aliases, coordinates, or boundary geometry are guessed. Coordinates and boundaries remain absent until an authoritative licensed source is approved.

## Refresh and validation

```bash
node scripts/data/fetch-nigeria-geography.mjs
pnpm --filter @the-eye/api db:validate:nigeria-geography
pnpm --filter @the-eye/api db:import:nigeria-geography
```

The fetcher and validator fail unless canonical totals are exactly 37/774/8,809, parent relationships resolve, identifiers are unique within their parent, and the only excluded source row is documented.

The importer is idempotent: source records and hierarchy records are upserted by stable canonical keys. Parent geography uses restricted deletion semantics so referenced records cannot be silently removed.
