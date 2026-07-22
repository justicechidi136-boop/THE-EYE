ALTER TABLE "incidents" ADD COLUMN "client_submission_id" TEXT;
ALTER TABLE "incidents" ADD COLUMN "occurred_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "incidents_client_submission_id_key" ON "incidents"("client_submission_id");

CREATE TABLE "incident_location_updates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incident_id" UUID NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DECIMAL(8,2),
    "gps_location" geography(Point,4326) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_device_id" TEXT,
    "sequence_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "incident_location_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incident_location_updates_incident_id_captured_at_idx" ON "incident_location_updates"("incident_id", "captured_at");

ALTER TABLE "incident_location_updates" ADD CONSTRAINT "incident_location_updates_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION set_incident_location_update_gps()
RETURNS trigger AS $$
BEGIN
  NEW.gps_location := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER incident_location_updates_set_gps
BEFORE INSERT OR UPDATE ON incident_location_updates
FOR EACH ROW EXECUTE FUNCTION set_incident_location_update_gps();
