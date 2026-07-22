-- Sprint 6: assignment operational phases, location metadata, live projection
ALTER TYPE "IncidentAssignmentStatus" ADD VALUE IF NOT EXISTS 'EnRoute';
ALTER TYPE "IncidentAssignmentStatus" ADD VALUE IF NOT EXISTS 'InProgress';

ALTER TABLE "incident_location_updates"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "responder_location_updates"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "incidents"
  ADD COLUMN IF NOT EXISTS "live_location_updated_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "live_location_stale" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "incidents_live_location_updated_at_idx" ON "incidents"("live_location_updated_at");
