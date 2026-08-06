# Stolen Vehicle Broadcast Policy

## Required fields

- Vehicle type
- Make
- Model
- Colour
- Registration number
- Country
- State/LGA where available
- Date/time stolen
- Last known location
- Distinguishing features
- Photographs where available
- Police report reference where available
- Contact or safe response method
- `clientBroadcastId`

## Privacy

- Mask sensitive identifiers in public views
- Never expose complete VIN publicly
- Do not expose ownership documents or private registration records

## Publication

Stolen vehicle broadcasts become **Active** immediately after server validation. No admin approval is required before publication.

## Resolution

Authors may mark a vehicle as recovered. Administrators may mark resolved and notify prior recipients when resolution notifications are enabled.
