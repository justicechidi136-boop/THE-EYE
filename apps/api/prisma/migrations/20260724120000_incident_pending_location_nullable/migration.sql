-- Allow incidents without an initial GPS fix (pending/denied/unavailable location).
ALTER TABLE "incidents"
  ALTER COLUMN "latitude" DROP NOT NULL,
  ALTER COLUMN "longitude" DROP NOT NULL;

ALTER TABLE "incidents"
  ALTER COLUMN "gps_location" DROP NOT NULL;

CREATE OR REPLACE FUNCTION set_point_from_lat_lng()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.gps_location := ST_SetSRID(
      ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
      4326
    )::geography;
  ELSE
    NEW.gps_location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
