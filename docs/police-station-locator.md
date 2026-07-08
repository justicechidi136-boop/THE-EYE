# THE EYE Police Station Locator

The locator uses the existing `police_stations` table with PostGIS `gps_location` points and a GiST index for nearest-station queries.

## API

- `GET /police-stations/nearest?latitude=6.6012&longitude=3.3514`
- `GET /police-stations/search?state=Lagos&lga=Ikeja&q=Alausa`
- `POST /police-stations`
- `PATCH /police-stations/:id`

Admin writes require `agency:manage` and are written to `audit_logs`.

## Mobile

The Flutter citizen app shows nearby stations and opens Google Maps navigation with:

`https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving`
