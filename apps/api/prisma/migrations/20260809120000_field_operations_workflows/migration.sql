-- Field operations operational workflows (Phase 7 Sprint 2)

CREATE TYPE "FieldShiftStatus" AS ENUM ('PendingApproval', 'Active', 'Paused', 'Ended', 'Cancelled');
CREATE TYPE "PatrolSessionStatus" AS ENUM ('Active', 'Paused', 'Ended');
CREATE TYPE "CheckpointSessionStatus" AS ENUM ('Active', 'Paused', 'Ended');
CREATE TYPE "OfficerOperationalStatus" AS ENUM ('OffDuty', 'OnShift', 'OnPatrol', 'AtCheckpoint', 'Responding', 'OnBreak', 'Panic');
CREATE TYPE "OperationalResponseType" AS ENUM (
  'Arrived',
  'UnderControl',
  'Evacuating',
  'RoadClosed',
  'MedicalRequired',
  'FireEscalating',
  'NeedMoreUnits',
  'NeedDrone',
  'Resolved',
  'BackupRequested',
  'SituationReport'
);
CREATE TYPE "OperationalSightingType" AS ENUM (
  'MissingPerson',
  'WantedSuspect',
  'WantedVehicle',
  'KidnappingAlert',
  'AmberAlert',
  'DroneObservation',
  'BroadcastMatch',
  'Other'
);
CREATE TYPE "OperationalSightingStatus" AS ENUM ('Open', 'Acknowledged', 'Closed');

