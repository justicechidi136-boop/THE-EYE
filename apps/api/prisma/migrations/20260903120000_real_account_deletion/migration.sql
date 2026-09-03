ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'Deleted';

ALTER TABLE "users"
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6),
  ADD COLUMN "deletion_retention_version" TEXT;

CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
