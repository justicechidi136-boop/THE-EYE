# Agency hierarchy

## Parent agencies

`Agency.parentAgencyId` links child commands/stations to a national or state parent. National staging seeds use codes such as `NG-NPF`, `NG-FRSC`, `NG-NSCDC`, `NG-FFS`. LGA commands (for example Ikeja Police) may omit a national jurisdiction row and still set `countryCode` / `stateCode` / `lgaCode`.

`jurisdictionId` is optional so country-level agencies do not require an LGA jurisdiction.

## Units

Organizational units reuse `ResponseUnit` (same FK as `FieldDevice.assignedUnitId`):

- `name`, `unitIdentifier`
- `parentUnitId`, `unitKind` (`Command` / `Area` / `Station` / `Patrol` / `Other`)
- optional geo codes mirrored from the agency when omitted

Do not add a second unit FK on field devices.

## Field permission profiles

`FieldPermissionProfile.compatibleAgencyTypes` restricts which agency types may receive the profile. An empty array means all types.
