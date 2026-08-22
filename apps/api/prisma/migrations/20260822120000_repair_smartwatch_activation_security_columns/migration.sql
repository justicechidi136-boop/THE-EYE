ALTER TABLE "smartwatch_devices"
  ADD COLUMN IF NOT EXISTS "failed_activation_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "first_failed_activation_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_failed_activation_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "activation_status" TEXT NOT NULL DEFAULT 'USABLE',
  ADD COLUMN IF NOT EXISTS "activation_locked_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "activation_lock_reason" TEXT;

CREATE INDEX IF NOT EXISTS "smartwatch_devices_activation_status_idx"
  ON "smartwatch_devices"("activation_status");