CREATE TABLE "field_shifts" (
  "id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "assigned_unit_id" UUID,
  "vehicle_identifier" TEXT,
  "status" "FieldShiftStatus" NOT NULL DEFAULT 'PendingApproval',
  "requires_supervisor_approval" BOOLEAN NOT NULL DEFAULT false,
  "approved_by_id" UUID,
  "approved_at" TIMESTAMPTZ(6),
  "supervisor_note" TEXT,
  "started_at" TIMESTAMPTZ(6),
  "paused_at" TIMESTAMPTZ(6),
  "resumed_at" TIMESTAMPTZ(6),
  "ended_at" TIMESTAMPTZ(6),
  "start_latitude" DECIMAL(9,6),
  "start_longitude" DECIMAL(9,6),
  "end_latitude" DECIMAL(9,6),
  "end_longitude" DECIMAL(9,6),
  "client_action_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "patrol_sessions" (
  "id" UUID NOT NULL,
  "field_shift_id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "assigned_unit_id" UUID,
  "patrol_zone_label" TEXT,
  "status" "PatrolSessionStatus" NOT NULL DEFAULT 'Active',
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paused_at" TIMESTAMPTZ(6),
  "ended_at" TIMESTAMPTZ(6),
  "last_latitude" DECIMAL(9,6),
  "last_longitude" DECIMAL(9,6),
  "last_location_at" TIMESTAMPTZ(6),
  "route_recording" JSONB NOT NULL DEFAULT '[]',
  "client_action_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checkpoint_sessions" (
  "id" UUID NOT NULL,
  "field_shift_id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "checkpoint_name" TEXT NOT NULL,
  "checkpoint_zone_label" TEXT,
  "status" "CheckpointSessionStatus" NOT NULL DEFAULT 'Active',
  "queue_count" INTEGER NOT NULL DEFAULT 0,
  "vehicle_checks" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paused_at" TIMESTAMPTZ(6),
  "ended_at" TIMESTAMPTZ(6),
  "last_latitude" DECIMAL(9,6),
  "last_longitude" DECIMAL(9,6),
  "last_location_at" TIMESTAMPTZ(6),
  "client_action_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkpoint_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "officer_statuses" (
  "id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID,
  "field_shift_id" UUID,
  "patrol_session_id" UUID,
  "checkpoint_session_id" UUID,
  "status" "OfficerOperationalStatus" NOT NULL DEFAULT 'OffDuty',
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "location_at" TIMESTAMPTZ(6),
  "location_accuracy_meters" DOUBLE PRECISION,
  "battery_level" INTEGER,
  "charging_state" TEXT,
  "gps_status" TEXT,
  "radio_status" TEXT,
  "network_type" TEXT,
  "vehicle_identifier" TEXT,
  "drone_available" BOOLEAN NOT NULL DEFAULT false,
  "active_assignment_count" INTEGER NOT NULL DEFAULT 0,
  "emergency_incident_count" INTEGER NOT NULL DEFAULT 0,
  "weather_summary" TEXT,
  "is_offline" BOOLEAN NOT NULL DEFAULT false,
  "last_heartbeat_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "officer_statuses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_responses" (
  "id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID NOT NULL,
  "field_shift_id" UUID,
  "patrol_session_id" UUID,
  "checkpoint_session_id" UUID,
  "incident_id" UUID,
  "assignment_id" UUID,
  "response_type" "OperationalResponseType" NOT NULL,
  "note" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "client_action_id" TEXT,
  "synced_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_sightings" (
  "id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "broadcast_id" UUID,
  "sighting_type" "OperationalSightingType" NOT NULL,
  "status" "OperationalSightingStatus" NOT NULL DEFAULT 'Open',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "search_query" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "distance_meters" DOUBLE PRECISION,
  "client_action_id" TEXT,
  "synced_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operational_sightings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_shifts_client_action_id_key" ON "field_shifts"("client_action_id");
CREATE UNIQUE INDEX "patrol_sessions_client_action_id_key" ON "patrol_sessions"("client_action_id");
CREATE UNIQUE INDEX "checkpoint_sessions_client_action_id_key" ON "checkpoint_sessions"("client_action_id");
CREATE UNIQUE INDEX "officer_statuses_officer_id_key" ON "officer_statuses"("officer_id");
CREATE UNIQUE INDEX "operational_responses_client_action_id_key" ON "operational_responses"("client_action_id");
CREATE UNIQUE INDEX "operational_sightings_client_action_id_key" ON "operational_sightings"("client_action_id");

CREATE INDEX "field_shifts_officer_id_status_idx" ON "field_shifts"("officer_id", "status");
CREATE INDEX "field_shifts_agency_id_status_started_at_idx" ON "field_shifts"("agency_id", "status", "started_at");
CREATE INDEX "field_shifts_field_device_id_status_idx" ON "field_shifts"("field_device_id", "status");
CREATE INDEX "patrol_sessions_field_shift_id_status_idx" ON "patrol_sessions"("field_shift_id", "status");
CREATE INDEX "patrol_sessions_agency_id_status_started_at_idx" ON "patrol_sessions"("agency_id", "status", "started_at");
CREATE INDEX "patrol_sessions_officer_id_status_idx" ON "patrol_sessions"("officer_id", "status");
CREATE INDEX "checkpoint_sessions_field_shift_id_status_idx" ON "checkpoint_sessions"("field_shift_id", "status");
CREATE INDEX "checkpoint_sessions_agency_id_status_started_at_idx" ON "checkpoint_sessions"("agency_id", "status", "started_at");
CREATE INDEX "checkpoint_sessions_officer_id_status_idx" ON "checkpoint_sessions"("officer_id", "status");
CREATE INDEX "officer_statuses_status_last_heartbeat_at_idx" ON "officer_statuses"("status", "last_heartbeat_at");
CREATE INDEX "officer_statuses_field_device_id_idx" ON "officer_statuses"("field_device_id");
CREATE INDEX "operational_responses_officer_id_created_at_idx" ON "operational_responses"("officer_id", "created_at");
CREATE INDEX "operational_responses_incident_id_created_at_idx" ON "operational_responses"("incident_id", "created_at");
CREATE INDEX "operational_responses_assignment_id_created_at_idx" ON "operational_responses"("assignment_id", "created_at");
CREATE INDEX "operational_sightings_agency_id_sighting_type_status_idx" ON "operational_sightings"("agency_id", "sighting_type", "status");
CREATE INDEX "operational_sightings_officer_id_created_at_idx" ON "operational_sightings"("officer_id", "created_at");
CREATE INDEX "operational_sightings_broadcast_id_idx" ON "operational_sightings"("broadcast_id");

ALTER TABLE "field_shifts" ADD CONSTRAINT "field_shifts_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_shifts" ADD CONSTRAINT "field_shifts_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_shifts" ADD CONSTRAINT "field_shifts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_shifts" ADD CONSTRAINT "field_shifts_assigned_unit_id_fkey" FOREIGN KEY ("assigned_unit_id") REFERENCES "response_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_shifts" ADD CONSTRAINT "field_shifts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patrol_sessions" ADD CONSTRAINT "patrol_sessions_field_shift_id_fkey" FOREIGN KEY ("field_shift_id") REFERENCES "field_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patrol_sessions" ADD CONSTRAINT "patrol_sessions_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrol_sessions" ADD CONSTRAINT "patrol_sessions_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrol_sessions" ADD CONSTRAINT "patrol_sessions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patrol_sessions" ADD CONSTRAINT "patrol_sessions_assigned_unit_id_fkey" FOREIGN KEY ("assigned_unit_id") REFERENCES "response_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checkpoint_sessions" ADD CONSTRAINT "checkpoint_sessions_field_shift_id_fkey" FOREIGN KEY ("field_shift_id") REFERENCES "field_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkpoint_sessions" ADD CONSTRAINT "checkpoint_sessions_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_sessions" ADD CONSTRAINT "checkpoint_sessions_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkpoint_sessions" ADD CONSTRAINT "checkpoint_sessions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "officer_statuses" ADD CONSTRAINT "officer_statuses_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "officer_statuses" ADD CONSTRAINT "officer_statuses_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operational_responses" ADD CONSTRAINT "operational_responses_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_responses" ADD CONSTRAINT "operational_responses_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_responses" ADD CONSTRAINT "operational_responses_field_shift_id_fkey" FOREIGN KEY ("field_shift_id") REFERENCES "field_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_responses" ADD CONSTRAINT "operational_responses_patrol_session_id_fkey" FOREIGN KEY ("patrol_session_id") REFERENCES "patrol_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_responses" ADD CONSTRAINT "operational_responses_checkpoint_session_id_fkey" FOREIGN KEY ("checkpoint_session_id") REFERENCES "checkpoint_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_responses" ADD CONSTRAINT "operational_responses_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_responses" ADD CONSTRAINT "operational_responses_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "incident_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "operational_sightings" ADD CONSTRAINT "operational_sightings_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_sightings" ADD CONSTRAINT "operational_sightings_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_sightings" ADD CONSTRAINT "operational_sightings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_sightings" ADD CONSTRAINT "operational_sightings_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
