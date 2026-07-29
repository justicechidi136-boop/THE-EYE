-- Geo-Zone Threat Alert system

CREATE TYPE "DangerZoneStatus" AS ENUM (
  'PendingVerification',
  'ActiveCritical',
  'ActiveHigh',
  'ActiveModerate',
  'Contained',
  'Monitoring',
  'AllClear',
  'Expired',
  'CancelledFalseReport'
);

CREATE TYPE "SafetyAlertLevel" AS ENUM (
  'P1Immediate',
  'P2Serious',
  'P3Awareness',
  'P4AllClear'
);

CREATE TYPE "SafetyAlertState" AS ENUM (
  'Awareness',
  'Approaching',
  'Critical',
  'InsideDangerZone',
  'MovingAway',
  'Clear'
);

CREATE TYPE "SafetyAlertDeliveryStatus" AS ENUM (
  'Queued',
  'Sent',
  'Delivered',
  'Failed',
  'Suppressed',
  'Expired'
);

CREATE TABLE "danger_zones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "incident_id" UUID NOT NULL,
  "jurisdiction_id" UUID,
  "created_by_admin_id" UUID NOT NULL,
  "reviewed_by_admin_id" UUID,
  "status" "DangerZoneStatus" NOT NULL DEFAULT 'PendingVerification',
  "severity" "SafetyAlertLevel" NOT NULL DEFAULT 'P2Serious',
  "center_latitude" DECIMAL(9,6) NOT NULL,
  "center_longitude" DECIMAL(9,6) NOT NULL,
  "center_location" geography(Point,4326),
  "inner_radius_meters" INTEGER NOT NULL DEFAULT 200,
  "warning_radius_meters" INTEGER NOT NULL DEFAULT 1000,
  "outer_awareness_radius_meters" INTEGER NOT NULL DEFAULT 2000,
  "zone_area" geography(MultiPolygon,4326),
  "warning_area" geography(MultiPolygon,4326),
  "awareness_area" geography(MultiPolygon,4326),
  "activation_time" TIMESTAMPTZ(6),
  "expiry_time" TIMESTAMPTZ(6),
  "last_reviewed_at" TIMESTAMPTZ(6),
  "public_message" TEXT NOT NULL,
  "avoidance_instruction" TEXT NOT NULL,
  "safe_route_metadata" JSONB NOT NULL DEFAULT '{}',
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "verification_method" TEXT,
  "verified_at" TIMESTAMPTZ(6),
  "source_count" INTEGER NOT NULL DEFAULT 1,
  "trusted_source_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "country" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "lga" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "danger_zones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "danger_zones_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE,
  CONSTRAINT "danger_zones_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id") ON DELETE SET NULL,
  CONSTRAINT "danger_zones_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT,
  CONSTRAINT "danger_zones_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL
);

CREATE INDEX "danger_zones_incident_id_idx" ON "danger_zones"("incident_id");
CREATE INDEX "danger_zones_status_severity_expiry_time_idx" ON "danger_zones"("status", "severity", "expiry_time");
CREATE INDEX "danger_zones_country_state_lga_idx" ON "danger_zones"("country", "state", "lga");
CREATE INDEX "danger_zones_activation_time_idx" ON "danger_zones"("activation_time");
CREATE INDEX "danger_zones_center_location_idx" ON "danger_zones" USING GIST ("center_location");
CREATE INDEX "danger_zones_zone_area_idx" ON "danger_zones" USING GIST ("zone_area");
CREATE INDEX "danger_zones_warning_area_idx" ON "danger_zones" USING GIST ("warning_area");
CREATE INDEX "danger_zones_awareness_area_idx" ON "danger_zones" USING GIST ("awareness_area");

CREATE TABLE "danger_zone_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "danger_zone_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "change_reason" TEXT,
  "inner_radius_meters" INTEGER NOT NULL,
  "warning_radius_meters" INTEGER NOT NULL,
  "outer_awareness_radius_meters" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "danger_zone_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "danger_zone_versions_danger_zone_id_fkey" FOREIGN KEY ("danger_zone_id") REFERENCES "danger_zones"("id") ON DELETE CASCADE,
  CONSTRAINT "danger_zone_versions_danger_zone_id_version_key" UNIQUE ("danger_zone_id", "version")
);

CREATE TABLE "safety_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "danger_zone_id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "level" "SafetyAlertLevel" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "public_message" TEXT NOT NULL,
  "avoidance_instruction" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "activated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "safety_alerts_danger_zone_id_fkey" FOREIGN KEY ("danger_zone_id") REFERENCES "danger_zones"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alerts_dedupe_key_key" UNIQUE ("dedupe_key")
);

CREATE INDEX "safety_alerts_danger_zone_id_activated_at_idx" ON "safety_alerts"("danger_zone_id", "activated_at");
CREATE INDEX "safety_alerts_incident_id_idx" ON "safety_alerts"("incident_id");

