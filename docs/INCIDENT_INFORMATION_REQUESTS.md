# Incident Information Requests

Structured dispatcher prompts with constrained reporter replies.

## Request types

- `injured_count`
- `fire_still_active`
- `suspect_still_present`
- `vehicle_description`
- `direction_of_travel`
- `safe_to_call`
- `exact_landmark`
- `medical_assistance_required`
- `road_blocked`
- `situation_still_ongoing`
- `custom_approved` (requires pre-approved custom prompt text)

## Quick reply actions

- `yes`, `no`, `unsure`
- `still_ongoing`, `situation_resolved`, `unsafe_to_respond`
- `send_voice_response`, `send_photo`, `share_current_location`

## API

`POST /v1/incidents/:incidentId/information-requests`

```json
{
  "requestType": "situation_still_ongoing",
  "required": true,
  "expiresInMinutes": 30
}
```

Creates an `IncidentInformationRequest` row and an `InformationRequest` message in the thread.

## Response linking

Quick replies and structured responses update request status to `Responded` when `structuredAction.requestId` is supplied.

No arbitrary executable admin payloads are accepted.
