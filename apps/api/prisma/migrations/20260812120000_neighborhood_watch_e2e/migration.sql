-- Neighborhood Watch E2E: presence, alerts, pinned safety, feed types, escalation linkage

ALTER TYPE "CommunityPostType" ADD VALUE IF NOT EXISTS 'SafetyTip';
ALTER TYPE "CommunityPostType" ADD VALUE IF NOT EXISTS 'Discussion';
ALTER TYPE "CommunityPostType" ADD VALUE IF NOT EXISTS 'LocalWarning';
ALTER TYPE "CommunityPostType" ADD VALUE IF NOT EXISTS 'RoadHazard';
ALTER TYPE "CommunityPostType" ADD VALUE IF NOT EXISTS 'CommunityQuestion';

DO $$ BEGIN
  CREATE TYPE "CommunityHazardStatus" AS ENUM ('Open', 'Verified', 'Ongoing', 'Resolved', 'Dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityAlertAudience" AS ENUM ('EntireCommunity', 'SelectedZone', 'Radius500m', 'Radius1km', 'WatchTeamOnly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityAlertStatus" AS ENUM ('Draft', 'Active', 'Expired', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityPresenceMode" AS ENUM ('LocationParticipant', 'HomePreference');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "PatrolStatus" ADD VALUE IF NOT EXISTS 'Paused';

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "home_community_id" UUID;

DO $$ BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_home_community_id_fkey"
    FOREIGN KEY ("home_community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "profiles_home_community_id_idx" ON "profiles"("home_community_id");

ALTER TABLE "community_posts"
  ADD COLUMN IF NOT EXISTS "hazard_status" "CommunityHazardStatus",
  ADD COLUMN IF NOT EXISTS "escalated_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "escalated_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "community_posts_community_id_type_created_at_idx"
  ON "community_posts"("community_id", "type", "created_at");
CREATE INDEX IF NOT EXISTS "community_posts_hazard_status_idx"
  ON "community_posts"("hazard_status");

ALTER TABLE "community_post_comments"
  ALTER COLUMN "body" SET DEFAULT '',
  ADD COLUMN IF NOT EXISTS "media_type" TEXT,
  ADD COLUMN IF NOT EXISTS "bucket" TEXT,
  ADD COLUMN IF NOT EXISTS "object_key" TEXT,
  ADD COLUMN IF NOT EXISTS "content_type" TEXT,
  ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "community_presence" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "community_id" UUID NOT NULL,
  "mode" "CommunityPresenceMode" NOT NULL DEFAULT 'LocationParticipant',
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "accuracy_m" DECIMAL(8,2),
  "captured_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_presence_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "community_presence"
    ADD CONSTRAINT "community_presence_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "community_presence"
    ADD CONSTRAINT "community_presence_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "community_presence_user_id_community_id_mode_key"
  ON "community_presence"("user_id", "community_id", "mode");
CREATE INDEX IF NOT EXISTS "community_presence_community_id_expires_at_idx"
  ON "community_presence"("community_id", "expires_at");
CREATE INDEX IF NOT EXISTS "community_presence_user_id_updated_at_idx"
  ON "community_presence"("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "community_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "community_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" "CommunityAlertAudience" NOT NULL DEFAULT 'EntireCommunity',
  "status" "CommunityAlertStatus" NOT NULL DEFAULT 'Active',
  "radius_m" INTEGER,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_alerts_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "community_alerts"
    ADD CONSTRAINT "community_alerts_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "community_alerts"
    ADD CONSTRAINT "community_alerts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "community_alerts_community_id_status_created_at_idx"
  ON "community_alerts"("community_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "community_pinned_safety_info" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "community_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_pinned_safety_info_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "community_pinned_safety_info"
    ADD CONSTRAINT "community_pinned_safety_info_community_id_fkey"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "community_pinned_safety_info_community_id_active_sort_order_idx"
  ON "community_pinned_safety_info"("community_id", "active", "sort_order");
