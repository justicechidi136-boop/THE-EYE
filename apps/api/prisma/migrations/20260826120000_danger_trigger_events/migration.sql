CREATE TYPE "DangerEventState" AS ENUM ('POTENTIAL', 'ACTIVE', 'VERIFIED', 'RESOLVED', 'FALSE_ALARM');
CREATE TYPE "DangerEventSourceType" AS ENUM ('LIVE_VOICE', 'USER_REPORT', 'AI_SIGNAL');

CREATE TABLE "danger_events" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "initiator_user_id" UUID,
  "source_type" "DangerEventSourceType" NOT NULL,
  "state" "DangerEventState" NOT NULL DEFAULT 'ACTIVE',
  "severity" "DangerLevel" NOT NULL DEFAULT 'CRITICAL',
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "accuracy_meters" DECIMAL(8,2),
  "location_source" TEXT NOT NULL,
  "location_captured_at" TIMESTAMPTZ(6) NOT NULL,
  "area_name" TEXT,
  "effective_radius_meters" INTEGER NOT NULL DEFAULT 1000,
  "max_radius_meters" INTEGER NOT NULL DEFAULT 4000,
  "live_voice_session_id" UUID,
  "cluster_key" TEXT,
  "live_voice_ended_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" TEXT,
  "resolved_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "danger_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "danger_event_signals" (
  "id" UUID NOT NULL,
  "danger_event_id" UUID NOT NULL,
  "source_type" "DangerEventSourceType" NOT NULL,
  "source_id" TEXT NOT NULL,
  "incident_id" UUID,
  "live_voice_session_id" UUID,
  "initiator_user_id" UUID,
  "category" "DangerCategory",
  "severity" "DangerLevel" NOT NULL,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "danger_event_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "danger_events_incident_id_key" ON "danger_events"("incident_id");
CREATE UNIQUE INDEX "danger_events_live_voice_session_id_key" ON "danger_events"("live_voice_session_id");
CREATE INDEX "danger_events_state_created_at_idx" ON "danger_events"("state", "created_at");
CREATE INDEX "danger_events_cluster_key_created_at_idx" ON "danger_events"("cluster_key", "created_at");
CREATE INDEX "danger_events_latitude_longitude_idx" ON "danger_events"("latitude", "longitude");
CREATE UNIQUE INDEX "danger_event_signals_source_type_source_id_key" ON "danger_event_signals"("source_type", "source_id");
CREATE INDEX "danger_event_signals_danger_event_id_occurred_at_idx" ON "danger_event_signals"("danger_event_id", "occurred_at");
CREATE INDEX "danger_event_signals_incident_id_idx" ON "danger_event_signals"("incident_id");

ALTER TABLE "danger_events" ADD CONSTRAINT "danger_events_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "danger_events" ADD CONSTRAINT "danger_events_initiator_user_id_fkey"
  FOREIGN KEY ("initiator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "danger_events" ADD CONSTRAINT "danger_events_live_voice_session_id_fkey"
  FOREIGN KEY ("live_voice_session_id") REFERENCES "live_video_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "danger_event_signals" ADD CONSTRAINT "danger_event_signals_danger_event_id_fkey"
  FOREIGN KEY ("danger_event_id") REFERENCES "danger_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
