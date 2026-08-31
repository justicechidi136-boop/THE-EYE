# Nigeria Agency Directory N10

Status: RECOMMENDATION QA BASELINE CERTIFIED; DIRECTORY ENRICHMENT REQUIRED

N9 checkpoint: `d91f03b78e2a20764a1a1577dbcfc0edde30c12c`

## Controlled dataset

N10 evaluates the unchanged `agency-recommendation-v1` rule with 47 deterministic,
non-production incidents across Lagos, FCT, Rivers, Benue, Kano, Enugu, Borno,
Oyo, and Abia. The cases cover fire, road crashes, crime, general security
emergencies, floods, building collapse/disaster, and medical emergencies. They
exercise operational, structural-only, multi-agency, incomplete-location,
unqualified-coordinate, and partial-verification conditions.

The runner is `apps/api/scripts/n10-agency-recommendation-qa.ts`. It requires both
database URLs to target the exact isolated local database
`the_eye_n1_cert_20260831`. It creates deterministic anonymous QA fixtures and
persists N9 review evidence without citizen PII. Repeated execution reuses the
same 183 reviews rather than creating duplicates.

Run from `apps/api`:

```powershell
.\node_modules\.bin\tsx.cmd scripts\n10-agency-recommendation-qa.ts
```

## Baseline results

- incidents evaluated: 47;
- recommendations reviewed: 183;
- actionable recommendations: 13, all 13 accepted as relevant;
- structural-only recommendations: 169;
- informational recommendations: 1;
- insufficient operational data: 170;
- zero-actionable incidents: 36;
- wrong capability, wrong jurisdiction, not relevant, outdated data, and other:
  zero;
- qualified-coordinate recommendations: zero.

The review acceptance rate is `ACCEPTED_AS_RELEVANT / ALL REVIEWS`, or
`13 / 183 = 7.103825%`. It is not recommendation accuracy. The denominator
includes structural-only recommendations reviewed as
`INSUFFICIENT_OPERATIONAL_DATA`. Every actionable recommendation was accepted.

## Performance and safety

The final baseline run measured an average recommendation latency of 15.76 ms,
p50 of 13.35 ms, p95 of 36.12 ms, and maximum of 38.33 ms across 47 evaluations.

Directory mutations, pre-existing incident mutations, dispatch mutations,
notification mutations, outbound communications, cross-State leaks, and
unqualified-distance leaks were all zero. Automatic dispatch and automatic
escalation remained disabled. The runner asserts these conditions before it can
report a successful certification.

## Conclusion

N10 found no systemic rule-quality defect. The principal gap is operational
directory evidence: verified endpoints, addresses, explicit public/emergency
contacts, and provenance-qualified coordinates. N11 should enrich that evidence
without changing `agency-recommendation-v1` or weakening verification rules.
