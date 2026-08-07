-- Phase 7 Sprint 3: GIS/realtime, officer safety, backup, patrol/checkpoint hardening, sync state

CREATE TYPE "FieldBackupRequestType" AS ENUM ('Immediate', 'Medical', 'Fire', 'Armed', 'Traffic', 'Supervisor', 'Tow', 'Drone');
CREATE TYPE "FieldBackupRequestStatus" AS ENUM ('Requested', 'Acknowledged', 'Assigned', 'EnRoute', 'Arrived', 'Cancelled', 'Resolved');
CREATE TYPE "FieldOfficerSafetyAlertType" AS ENUM ('Panic', 'OfficerDown', 'MissedCheckIn', 'DistressSignal');
CREATE TYPE "FieldOfficerSafetyAlertStatus" AS ENUM ('Active', 'Acknowledged', 'Resolved', 'Cancelled');
CREATE TYPE "FieldOperationalEventType" AS ENUM (
  'AssignmentCreated', 'AssignmentCancelled', 'AssignmentReassigned', 'DispatcherMessage',
  'BackupRequested', 'BackupAssigned', 'PatrolStatus', 'CheckpointAlert', 'BoloMatch',
  'DroneMission', 'IncidentStatus', 'ResponderStatus', 'OfficerSafety', 'DeviceHealth', 'ShiftAlert'
);
CREATE TYPE "FieldPatrolEventType" AS ENUM (
  'ZoneEntry', 'ZoneExit', 'Stop', 'Deviation', 'CheckpointMissed',
  'GpsUnavailable', 'WeakAccuracy', 'Break', 'ConnectivityLoss'
);
CREATE TYPE "FieldCheckpointObservationType" AS ENUM ('Vehicle', 'Person', 'Plate', 'Vin', 'BroadcastMatch');

