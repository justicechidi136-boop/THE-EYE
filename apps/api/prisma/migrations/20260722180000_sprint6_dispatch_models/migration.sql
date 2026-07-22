-- Sprint 6: agency dispatch models (responders, assignments, dispatch events, location)
CREATE TYPE "ResponderAvailability" AS ENUM ('Offline', 'Available', 'Busy', 'EnRoute', 'OnScene', 'OutOfService');
CREATE TYPE "ResponseUnitStatus" AS ENUM ('Offline', 'Available', 'Busy', 'EnRoute', 'OnScene', 'OutOfService');
CREATE TYPE "IncidentAssignmentStatus" AS ENUM ('Proposed', 'Assigned', 'Accepted', 'Declined', 'Expired', 'Reassigned', 'Arrived', 'Completed', 'Cancelled');

ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "service_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "operating_hours" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "escalation_priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS "agency_location" geography(Point,4326);

CREATE INDEX IF NOT EXISTS "agencies_jurisdiction_id_is_active_idx" ON "agencies"("jurisdiction_id", "is_active");

CREATE TABLE "responders" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "admin_user_id" UUID,
    "user_id" UUID,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "skill_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "availability" "ResponderAvailability" NOT NULL DEFAULT 'Offline',
    "active_assignment_count" INTEGER NOT NULL DEFAULT 0,
    "last_latitude" DECIMAL(9,6),
    "last_longitude" DECIMAL(9,6),
    "last_location" geography(Point,4326),
    "last_location_at" TIMESTAMPTZ(6),
    "last_location_accuracy_meters" DECIMAL(8,2),
    "device_status" JSONB NOT NULL DEFAULT '{}',
    "availability_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "responders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "response_units" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "unit_identifier" TEXT NOT NULL,
    "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "ResponseUnitStatus" NOT NULL DEFAULT 'Offline',
    "last_latitude" DECIMAL(9,6),
    "last_longitude" DECIMAL(9,6),
    "last_location" geography(Point,4326),
    "last_location_at" TIMESTAMPTZ(6),
    "crew_responder_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "response_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incident_assignments" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "responder_id" UUID,
    "response_unit_id" UUID,
    "assigned_by_admin_id" UUID,
    "previous_assignment_id" UUID,
    "client_assignment_id" TEXT,
    "status" "IncidentAssignmentStatus" NOT NULL DEFAULT 'Proposed',
    "priority" "IncidentPriority" NOT NULL DEFAULT 'P4GeneralSafety',
    "decline_reason" TEXT,
    "accepted_at" TIMESTAMPTZ(6),
    "declined_at" TIMESTAMPTZ(6),
    "en_route_at" TIMESTAMPTZ(6),
    "arrived_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dispatch_events" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "actor_admin_id" UUID,
    "event_type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dispatch_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "responder_location_updates" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "responder_id" UUID NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "gps_location" geography(Point,4326) NOT NULL,
    "accuracy_meters" DECIMAL(8,2),
    "captured_at" TIMESTAMPTZ(6) NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "responder_location_updates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "responders_admin_user_id_key" ON "responders"("admin_user_id");
CREATE UNIQUE INDEX "responders_user_id_key" ON "responders"("user_id");
CREATE INDEX "responders_agency_id_availability_is_active_idx" ON "responders"("agency_id", "availability", "is_active");
CREATE INDEX "responders_availability_active_assignment_count_idx" ON "responders"("availability", "active_assignment_count");

CREATE UNIQUE INDEX "response_units_agency_id_unit_identifier_key" ON "response_units"("agency_id", "unit_identifier");
CREATE INDEX "response_units_agency_id_status_is_active_idx" ON "response_units"("agency_id", "status", "is_active");

CREATE UNIQUE INDEX "incident_assignments_client_assignment_id_key" ON "incident_assignments"("client_assignment_id");
CREATE INDEX "incident_assignments_incident_id_status_created_at_idx" ON "incident_assignments"("incident_id", "status", "created_at");
CREATE INDEX "incident_assignments_agency_id_status_priority_created_at_idx" ON "incident_assignments"("agency_id", "status", "priority", "created_at");
CREATE INDEX "incident_assignments_responder_id_status_idx" ON "incident_assignments"("responder_id", "status");
CREATE INDEX "incident_assignments_response_unit_id_status_idx" ON "incident_assignments"("response_unit_id", "status");

CREATE INDEX "dispatch_events_incident_id_created_at_idx" ON "dispatch_events"("incident_id", "created_at");
CREATE INDEX "dispatch_events_event_type_created_at_idx" ON "dispatch_events"("event_type", "created_at");

CREATE UNIQUE INDEX "responder_location_updates_assignment_id_sequence_number_key" ON "responder_location_updates"("assignment_id", "sequence_number");
CREATE INDEX "responder_location_updates_responder_id_captured_at_idx" ON "responder_location_updates"("responder_id", "captured_at");
CREATE INDEX "responder_location_updates_assignment_id_captured_at_idx" ON "responder_location_updates"("assignment_id", "captured_at");

ALTER TABLE "responders" ADD CONSTRAINT "responders_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "responders" ADD CONSTRAINT "responders_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "responders" ADD CONSTRAINT "responders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "response_units" ADD CONSTRAINT "response_units_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "responders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_response_unit_id_fkey" FOREIGN KEY ("response_unit_id") REFERENCES "response_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_assigned_by_admin_id_fkey" FOREIGN KEY ("assigned_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_previous_assignment_id_fkey" FOREIGN KEY ("previous_assignment_id") REFERENCES "incident_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dispatch_events" ADD CONSTRAINT "dispatch_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispatch_events" ADD CONSTRAINT "dispatch_events_actor_admin_id_fkey" FOREIGN KEY ("actor_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "responder_location_updates" ADD CONSTRAINT "responder_location_updates_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "incident_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "responder_location_updates" ADD CONSTRAINT "responder_location_updates_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "responders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION sync_agency_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.agency_location := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agencies_sync_location ON "agencies";
CREATE TRIGGER agencies_sync_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON "agencies"
FOR EACH ROW EXECUTE FUNCTION sync_agency_location();

CREATE OR REPLACE FUNCTION sync_responder_last_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_latitude IS NOT NULL AND NEW.last_longitude IS NOT NULL THEN
    NEW.last_location := ST_SetSRID(ST_MakePoint(NEW.last_longitude::double precision, NEW.last_latitude::double precision), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS responders_sync_last_location ON "responders";
CREATE TRIGGER responders_sync_last_location
BEFORE INSERT OR UPDATE OF last_latitude, last_longitude ON "responders"
FOR EACH ROW EXECUTE FUNCTION sync_responder_last_location();

CREATE OR REPLACE FUNCTION sync_response_unit_last_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_latitude IS NOT NULL AND NEW.last_longitude IS NOT NULL THEN
    NEW.last_location := ST_SetSRID(ST_MakePoint(NEW.last_longitude::double precision, NEW.last_latitude::double precision), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS response_units_sync_last_location ON "response_units";
CREATE TRIGGER response_units_sync_last_location
BEFORE INSERT OR UPDATE OF last_latitude, last_longitude ON "response_units"
FOR EACH ROW EXECUTE FUNCTION sync_response_unit_last_location();

CREATE OR REPLACE FUNCTION sync_responder_location_update_gps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.gps_location := ST_SetSRID(ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS responder_location_updates_sync_gps ON "responder_location_updates";
CREATE TRIGGER responder_location_updates_sync_gps
BEFORE INSERT OR UPDATE OF latitude, longitude ON "responder_location_updates"
FOR EACH ROW EXECUTE FUNCTION sync_responder_location_update_gps();
