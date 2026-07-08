ALTER TABLE "smartwatch_devices"
  ADD COLUMN IF NOT EXISTS "serial_number" TEXT,
  ADD COLUMN IF NOT EXISTS "imei" TEXT,
  ADD COLUMN IF NOT EXISTS "eid" TEXT,
  ADD COLUMN IF NOT EXISTS "sim_number" TEXT,
  ADD COLUMN IF NOT EXISTS "device_certificate" TEXT,
  ADD COLUMN IF NOT EXISTS "public_key" TEXT,
  ADD COLUMN IF NOT EXISTS "preferred_mode" TEXT NOT NULL DEFAULT 'PairedPhone',
  ADD COLUMN IF NOT EXISTS "failover_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "pairing_method" TEXT NOT NULL DEFAULT 'PairingCode',
  ADD COLUMN IF NOT EXISTS "pairing_code_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "signal_strength" INTEGER,
  ADD COLUMN IF NOT EXISTS "firmware_signature_status" TEXT NOT NULL DEFAULT 'Unknown',
  ADD COLUMN IF NOT EXISTS "is_online" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "remote_disabled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "remote_wiped_at" TIMESTAMPTZ;

ALTER TABLE "sos_events"
  ADD COLUMN IF NOT EXISTS "emergency_mode" TEXT NOT NULL DEFAULT 'NormalSOS',
  ADD COLUMN IF NOT EXISTS "battery_level" INTEGER,
  ADD COLUMN IF NOT EXISTS "signal_strength" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "smartwatch_devices_serial_number_key" ON "smartwatch_devices"("serial_number") WHERE "serial_number" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "smartwatch_devices_imei_key" ON "smartwatch_devices"("imei") WHERE "imei" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "smartwatch_devices_eid_key" ON "smartwatch_devices"("eid") WHERE "eid" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "smartwatch_devices_online_last_seen_idx" ON "smartwatch_devices"("is_online", "last_seen_at");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_preferred_mode_idx" ON "smartwatch_devices"("preferred_mode", "connectivity_mode");

CREATE TABLE IF NOT EXISTS "smartwatch_offline_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processed_at" TIMESTAMPTZ,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  CONSTRAINT "smartwatch_offline_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "smartwatch_offline_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "smartwatch_firmware_releases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "release_notes" TEXT,
  "download_url" TEXT NOT NULL,
  "file_hash" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "published_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "smartwatch_firmware_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "smartwatch_firmware_updates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "release_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Scheduled',
  "scheduled_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "rollback_of_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "smartwatch_firmware_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "smartwatch_firmware_updates_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "smartwatch_firmware_updates_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "smartwatch_firmware_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "smartwatch_firmware_releases_version_key" ON "smartwatch_firmware_releases"("version");
CREATE INDEX IF NOT EXISTS "smartwatch_offline_events_device_occurred_idx" ON "smartwatch_offline_events"("device_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "smartwatch_offline_events_status_uploaded_idx" ON "smartwatch_offline_events"("status", "uploaded_at");
CREATE INDEX IF NOT EXISTS "smartwatch_firmware_releases_status_published_idx" ON "smartwatch_firmware_releases"("status", "published_at");
CREATE INDEX IF NOT EXISTS "smartwatch_firmware_updates_device_status_idx" ON "smartwatch_firmware_updates"("device_id", "status");
CREATE INDEX IF NOT EXISTS "smartwatch_firmware_updates_release_status_idx" ON "smartwatch_firmware_updates"("release_id", "status");

INSERT INTO "smartwatch_firmware_releases" ("version", "title", "release_notes", "download_url", "file_hash", "signature", "status", "published_at")
VALUES ('1.0.1', 'Emergency failover baseline', 'Adds paired-to-standalone failover, signed firmware checks, and emergency tracking support.', 's3://the-eye/firmware/watch/1.0.1.bin', 'sha256:seed-firmware-101', 'ed25519:seed-signature', 'Published', now())
ON CONFLICT ("version") DO NOTHING;
