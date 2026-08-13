-- Neighborhood Watch Dynamic Public Area: posts may target mapped communities OR geographic buckets.

CREATE TYPE "CommunityPostTargetType" AS ENUM ('COMMUNITY', 'DYNAMIC_AREA');

ALTER TABLE "community_posts"
  ALTER COLUMN "community_id" DROP NOT NULL;

ALTER TABLE "community_posts"
  ADD COLUMN "target_type" "CommunityPostTargetType" NOT NULL DEFAULT 'COMMUNITY',
  ADD COLUMN "dynamic_area_key" TEXT,
  ADD COLUMN "area_country" TEXT,
  ADD COLUMN "area_state" TEXT,
  ADD COLUMN "area_lga" TEXT,
  ADD COLUMN "area_city" TEXT,
  ADD COLUMN "area_label" TEXT;

UPDATE "community_posts"
SET "target_type" = 'COMMUNITY'
WHERE "community_id" IS NOT NULL;

ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_target_xor_chk"
  CHECK (
    (
      "target_type" = 'COMMUNITY'
      AND "community_id" IS NOT NULL
      AND "dynamic_area_key" IS NULL
    )
    OR (
      "target_type" = 'DYNAMIC_AREA'
      AND "community_id" IS NULL
      AND "dynamic_area_key" IS NOT NULL
    )
  );

CREATE INDEX "community_posts_dynamic_area_key_created_at_idx"
  ON "community_posts" ("dynamic_area_key", "created_at");

CREATE INDEX "community_posts_target_type_created_at_idx"
  ON "community_posts" ("target_type", "created_at");

CREATE INDEX "community_posts_area_country_area_state_area_lga_created_at_idx"
  ON "community_posts" ("area_country", "area_state", "area_lga", "created_at");

CREATE TABLE "nw_dynamic_area_presence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "area_key" TEXT NOT NULL,
  "area_country" TEXT NOT NULL,
  "area_state" TEXT,
  "area_lga" TEXT,
  "area_city" TEXT,
  "area_label" TEXT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "accuracy_m" DECIMAL(8,2),
  "captured_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nw_dynamic_area_presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nw_dynamic_area_presence_user_id_area_key_key"
  ON "nw_dynamic_area_presence" ("user_id", "area_key");

CREATE INDEX "nw_dynamic_area_presence_area_key_expires_at_idx"
  ON "nw_dynamic_area_presence" ("area_key", "expires_at");

CREATE INDEX "nw_dynamic_area_presence_user_id_updated_at_idx"
  ON "nw_dynamic_area_presence" ("user_id", "updated_at");

ALTER TABLE "nw_dynamic_area_presence"
  ADD CONSTRAINT "nw_dynamic_area_presence_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_content_reports"
  ALTER COLUMN "community_id" DROP NOT NULL;

ALTER TABLE "community_content_reports"
  ADD COLUMN "dynamic_area_key" TEXT;

CREATE INDEX "community_content_reports_dynamic_area_key_status_created_at_idx"
  ON "community_content_reports" ("dynamic_area_key", "status", "created_at");
