# Incident Communication Security

## Authorization

- Every read/write validates participant role server-side via `IncidentCommunicationsAccessService`.
- Unauthorized access returns **404** to prevent incident enumeration.
- Community verification participants are explicitly denied even if they responded to a nearby verification prompt.

## Privacy

- Push payloads contain **no message body**, attachment URLs, coordinates, or tokens.
- Anonymous reporters display as **Reporter** to officials; hidden identity is not exposed in thread metadata.
- Internal (`isInternal`) messages are hidden from reporter and responder views.
- Exact location in location-update messages is visible only to authorized operational roles.

## Moderation

- Urgent reporter messages are **never silently dropped**; flagged content remains delivered to operational users.
- Unsafe attachments may be hidden pending review (`moderationStatus: Hidden`).
- Admins may `restrict` or `close` conversations; actions are audit-logged.

## Audit actions

- `communication.message_sent`
- `communication.message_read`
- `communication.message_reported`
- `communication.information_request`
- `communication.restrict`
- `communication.close`

Audit metadata excludes raw message bodies and coordinates.

## Attachments

Media references use secure `attachmentId` / presigned flows — no permanent public URLs in API responses.
