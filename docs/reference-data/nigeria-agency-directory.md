# Nigeria public-safety agency directory

## Scope

The directory models:

`Agency -> Office/Command -> Geographic coverage -> Verified public contacts -> Incident capabilities`

It extends the existing agency and authorization architecture. It does not create a parallel dispatch system and does not weaken the existing country/state/LGA security scope.

## Public seed boundary

The initial verified seed contains five federal organizations whose official public websites supplied sufficient identity and headquarters/contact evidence:

- Nigeria Police Force
- Nigeria Security and Civil Defence Corps
- Federal Road Safety Corps
- Federal Fire Service
- National Emergency Management Agency

Only official public contact values are imported. Unverified phone numbers, email addresses, office coordinates, personal contacts, internal escalation paths, secrets, and routing priorities are not exposed or fabricated.

State and local agency coverage is intentionally not claimed complete. Future datasets must use the same provenance and verification fields and must not be marked verified without an official source.

## Public and administrative contracts

Public API responses include verified public agency identity, active offices, public contacts, broad jurisdiction, and supported incident capabilities. They omit verification notes, internal priorities, security metadata, and non-public contacts.

Canonical state/LGA/ward filters are hierarchy-validated. A child identifier outside its supplied parent is rejected. Nearby search returns only offices with verified coordinates; no approximate coordinates are invented.

## Import and validation

```bash
pnpm --filter @the-eye/api db:validate:agency-directory
pnpm --filter @the-eye/api db:import:agency-directory
```

The importer is idempotent and updates records through stable agency codes and office/contact identities. Database constraints enforce hierarchy shape, verified-contact requirements, coordinate completeness, and duplicate-safe nullable identities.
