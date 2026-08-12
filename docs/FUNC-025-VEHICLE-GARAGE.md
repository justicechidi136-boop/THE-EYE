# FUNC-025 Vehicle Garage

## Scope

- Replaced single-car profile behavior with multi-vehicle garage semantics (`0..N` vehicles per citizen).
- Added authenticated API CRUD for citizen-owned vehicles at `/v1/me/vehicles*`.
- Mobile now stores and renders a list of vehicles, including primary designation.

## Primary Delete Rule

- Server enforcement is transactional in `UsersService.deleteMyVehicle(...)`.
- When deleting the current primary vehicle, the service automatically promotes the most recently updated remaining vehicle.
- If no vehicles remain after deletion, zero primary vehicles is allowed.

## Mobile Legacy Migration

- Legacy local key: `the_eye_car_profile`.
- New local key: `the_eye_vehicle_garage_v1`.
- On first garage sync after upgrade:
  - If API garage is empty and legacy local profile exists, mobile creates that vehicle via API with `isPrimary=true`.
  - Local legacy value is then cleared.

## Photo Handling (v1 Decision)

- API v1 intentionally does not store vehicle photo blobs or remote object keys.
- Mobile keeps photo paths (`imagePath`) in local cached vehicle copies for offline/detail rendering.
- Future API versions can add `photoObjectKey` without changing current ownership/primary logic.
