-- Phase 14: Citizen broadcast system extensions

ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Active';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Updated';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Resolved';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Suspended';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'DeletedByAdmin';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'WithdrawnByAuthor';

CREATE TYPE "BroadcastAuthorType" AS ENUM ('Citizen', 'Admin');

ALTER TABLE "broadcasts"
  ALTER COLUMN "creator_admin_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "creator_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "author_type" "BroadcastAuthorType" NOT NULL DEFAULT 'Admin',
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "lga" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "client_broadcast_id" TEXT,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "verified_by_admin_id" UUID,
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "suspended_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspended_by_admin_id" UUID,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "deleted_by_admin_id" UUID,
  ADD COLUMN IF NOT EXISTS "withdrawn_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "withdrawn_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "resolved_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "resolved_by_admin_id" UUID,
  ADD COLUMN IF NOT EXISTS "duplicate_of_id" UUID,
  ADD COLUMN IF NOT EXISTS "comments_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "admin_verified" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS "broadcasts_creator_user_client_broadcast_id_key"
  ON "broadcasts" ("creator_user_id", "client_broadcast_id")
  WHERE "client_broadcast_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "broadcasts_country_status_idx" ON "broadcasts" ("country", "status");
CREATE INDEX IF NOT EXISTS "broadcasts_author_type_status_idx" ON "broadcasts" ("author_type", "status");

ALTER TABLE "broadcasts"
  ADD CONSTRAINT "broadcasts_creator_user_id_fkey"
  FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "broadcasts"
  ADD CONSTRAINT "broadcasts_verified_by_admin_id_fkey"
  FOREIGN KEY ("verified_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "broadcasts"
  ADD CONSTRAINT "broadcasts_duplicate_of_id_fkey"
  FOREIGN KEY ("duplicate_of_id") REFERENCES "broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "broadcast_comments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "broadcast_id" UUID NOT NULL,
  "author_user_id" UUID,
  "author_admin_id" UUID,
  "parent_id" UUID,
  "body" TEXT NOT NULL,
  "is_official" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_pinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "hidden_at" TIMESTAMPTZ(6),
  "hidden_by_admin_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "broadcast_comments_broadcast_id_created_at_idx"
  ON "broadcast_comments" ("broadcast_id", "created_at");

ALTER TABLE "broadcast_comments"
  ADD CONSTRAINT "broadcast_comments_broadcast_id_fkey"
  FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broadcast_comments"
  ADD CONSTRAINT "broadcast_comments_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "broadcast_comments"
  ADD CONSTRAINT "broadcast_comments_author_admin_id_fkey"
  FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "broadcast_comments"
  ADD CONSTRAINT "broadcast_comments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "broadcast_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "broadcast_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "broadcast_id" UUID NOT NULL,
  "reporter_user_id" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Open',
  "reviewed_by_admin_id" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "broadcast_reports_broadcast_id_status_idx"
  ON "broadcast_reports" ("broadcast_id", "status");

ALTER TABLE "broadcast_reports"
  ADD CONSTRAINT "broadcast_reports_broadcast_id_fkey"
  FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broadcast_reports"
  ADD CONSTRAINT "broadcast_reports_reporter_user_id_fkey"
  FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
