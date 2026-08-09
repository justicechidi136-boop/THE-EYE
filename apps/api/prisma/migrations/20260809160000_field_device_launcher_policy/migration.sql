-- Field Operations tablet launcher / managed-kiosk device policy
CREATE TABLE "field_device_launcher_policies" (
    "field_device_id" UUID NOT NULL,
    "device_mode" TEXT NOT NULL DEFAULT 'standard',
    "launcher_enabled" BOOLEAN NOT NULL DEFAULT false,
    "kiosk_enabled" BOOLEAN NOT NULL DEFAULT false,
    "approved_apps" JSONB NOT NULL DEFAULT '[]',
    "settings_access_level" TEXT NOT NULL DEFAULT 'none',
    "maintenance_mode_allowed" BOOLEAN NOT NULL DEFAULT false,
    "emergency_dialer_allowed" BOOLEAN NOT NULL DEFAULT true,
    "browser_allowed" BOOLEAN NOT NULL DEFAULT true,
    "screenshots_allowed" BOOLEAN NOT NULL DEFAULT true,
    "usb_policy" TEXT NOT NULL DEFAULT 'allow',
    "auto_lock_minutes" INTEGER NOT NULL DEFAULT 15,
    "visible_modules" JSONB NOT NULL DEFAULT '[]',
    "role" TEXT NOT NULL DEFAULT 'officer',
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_device_launcher_policies_pkey" PRIMARY KEY ("field_device_id")
);

CREATE INDEX "field_device_launcher_policies_device_mode_idx"
  ON "field_device_launcher_policies"("device_mode");

ALTER TABLE "field_device_launcher_policies"
  ADD CONSTRAINT "field_device_launcher_policies_field_device_id_fkey"
  FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "field_device_launcher_policies"
  ADD CONSTRAINT "field_device_launcher_policies_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