CREATE TABLE "field_backup_requests" (
  "id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "field_shift_id" UUID,
  "incident_id" UUID,
  "assignment_id" UUID,
  "request_type" "FieldBackupRequestType" NOT NULL,
  "status" "FieldBackupRequestStatus" NOT NULL DEFAULT 'Requested',
  "priority" "IncidentPriority" NOT NULL DEFAULT 'P3SuspiciousActivity',
  "reason" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "assigned_unit_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "acknowledged_at" TIMESTAMPTZ(6),
  "assigned_at" TIMESTAMPTZ(6),
  "en_route_at" TIMESTAMPTZ(6),
  "arrived_at" TIMESTAMPTZ(6),
  "resolved_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "generation_id" TEXT,
  "client_action_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_backup_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_officer_safety_alerts" (
  "id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "alert_type" "FieldOfficerSafetyAlertType" NOT NULL,
  "status" "FieldOfficerSafetyAlertStatus" NOT NULL DEFAULT 'Active',
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "battery_level" INTEGER,
  "network_type" TEXT,
  "note" TEXT,
  "check_in_due_at" TIMESTAMPTZ(6),
  "missed_check_in_at" TIMESTAMPTZ(6),
  "generation_id" TEXT,
  "client_action_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  CONSTRAINT "field_officer_safety_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_operational_events" (
  "id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "field_device_id" UUID,
  "event_sequence" BIGINT NOT NULL,
  "event_type" "FieldOperationalEventType" NOT NULL,
  "entity_type" TEXT,
  "entity_id" UUID,
  "generation_id" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_operational_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_patrol_events" (
  "id" UUID NOT NULL,
  "patrol_session_id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "event_type" "FieldPatrolEventType" NOT NULL,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "accuracy_meters" DOUBLE PRECISION,
  "note" TEXT,
  "client_action_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_patrol_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_checkpoint_observations" (
  "id" UUID NOT NULL,
  "checkpoint_session_id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "observation_type" "FieldCheckpointObservationType" NOT NULL,
  "search_query" TEXT,
  "match_broadcast_id" UUID,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "evidence_reference" TEXT,
  "client_action_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_checkpoint_observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "field_device_sync_states" (
  "field_device_id" UUID NOT NULL,
  "officer_id" UUID NOT NULL,
  "sync_cursor" TEXT,
  "generation_id" TEXT NOT NULL,
  "last_event_sequence" BIGINT NOT NULL DEFAULT 0,
  "offline_queue_depth" INTEGER NOT NULL DEFAULT 0,
  "dead_letter_count" INTEGER NOT NULL DEFAULT 0,
  "last_sync_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "field_device_sync_states_pkey" PRIMARY KEY ("field_device_id")
);

CREATE UNIQUE INDEX "field_backup_requests_client_action_id_key" ON "field_backup_requests"("client_action_id");
CREATE UNIQUE INDEX "field_officer_safety_alerts_client_action_id_key" ON "field_officer_safety_alerts"("client_action_id");
CREATE UNIQUE INDEX "field_operational_events_officer_id_event_sequence_key" ON "field_operational_events"("officer_id", "event_sequence");
CREATE UNIQUE INDEX "field_patrol_events_client_action_id_key" ON "field_patrol_events"("client_action_id");
CREATE UNIQUE INDEX "field_checkpoint_observations_client_action_id_key" ON "field_checkpoint_observations"("client_action_id");

CREATE INDEX "field_backup_requests_agency_id_status_created_at_idx" ON "field_backup_requests"("agency_id", "status", "created_at");
CREATE INDEX "field_backup_requests_officer_id_status_idx" ON "field_backup_requests"("officer_id", "status");
CREATE INDEX "field_officer_safety_alerts_agency_id_status_created_at_idx" ON "field_officer_safety_alerts"("agency_id", "status", "created_at");
CREATE INDEX "field_operational_events_officer_id_occurred_at_idx" ON "field_operational_events"("officer_id", "occurred_at");
CREATE INDEX "field_patrol_events_patrol_session_id_occurred_at_idx" ON "field_patrol_events"("patrol_session_id", "occurred_at");
CREATE INDEX "field_checkpoint_observations_checkpoint_session_id_created_at_idx" ON "field_checkpoint_observations"("checkpoint_session_id", "created_at");
CREATE INDEX "field_device_sync_states_officer_id_idx" ON "field_device_sync_states"("officer_id");

ALTER TABLE "field_backup_requests" ADD CONSTRAINT "field_backup_requests_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_backup_requests" ADD CONSTRAINT "field_backup_requests_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_backup_requests" ADD CONSTRAINT "field_backup_requests_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_backup_requests" ADD CONSTRAINT "field_backup_requests_field_shift_id_fkey" FOREIGN KEY ("field_shift_id") REFERENCES "field_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_backup_requests" ADD CONSTRAINT "field_backup_requests_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_backup_requests" ADD CONSTRAINT "field_backup_requests_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "incident_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "field_officer_safety_alerts" ADD CONSTRAINT "field_officer_safety_alerts_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_officer_safety_alerts" ADD CONSTRAINT "field_officer_safety_alerts_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_officer_safety_alerts" ADD CONSTRAINT "field_officer_safety_alerts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "field_operational_events" ADD CONSTRAINT "field_operational_events_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "field_patrol_events" ADD CONSTRAINT "field_patrol_events_patrol_session_id_fkey" FOREIGN KEY ("patrol_session_id") REFERENCES "patrol_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_patrol_events" ADD CONSTRAINT "field_patrol_events_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "field_checkpoint_observations" ADD CONSTRAINT "field_checkpoint_observations_checkpoint_session_id_fkey" FOREIGN KEY ("checkpoint_session_id") REFERENCES "checkpoint_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_checkpoint_observations" ADD CONSTRAINT "field_checkpoint_observations_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_checkpoint_observations" ADD CONSTRAINT "field_checkpoint_observations_match_broadcast_id_fkey" FOREIGN KEY ("match_broadcast_id") REFERENCES "broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "field_device_sync_states" ADD CONSTRAINT "field_device_sync_states_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
