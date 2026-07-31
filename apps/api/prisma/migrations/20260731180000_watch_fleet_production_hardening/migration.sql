-- Watch fleet production hardening: export jobs + partial indexes for aggregate queries

CREATE TABLE IF NOT EXISTS "watch_export_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "requested_by_admin_id" UUID NOT NULL,
  "actor_role" TEXT,
  "geography_scope" JSONB NOT NULL DEFAULT '{}',
  "filters" JSONB NOT NULL DEFAULT '{}',
  "correlation_id" TEXT NOT NULL,
  "mask_sensitive" BOOLEAN NOT NULL DEFAULT true,
  "total_rows" INTEGER,
  "processed_rows" INTEGER NOT NULL DEFAULT 0,
  "success_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "progress_percentage" INTEGER NOT NULL DEFAULT 0,
  "storage_key" TEXT,
  "storage_provider" TEXT,
  "bucket" TEXT,
  "content_type" TEXT,
  "checksum" TEXT,
  "upload_id" TEXT,
  "local_file_path" TEXT,
  "file_size_bytes" INTEGER,
  "failure_reason" TEXT,
  "deletion_failure_reason" TEXT,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "watch_export_jobs_status_created_at_idx" ON "watch_export_jobs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "watch_export_jobs_requested_by_admin_id_idx" ON "watch_export_jobs"("requested_by_admin_id");
CREATE INDEX IF NOT EXISTS "watch_export_jobs_correlation_id_idx" ON "watch_export_jobs"("correlation_id");
CREATE INDEX IF NOT EXISTS "watch_export_jobs_expires_at_idx" ON "watch_export_jobs"("expires_at");

CREATE INDEX IF NOT EXISTS "smartwatch_devices_replacement_pending_idx"
  ON "smartwatch_devices"("ownership_status")
  WHERE "ownership_status" = 'REPLACEMENT_PENDING';

CREATE INDEX IF NOT EXISTS "smartwatch_devices_low_battery_idx"
  ON "smartwatch_devices"("battery_level")
  WHERE "battery_level" IS NOT NULL AND "battery_level" <= 20;

CREATE INDEX IF NOT EXISTS "smartwatch_devices_active_online_idx"
  ON "smartwatch_devices"("is_online", "last_seen_at")
  WHERE "ownership_status" NOT IN ('RETIRED', 'LOST_OR_STOLEN');
