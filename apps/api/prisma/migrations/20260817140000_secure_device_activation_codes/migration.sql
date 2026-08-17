-- Secure device activation-code lifecycle and duplicate-active-code protection.
-- Plaintext activation/pairing codes are never stored by this migration.

ALTER TYPE "FieldDeviceRegistrationStatus" ADD VALUE IF NOT EXISTS 'Deactivated';
ALTER TYPE "FieldDeviceRegistrationStatus" ADD VALUE IF NOT EXISTS 'Disabled';

ALTER TABLE "field_devices"
  ADD COLUMN IF NOT EXISTS "deactivation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "security_deactivated_at" TIMESTAMPTZ(6);

ALTER TABLE "smartwatch_devices"
  ADD COLUMN IF NOT EXISTS "deactivation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "security_deactivated_at" TIMESTAMPTZ(6);

ALTER TABLE "smartwatch_pairing_sessions"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
