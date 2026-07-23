# THE EYE Police Station Locator

Hybrid locator combining a **verified first-party police database** with an optional **Google Places API (New) live fallback**.

## Architecture

| Layer | Source | Purpose |
|---|---|---|
| A | Verified `police_stations` table | Independently sourced official records only |
| B | Google Places live search | Supplemental nearby results when verified coverage is thin |

Google content is **never** promoted to official THE EYE verification by copying Places data alone.

## Canonical mobile endpoint

`GET /v1/police-stations/nearby`

Query parameters:

- `latitude`, `longitude` — required
- `radius` — meters, capped by `GOOGLE_PLACES_MAX_RADIUS_METERS`
- `state`, `lga`, `search` — optional filters
- `limit` — default 10, max 25
- `cursor` — base64url offset for pagination

Legacy endpoints remain:

- `GET /v1/police-stations/nearest`
- `GET /v1/police-stations/search`
- `GET /v1/police-stations`

Admin writes:

- `POST /v1/police-stations` — create independently verified record (`source` + `sourceReference` required for verified statuses)
- `PATCH /v1/police-stations/:id` — edit
- `PATCH /v1/police-stations/:id/verify` — verification workflow + audit event

## Google Maps Platform compliance

### Allowed

- Server-side Places API (New) `searchNearby` / `searchText`
- Explicit field masks only
- Short-lived in-memory cache (default 900 s)
- Persist **Google Place ID** + fetch timestamps in `google_place_references`
- Return live Places content to clients at request time with attribution

### Not allowed

- Scraping Google Maps
- Bulk import of Google Places into `police_stations`
- Long-term storage of Google display names, addresses, phones, coordinates, reviews, ratings, or photos in THE EYE database
- Client-side Google Places API key usage
- Logging full Google API response payloads

### Response labelling

| `dataSource` | Meaning |
|---|---|
| `verifiedDatabase` | THE EYE verified official/admin record |
| `googlePlaces` | Live Google result; `verificationStatus=GoogleMapsResult` |

Google-only rows must show **“Google Maps result”** in mobile UI and must not display the **Verified** badge.

## Environment (server only)

```env
GOOGLE_PLACES_ENABLED=false
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_REGION=NG
GOOGLE_PLACES_DEFAULT_RADIUS_METERS=25000
GOOGLE_PLACES_MAX_RADIUS_METERS=50000
GOOGLE_PLACES_MAX_RESULTS=10
GOOGLE_PLACES_CACHE_TTL_SECONDS=900
GOOGLE_PLACES_TIMEOUT_MS=4000
```

Restrict keys to Places API (New), staging/production server egress, quota, and budget alerts.

## Mobile

Citizen app uses `/police-stations/nearby` and opens Google Maps for directions via Place ID or coordinate deep links.

Distances shown in-app are **straight-line estimates by THE EYE**. Directions are **Google Maps navigation**.

## Data gaps

Nationwide official police coverage is **not complete**. Dev/staging seed contains only sample Ikeja records. SRB-009 remains open until hybrid staging/device QA passes and an authorized official dataset is imported.
