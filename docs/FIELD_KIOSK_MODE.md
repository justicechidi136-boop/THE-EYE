# Field Kiosk Mode

## Goal

Dedicated patrol/checkpoint/command tablets remain on THE EYE operational surface.

## Behaviour

When `deviceMode=managed_kiosk` and Device Owner is active:

- Lock Task Mode started for THE EYE + approved packages
- Unapproved apps blocked by OS + registry
- Screenshots / USB / settings governed by policy flags (MDM complements app policy)
- Boot brings Field Ops forward; splash still enforces auth + device registration state

## Exit

- Production: only via admin policy (`maintenanceModeAllowed`) + supervisor PIN + audit, or MDM
- Staging: maintenance escape opens Android Home settings after audited supervisor PIN

There are no hidden undocumented bypasses.
