# Broadcast Notification Contract

Extends Notification Schema v1 for broadcast delivery.

## Missing person example

```json
{
  "schemaVersion": 1,
  "routeType": "BROADCAST_DETAILS",
  "eventType": "MISSING_PERSON_BROADCAST",
  "broadcastId": "...",
  "broadcastCategory": "MissingPerson",
  "countryCode": "NG",
  "issuedAt": "...",
  "destination": "/broadcasts/<broadcastId>",
  "deepLink": "/broadcasts/<broadcastId>"
}
```

## Stolen vehicle example

```json
{
  "schemaVersion": 1,
  "routeType": "BROADCAST_DETAILS",
  "eventType": "STOLEN_VEHICLE_BROADCAST",
  "broadcastId": "...",
  "broadcastCategory": "StolenVehicle",
  "countryCode": "NG",
  "issuedAt": "...",
  "destination": "/broadcasts/<broadcastId>",
  "deepLink": "/broadcasts/<broadcastId>"
}
```

## Rules

- Do not include sensitive personal data in push payloads.
- Mobile opens `/broadcasts/:id` and fetches full authorised content from the API.
- Resolution and suspension notifications should reflect current broadcast status when implemented.
