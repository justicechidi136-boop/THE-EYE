# THE EYE Smartwatch and SOS Device Module

## Purpose

The smartwatch module lets a citizen pair a wearable SOS device to their account, send GPS updates, receive critical alerts, and trigger an SOS that automatically creates a P1 incident.

## Device Modes

- PairedPhone: the watch relies on the mobile app connection for authentication and network access.
- StandaloneCellular: the watch calls the API directly using its device ID and one-time pairing secret.

Paired mode path:

`Watch -> Bluetooth LE -> Phone -> THE EYE Backend`

Standalone mode path:

`Watch -> LTE/eSIM, SIM, or WiFi -> THE EYE Backend`

The heartbeat endpoint decides whether the watch stays in paired mode or fails over to standalone mode. If the paired phone is unavailable and the watch still has internet, the backend marks the active mode as `StandaloneCellular`.

## Backend APIs

- `POST /smartwatch/devices/register`: pairs or re-pairs a watch to the authenticated citizen account and returns a one-time `deviceSecret`.
- `POST /smartwatch/devices/standalone-login`: validates a standalone watch secret/certificate and returns a short-lived JWT.
- `GET /smartwatch/devices`: lists the signed-in citizen's devices.
- `PATCH /smartwatch/devices/:id/status`: updates battery, mode, firmware, active state, and critical alert settings.
- `PATCH /smartwatch/devices/:id/unpair`: removes a watch from the user account.
- `PATCH /smartwatch/devices/:id/activate`: reactivates a disabled watch.
- `PATCH /smartwatch/devices/:id/deactivate`: remotely disables a watch.
- `PATCH /smartwatch/devices/:id/remote-wipe`: queues remote wipe and clears the device secret.
- `POST /smartwatch/devices/:deviceId/heartbeat`: receives mode, battery, signal, firmware, phone availability, and failover telemetry.
- `POST /smartwatch/devices/:deviceId/gps`: stores a GPS trail point and updates the device's latest known location.
- `POST /smartwatch/sos`: creates a P1 SOS incident, writes an SOS event, stores the GPS point, records timeline/audit entries, and alerts the family safety circle.
- `POST /smartwatch/devices/:deviceId/offline-sync`: uploads GPS, SOS, media, heartbeat, and acknowledgement events stored while offline.
- `GET /smartwatch/sos/:sosEventId/tracking`: returns live movement trail and latest watch location.
- `POST /smartwatch/devices/:deviceId/firmware/check`: checks for a signed firmware update.
- `POST /smartwatch/devices/:deviceId/firmware/:version/download`: returns signed firmware download metadata.
- `GET /smartwatch/admin/sos-events`: admin monitoring feed scoped by incident jurisdiction and agency.
- `GET /smartwatch/admin/devices`: admin device status list.
- `POST /smartwatch/admin/firmware`: publishes a signed firmware release.
- `POST /smartwatch/devices/:id/critical-alert`: queues a critical watch push alert.

## Database

The module extends `smartwatch_devices` and `sos_events`, then adds `smartwatch_gps_tracks`.

Important fields:

- Device pairing: `device_id`, `device_secret_hash`, `connectivity_mode`, `paired_phone_device_id`, `cellular_provider`.
- Hardware identity: `serial_number`, `imei`, `eid`, `sim_number`.
- Device security: `device_certificate`, `public_key`, `pairing_code_hash`, `firmware_signature_status`, `remote_disabled_at`, `remote_wiped_at`.
- Status: `battery_level`, `firmware_version`, `last_seen_at`, `is_active`, `critical_alerts_enabled`.
- Mode and failover: `preferred_mode`, `connectivity_mode`, `failover_enabled`, `is_online`, `signal_strength`.
- GPS: `last_latitude`, `last_longitude`, `last_gps_location`, `last_gps_accuracy`, `smartwatch_gps_tracks.gps_location`.
- SOS: `source_mode`, `accuracy`, `speed`, `heading`, `altitude`, `family_notified_at`, `incident_id`.
- Offline mode: `smartwatch_offline_events`.
- Firmware management: `smartwatch_firmware_releases`, `smartwatch_firmware_updates`.

PostGIS indexes are created for latest device location, GPS trails, and SOS event coordinates.

## Incident Flow

1. Watch triggers SOS.
2. API validates the paired user session or standalone device secret.
3. API creates an `SOS` incident with `P1LifeThreatening` priority.
4. API creates `sos_events` and `smartwatch_gps_tracks` records.
5. Incident timeline records `sos.smartwatch_triggered`.
6. `audit_logs` records the device-triggered emergency action.
7. Family safety circle contacts are queued for SMS notification.
8. Admin SOS monitoring page displays the active event and map location.

SOS modes:

- SilentSOS
- NormalSOS
- MedicalSOS
- KidnappingSOS
- FireSOS
- ChildSOS
- WomenSafetySOS

## Security

- Paired phone mode uses the authenticated citizen session.
- Standalone cellular mode requires `deviceSecret`.
- Standalone login returns a short-lived JWT bound to the paired user and device metadata.
- Device secrets are stored as SHA-256 hashes.
- Device certificates and public keys are stored for encrypted communication and future mutual authentication.
- Firmware downloads include hash and signature metadata for signature verification on-device.
- Admin SOS feeds are scoped through the linked incident jurisdiction and agency.
- Critical alerts require `broadcast:publish`.
- Every pairing, status update, alert, and SOS action writes an audit log.

## Admin Pages

- `/smartwatch`: all watches, pairing state, mode, signal, battery, firmware, remote disable.
- `/smartwatch/[id]`: watch detail, identity, pairing, remote commands, health, latest location.
- `/smartwatch/firmware`: publish, schedule, and roll back signed firmware releases.
- `/smartwatch/live-tracking`: active SOS movement trails and latest speed/update.
- `/smartwatch/health`: battery, signal, last seen, and firmware attention queues.
