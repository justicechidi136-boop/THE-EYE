# Agency capability model

Capabilities are a controlled catalog in `@the-eye/shared` (`AgencyCapability`). They are stored on `Agency.capabilities` (`String[]`).

## Catalog (selected)

| Capability | Typical flag |
| --- | --- |
| `INCIDENT_DISPATCH` | `isDispatchable` |
| `FIELD_OPERATIONS` | `isFieldOperationsEnabled` |
| `DRONE_OPERATION` | `isDroneEnabled` |
| `BROADCAST_AUTHORITY` | `isBroadcastAuthority` |
| `PATROL` / `CHECKPOINT` / `BOLO` | FO workflows |
| `FIRE_RESPONSE` / `MEDICAL_RESPONSE` / `ROAD_RESPONSE` | specialty routing |

## Legacy dispatch

`serviceCategories` remains for existing dispatch routing. New FO and admin selectors should prefer `capabilities` and boolean flags. Unknown capability strings are rejected on write (`AGENCY-008`).

## Agency types

`Agency.type` is normalized to `AgencyType` (`POLICE`, `EMS`, `FIRE_RESCUE`, …). Legacy values such as `police` / `emergency` are migrated and mapped on read/write.
