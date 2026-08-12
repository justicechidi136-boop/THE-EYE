# Neighborhood Watch — Staging Readiness

**Code status:** tracks `feature/neighborhood-watch-e2e`  
**Deploy:** DevOps-owned. This branch must not be deployed by the implementing agent.

## Staging test data (no production secrets)

Create via staging seed/admin APIs only:

| Entity | Purpose |
|--------|---------|
| Public Community A | Traveler baseline geofence |
| Public Community B | Switch target geofence |
| Private Estate C | Membership gate tests |

Personas: Resident A/B, Traveler, Community Admin A, Private Estate Resident, Applicant, Patrol Volunteer, State/Platform Admin (scoped).

## Exit criteria

| Claim | Requires |
|-------|----------|
| CODE COMPLETE — STAGING DEPLOYMENT PENDING | PR green automated tests |
| STAGING DEPLOYED — PHYSICAL QA PENDING | DevOps deploy evidence |
| PHYSICAL QA COMPLETE | Device checklist evidence |
| PRODUCTION READY | Release review |
