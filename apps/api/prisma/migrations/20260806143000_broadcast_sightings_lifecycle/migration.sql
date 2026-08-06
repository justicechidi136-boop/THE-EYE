CREATE TABLE IF NOT EXISTS "broadcast_sightings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "broadcast_id" UUID NOT NULL,
  "reporter_user_id" UUID NOT NULL,
  "observed_at" TIMESTAMPTZ(6),
  "latitude" DECIMAL(9, 6),
  "longitude" DECIMAL(9, 6),
  "approximate_area" TEXT,
  "description" TEXT NOT NULL,
  "confidence" TEXT,
  "anonymous_public" BOOLEAN NOT NULL DEFAULT FALSE,
  "direction_of_travel" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_sightings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "broadcast_sightings_broadcast_id_created_at_idx"
  ON "broadcast_sightings" ("broadcast_id", "created_at");

ALTER TABLE "broadcast_sightings"
  ADD CONSTRAINT "broadcast_sightings_broadcast_id_fkey"
  FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broadcast_sightings"
  ADD CONSTRAINT "broadcast_sightings_reporter_user_id_fkey"
  FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_reports_broadcast_reporter_reason_key"
  ON "broadcast_reports" ("broadcast_id", "reporter_user_id", "reason")
  WHERE "status" = 'Open';
