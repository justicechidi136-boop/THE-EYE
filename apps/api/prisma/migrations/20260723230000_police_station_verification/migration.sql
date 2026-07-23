-- Verified police-station metadata and Google Place ID references (no restricted Places content).

ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "station_type" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "lga" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "official_phone" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "emergency_phone" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "source_reference" TEXT;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ(6);
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "verified_by" UUID;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'Unverified';
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "last_reviewed_at" TIMESTAMPTZ(6);
ALTER TABLE "police_stations" ADD COLUMN IF NOT EXISTS "google_place_id" TEXT;

UPDATE "police_stations" ps
   SET "station_type" = COALESCE(ps."station_type", ps."agency_type"),
       "country" = COALESCE(ps."country", j."country"),
       "state" = COALESCE(ps."state", j."state"),
       "lga" = COALESCE(ps."lga", j."lga"),
       "official_phone" = COALESCE(ps."official_phone", ps."phone"),
       "verification_status" = CASE
         WHEN ps."verification_status" = 'Unverified' AND ps."source" IS NULL THEN 'VerifiedOfficial'
         ELSE ps."verification_status"
       END,
       "source" = COALESCE(ps."source", 'dev-seed'),
       "source_reference" = COALESCE(ps."source_reference", 'prisma-seed'),
       "verified_at" = COALESCE(ps."verified_at", NOW())
  FROM "jurisdictions" j
 WHERE j."id" = ps."jurisdiction_id";

CREATE TABLE IF NOT EXISTS "google_place_references" (
    "place_id" TEXT NOT NULL,
    "last_fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "google_place_references_pkey" PRIMARY KEY ("place_id")
);

CREATE INDEX IF NOT EXISTS "police_stations_verification_status_is_active_idx"
  ON "police_stations"("verification_status", "is_active");

CREATE INDEX IF NOT EXISTS "police_stations_state_lga_idx"
  ON "police_stations"("state", "lga");

CREATE UNIQUE INDEX IF NOT EXISTS "police_stations_google_place_id_key"
  ON "police_stations"("google_place_id")
  WHERE "google_place_id" IS NOT NULL;
