ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Scheduled';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'DispatchQueued';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Dispatching';
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'Failed';

ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "dispatch_failure_reason" TEXT;
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "dispatch_queued_at" TIMESTAMPTZ(6);
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "dispatch_started_at" TIMESTAMPTZ(6);
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "dispatch_completed_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "broadcasts_status_scheduled_at_idx" ON "broadcasts"("status", "scheduled_at");

CREATE TABLE IF NOT EXISTS "broadcast_reads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "broadcast_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "broadcast_reads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "broadcast_reads_broadcast_id_user_id_key" UNIQUE ("broadcast_id", "user_id"),
  CONSTRAINT "broadcast_reads_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "broadcast_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "broadcast_reads_user_id_read_at_idx" ON "broadcast_reads"("user_id", "read_at");