CREATE TABLE "safety_alert_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "safety_alert_id" UUID NOT NULL,
  "user_id" UUID,
  "device_id" UUID,
  "alert_state" "SafetyAlertState" NOT NULL DEFAULT 'Awareness',
  "distance_meters" DECIMAL(10,2),
  "bearing_degrees" DECIMAL(6,2),
  "cooldown_until" TIMESTAMPTZ(6),
  "last_notified_at" TIMESTAMPTZ(6),
  "acknowledged_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_alert_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "safety_alert_recipients_safety_alert_id_fkey" FOREIGN KEY ("safety_alert_id") REFERENCES "safety_alerts"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alert_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alert_recipients_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alert_recipients_safety_alert_id_user_id_device_id_key" UNIQUE ("safety_alert_id", "user_id", "device_id")
);

CREATE INDEX "safety_alert_recipients_user_id_alert_state_idx" ON "safety_alert_recipients"("user_id", "alert_state");
CREATE INDEX "safety_alert_recipients_device_id_alert_state_idx" ON "safety_alert_recipients"("device_id", "alert_state");

CREATE TABLE "safety_alert_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "safety_alert_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "notification_id" UUID,
  "channel" TEXT NOT NULL DEFAULT 'watch_push',
  "status" "SafetyAlertDeliveryStatus" NOT NULL DEFAULT 'Queued',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "sent_at" TIMESTAMPTZ(6),
  "delivered_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "safety_alert_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "safety_alert_deliveries_safety_alert_id_fkey" FOREIGN KEY ("safety_alert_id") REFERENCES "safety_alerts"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alert_deliveries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "safety_alert_recipients"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alert_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL
);

CREATE INDEX "safety_alert_deliveries_safety_alert_id_status_idx" ON "safety_alert_deliveries"("safety_alert_id", "status");
CREATE INDEX "safety_alert_deliveries_recipient_id_status_idx" ON "safety_alert_deliveries"("recipient_id", "status");

CREATE TABLE "safety_alert_acknowledgements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "safety_alert_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "user_id" UUID,
  "device_id" UUID,
  "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "safety_alert_acknowledgements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "safety_alert_acknowledgements_safety_alert_id_fkey" FOREIGN KEY ("safety_alert_id") REFERENCES "safety_alerts"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alert_acknowledgements_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "safety_alert_recipients"("id") ON DELETE CASCADE,
  CONSTRAINT "safety_alert_acknowledgements_safety_alert_id_recipient_id_key" UNIQUE ("safety_alert_id", "recipient_id")
);

CREATE TABLE "device_geo_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "device_id" UUID,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "gps_location" geography(Point,4326),
  "accuracy_meters" DECIMAL(8,2),
  "speed_mps" DECIMAL(8,2),
  "heading_degrees" DECIMAL(6,2),
  "alert_state" "SafetyAlertState" NOT NULL DEFAULT 'Clear',
  "active_danger_zone_id" UUID,
  "last_distance_meters" DECIMAL(10,2),
  "last_evaluated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_heartbeat_at" TIMESTAMPTZ(6),
  "tracking_interval_ms" INTEGER NOT NULL DEFAULT 300000,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_geo_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_geo_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "device_geo_states_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE,
  CONSTRAINT "device_geo_states_user_id_device_id_key" UNIQUE ("user_id", "device_id")
);

CREATE INDEX "device_geo_states_active_danger_zone_id_idx" ON "device_geo_states"("active_danger_zone_id");
CREATE INDEX "device_geo_states_last_evaluated_at_idx" ON "device_geo_states"("last_evaluated_at");
CREATE INDEX "device_geo_states_gps_location_idx" ON "device_geo_states" USING GIST ("gps_location");

CREATE TABLE "zone_entry_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "danger_zone_id" UUID NOT NULL,
  "user_id" UUID,
  "device_id" UUID,
  "alert_state" "SafetyAlertState" NOT NULL,
  "distance_meters" DECIMAL(10,2),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "zone_entry_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "zone_entry_events_danger_zone_id_occurred_at_idx" ON "zone_entry_events"("danger_zone_id", "occurred_at");
CREATE INDEX "zone_entry_events_user_id_occurred_at_idx" ON "zone_entry_events"("user_id", "occurred_at");

CREATE TABLE "zone_exit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "danger_zone_id" UUID NOT NULL,
  "user_id" UUID,
  "device_id" UUID,
  "alert_state" "SafetyAlertState" NOT NULL,
  "distance_meters" DECIMAL(10,2),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "zone_exit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "zone_exit_events_danger_zone_id_occurred_at_idx" ON "zone_exit_events"("danger_zone_id", "occurred_at");
CREATE INDEX "zone_exit_events_user_id_occurred_at_idx" ON "zone_exit_events"("user_id", "occurred_at");

CREATE TABLE "all_clear_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "danger_zone_id" UUID NOT NULL,
  "issued_by_admin_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "delivered_count" INTEGER NOT NULL DEFAULT 0,
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "all_clear_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "all_clear_events_danger_zone_id_fkey" FOREIGN KEY ("danger_zone_id") REFERENCES "danger_zones"("id") ON DELETE CASCADE,
  CONSTRAINT "all_clear_events_issued_by_admin_id_fkey" FOREIGN KEY ("issued_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT
);

CREATE INDEX "all_clear_events_danger_zone_id_issued_at_idx" ON "all_clear_events"("danger_zone_id", "issued_at");
