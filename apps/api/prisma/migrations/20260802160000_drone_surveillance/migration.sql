-- Drone Surveillance module

CREATE TABLE "drone_devices" (
    "id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT,
    "serial_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "health_status" TEXT NOT NULL DEFAULT 'Healthy',
    "battery_level" INTEGER,
    "signal_strength" INTEGER,
    "firmware_version" TEXT,
    "flight_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "total_missions" INTEGER NOT NULL DEFAULT 0,
    "live_video_capable" BOOLEAN NOT NULL DEFAULT true,
    "last_latitude" DECIMAL(9,6),
    "last_longitude" DECIMAL(9,6),
    "last_gps_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drone_devices_device_id_key" ON "drone_devices"("device_id");
CREATE UNIQUE INDEX "drone_devices_serial_number_key" ON "drone_devices"("serial_number");
CREATE INDEX "drone_devices_status_is_active_idx" ON "drone_devices"("status", "is_active");

CREATE TABLE "drone_operators" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "callsign" TEXT,
    "operator_role" TEXT NOT NULL DEFAULT 'Operator',
    "certification_level" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_operators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drone_operators_admin_user_id_key" ON "drone_operators"("admin_user_id");
CREATE INDEX "drone_operators_operator_role_is_active_idx" ON "drone_operators"("operator_role", "is_active");

CREATE TABLE "drone_missions" (
    "id" UUID NOT NULL,
    "mission_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "priority" TEXT NOT NULL DEFAULT 'P3',
    "incident_id" UUID,
    "drone_id" UUID,
    "operator_id" UUID,
    "commander_id" UUID,
    "target_latitude" DECIMAL(9,6),
    "target_longitude" DECIMAL(9,6),
    "target_address" TEXT,
    "scheduled_at" TIMESTAMPTZ(6),
    "launched_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "live_video_session_id" UUID,
    "live_video_status" TEXT NOT NULL DEFAULT 'Offline',
    "correlation_id" TEXT,
    "created_by_admin_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_missions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drone_missions_mission_code_key" ON "drone_missions"("mission_code");
CREATE INDEX "drone_missions_status_scheduled_at_idx" ON "drone_missions"("status", "scheduled_at");
CREATE INDEX "drone_missions_incident_id_idx" ON "drone_missions"("incident_id");
CREATE INDEX "drone_missions_drone_id_status_idx" ON "drone_missions"("drone_id", "status");

CREATE TABLE "drone_gps_tracks" (
    "id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "altitude" DECIMAL(8,2),
    "heading" DECIMAL(8,2),
    "speed" DECIMAL(8,2),
    "accuracy" DECIMAL(8,2),
    "captured_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "drone_gps_tracks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drone_gps_tracks_mission_id_captured_at_idx" ON "drone_gps_tracks"("mission_id", "captured_at");

CREATE TABLE "drone_flight_logs" (
    "id" UUID NOT NULL,
    "mission_id" UUID,
    "drone_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_flight_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drone_flight_logs_drone_id_recorded_at_idx" ON "drone_flight_logs"("drone_id", "recorded_at");
CREATE INDEX "drone_flight_logs_mission_id_recorded_at_idx" ON "drone_flight_logs"("mission_id", "recorded_at");

CREATE TABLE "drone_evidence" (
    "id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "incident_id" UUID,
    "incident_media_id" UUID,
    "media_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bucket" TEXT,
    "object_key" TEXT,
    "file_hash" TEXT,
    "captured_at" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drone_evidence_mission_id_captured_at_idx" ON "drone_evidence"("mission_id", "captured_at");
CREATE INDEX "drone_evidence_incident_id_idx" ON "drone_evidence"("incident_id");

CREATE TABLE "drone_geofences" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "fence_type" TEXT NOT NULL DEFAULT 'Operational',
    "description" TEXT,
    "geometry" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_geofences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drone_geofences_fence_type_is_active_idx" ON "drone_geofences"("fence_type", "is_active");

CREATE TABLE "drone_no_fly_zones" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT,
    "geometry" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_no_fly_zones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drone_no_fly_zones_is_active_idx" ON "drone_no_fly_zones"("is_active");

CREATE TABLE "drone_health_snapshots" (
    "id" UUID NOT NULL,
    "drone_id" UUID NOT NULL,
    "battery_level" INTEGER,
    "motor_status" TEXT,
    "gps_fix" TEXT,
    "temperature" DECIMAL(5,2),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drone_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "drone_health_snapshots_drone_id_recorded_at_idx" ON "drone_health_snapshots"("drone_id", "recorded_at");

ALTER TABLE "drone_operators" ADD CONSTRAINT "drone_operators_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_missions" ADD CONSTRAINT "drone_missions_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_missions" ADD CONSTRAINT "drone_missions_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drone_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_missions" ADD CONSTRAINT "drone_missions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_missions" ADD CONSTRAINT "drone_missions_commander_id_fkey" FOREIGN KEY ("commander_id") REFERENCES "drone_operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_missions" ADD CONSTRAINT "drone_missions_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_gps_tracks" ADD CONSTRAINT "drone_gps_tracks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "drone_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_flight_logs" ADD CONSTRAINT "drone_flight_logs_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "drone_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_flight_logs" ADD CONSTRAINT "drone_flight_logs_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drone_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_evidence" ADD CONSTRAINT "drone_evidence_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "drone_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_evidence" ADD CONSTRAINT "drone_evidence_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_health_snapshots" ADD CONSTRAINT "drone_health_snapshots_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "drone_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
