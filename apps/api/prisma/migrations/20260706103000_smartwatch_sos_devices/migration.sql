ALTER TABLE "smartwatch_devices"
  ADD COLUMN IF NOT EXISTS "display_name" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "device_secret_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "connectivity_mode" TEXT NOT NULL DEFAULT 'PairedPhone',
  ADD COLUMN IF NOT EXISTS "paired_phone_device_id" TEXT,
  ADD COLUMN IF NOT EXISTS "cellular_provider" TEXT,
  ADD COLUMN IF NOT EXISTS "phone_number" TEXT,
  ADD COLUMN IF NOT EXISTS "battery_level" INTEGER,
  ADD COLUMN IF NOT EXISTS "firmware_version" TEXT,
  ADD COLUMN IF NOT EXISTS "last_latitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "last_longitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "last_gps_location" geography(Point,4326),
  ADD COLUMN IF NOT EXISTS "last_gps_accuracy" DECIMAL(7, 2),
  ADD COLUMN IF NOT EXISTS "last_gps_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "critical_alerts_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE "sos_events"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "source_mode" TEXT NOT NULL DEFAULT 'PairedPhone',
  ADD COLUMN IF NOT EXISTS "accuracy" DECIMAL(7, 2),
  ADD COLUMN IF NOT EXISTS "speed" DECIMAL(7, 2),
  ADD COLUMN IF NOT EXISTS "heading" DECIMAL(6, 2),
  ADD COLUMN IF NOT EXISTS "altitude" DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS "source_device_id" TEXT,
  ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "family_notified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "smartwatch_gps_tracks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "sos_event_id" UUID,
  "latitude" DECIMAL(9, 6) NOT NULL,
  "longitude" DECIMAL(9, 6) NOT NULL,
  "accuracy" DECIMAL(7, 2),
  "speed" DECIMAL(7, 2),
  "heading" DECIMAL(6, 2),
  "altitude" DECIMAL(8, 2),
  "gps_location" geography(Point,4326) NOT NULL,
  "captured_at" TIMESTAMPTZ NOT NULL,
  "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "source_mode" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "smartwatch_gps_tracks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "smartwatch_gps_tracks_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

UPDATE "smartwatch_devices"
SET "last_gps_location" = ST_SetSRID(ST_MakePoint("last_longitude", "last_latitude"), 4326)::geography
WHERE "last_latitude" IS NOT NULL
  AND "last_longitude" IS NOT NULL
  AND "last_gps_location" IS NULL;

CREATE OR REPLACE FUNCTION set_smartwatch_device_last_point()
RETURNS trigger AS $$
BEGIN
  IF NEW.last_latitude IS NOT NULL AND NEW.last_longitude IS NOT NULL THEN
    NEW.last_gps_location := ST_SetSRID(ST_MakePoint(NEW.last_longitude, NEW.last_latitude), 4326)::geography;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS smartwatch_devices_set_last_point ON "smartwatch_devices";
CREATE TRIGGER smartwatch_devices_set_last_point
BEFORE INSERT OR UPDATE OF last_latitude, last_longitude, updated_at
ON "smartwatch_devices"
FOR EACH ROW EXECUTE FUNCTION set_smartwatch_device_last_point();

CREATE OR REPLACE FUNCTION set_smartwatch_gps_track_point()
RETURNS trigger AS $$
BEGIN
  NEW.gps_location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS smartwatch_gps_tracks_set_point ON "smartwatch_gps_tracks";
CREATE TRIGGER smartwatch_gps_tracks_set_point
BEFORE INSERT OR UPDATE OF latitude, longitude
ON "smartwatch_gps_tracks"
FOR EACH ROW EXECUTE FUNCTION set_smartwatch_gps_track_point();

CREATE INDEX IF NOT EXISTS "smartwatch_devices_connectivity_active_idx" ON "smartwatch_devices"("connectivity_mode", "is_active");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_last_seen_idx" ON "smartwatch_devices"("last_seen_at");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_last_gps_location_idx" ON "smartwatch_devices" USING GIST ("last_gps_location");
CREATE INDEX IF NOT EXISTS "sos_events_incident_id_idx" ON "sos_events"("incident_id");
CREATE INDEX IF NOT EXISTS "sos_events_status_triggered_at_idx" ON "sos_events"("status", "triggered_at");
CREATE INDEX IF NOT EXISTS "sos_events_gps_location_idx" ON "sos_events" USING GIST ("gps_location");
CREATE INDEX IF NOT EXISTS "smartwatch_gps_tracks_device_captured_idx" ON "smartwatch_gps_tracks"("device_id", "captured_at");
CREATE INDEX IF NOT EXISTS "smartwatch_gps_tracks_user_captured_idx" ON "smartwatch_gps_tracks"("user_id", "captured_at");
CREATE INDEX IF NOT EXISTS "smartwatch_gps_tracks_sos_event_idx" ON "smartwatch_gps_tracks"("sos_event_id");
CREATE INDEX IF NOT EXISTS "smartwatch_gps_tracks_gps_location_idx" ON "smartwatch_gps_tracks" USING GIST ("gps_location");

INSERT INTO "smartwatch_devices" (
  "id",
  "user_id",
  "device_id",
  "provider",
  "display_name",
  "model",
  "connectivity_mode",
  "battery_level",
  "last_latitude",
  "last_longitude",
  "last_gps_accuracy",
  "last_gps_at",
  "last_seen_at",
  "metadata"
)
SELECT
  gen_random_uuid(),
  u."id",
  'EYE-WATCH-SEED-001',
  'THE EYE SOS Watch',
  'Amina SOS Watch',
  'EYE-SOS-1',
  'StandaloneCellular',
  87,
  6.601200,
  3.351400,
  9,
  now(),
  now(),
  '{"seed": true, "criticalAlerts": true}'::jsonb
FROM "users" u
WHERE u."email" = 'amina@example.com'
ON CONFLICT ("device_id") DO NOTHING;
