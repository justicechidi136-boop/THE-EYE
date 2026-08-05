-- Emergency user journey Phase 2: lifecycle states and resolution metadata.

CREATE TYPE "ResolutionSource" AS ENUM (
  'Agency',
  'Dispatcher',
  'Administrator',
  'Reporter',
  'Community',
  'SystemReview'
);

ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'UnderControl';
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'CancellationRequested';
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'CancelledByReporter';
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'ExpiredAfterReview';

ALTER TABLE "incidents"
  ADD COLUMN IF NOT EXISTS "resolution_source" "ResolutionSource",
  ADD COLUMN IF NOT EXISTS "resolved_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "resolution_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancellation_requested_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancellation_requested_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "status_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "last_trusted_update_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "closure_review_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "idx_incidents_reporter_status" ON "incidents" ("reporter_id", "status");
CREATE INDEX IF NOT EXISTS "idx_incidents_status_updated_at" ON "incidents" ("status", "updated_at");
CREATE INDEX IF NOT EXISTS "idx_incidents_cancellation_requested_at" ON "incidents" ("cancellation_requested_at");
CREATE INDEX IF NOT EXISTS "idx_incidents_closure_review_at" ON "incidents" ("closure_review_at");
