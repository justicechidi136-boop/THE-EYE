-- CreateEnum
CREATE TYPE "FieldDeviceRegistrationStatus" AS ENUM ('PendingApproval', 'Active', 'Suspended', 'Lost', 'Revoked', 'Retired');

-- CreateTable
CREATE TABLE "field_device_registration_challenges" (
    "id" UUID NOT NULL,
    "challenge_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_device_registration_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_devices" (
    "id" UUID NOT NULL,
    "public_device_id" TEXT NOT NULL,
    "device_credential_hash" TEXT,
    "public_key" TEXT NOT NULL,
    "assigned_user_id" UUID,
    "agency_id" UUID,
    "assigned_unit_id" UUID,
    "country_code" TEXT,
    "state_code" TEXT,
    "lga_code" TEXT,
    "device_name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "android_version" TEXT,
    "app_version" TEXT,
    "build_number" TEXT,
    "serial_hash" TEXT,
    "installation_id_hash" TEXT NOT NULL,
    "registration_status" "FieldDeviceRegistrationStatus" NOT NULL DEFAULT 'PendingApproval',
    "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_id" UUID,
    "last_seen_at" TIMESTAMPTZ(6),
    "last_authenticated_at" TIMESTAMPTZ(6),
    "last_known_latitude" DECIMAL(9,6),
    "last_known_longitude" DECIMAL(9,6),
    "last_location_accuracy" DOUBLE PRECISION,
    "last_location_at" TIMESTAMPTZ(6),
    "battery_level" INTEGER,
    "charging_state" TEXT,
    "network_type" TEXT,
    "notification_permission" TEXT,
    "location_permission" TEXT,
    "camera_permission" TEXT,
    "microphone_permission" TEXT,
    "is_root_risk_detected" BOOLEAN NOT NULL DEFAULT false,
    "is_lost" BOOLEAN NOT NULL DEFAULT false,
    "lost_at" TIMESTAMPTZ(6),
    "lost_reason" TEXT,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by_id" UUID,
    "revoke_reason" TEXT,
    "requires_re_pair" BOOLEAN NOT NULL DEFAULT false,
    "requires_repair" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 1,
    "package_name" TEXT,
    "app_environment" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_device_sessions" (
    "id" UUID NOT NULL,
    "field_device_id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "token_version" INTEGER NOT NULL,
    "locked_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_device_registration_challenges_challenge_hash_key" ON "field_device_registration_challenges"("challenge_hash");
CREATE INDEX "field_device_registration_challenges_expires_at_idx" ON "field_device_registration_challenges"("expires_at");
CREATE UNIQUE INDEX "field_devices_public_device_id_key" ON "field_devices"("public_device_id");
CREATE UNIQUE INDEX "field_devices_installation_id_hash_key" ON "field_devices"("installation_id_hash");
CREATE INDEX "field_devices_assigned_user_id_registration_status_idx" ON "field_devices"("assigned_user_id", "registration_status");
CREATE INDEX "field_devices_agency_id_registration_status_idx" ON "field_devices"("agency_id", "registration_status");
CREATE INDEX "field_devices_assigned_unit_id_idx" ON "field_devices"("assigned_unit_id");
CREATE INDEX "field_devices_last_seen_at_idx" ON "field_devices"("last_seen_at");
CREATE INDEX "field_devices_is_lost_idx" ON "field_devices"("is_lost");
CREATE INDEX "field_devices_is_revoked_idx" ON "field_devices"("is_revoked");
CREATE UNIQUE INDEX "field_device_sessions_session_id_key" ON "field_device_sessions"("session_id");
CREATE UNIQUE INDEX "field_device_sessions_refresh_token_hash_key" ON "field_device_sessions"("refresh_token_hash");
CREATE INDEX "field_device_sessions_field_device_id_revoked_at_idx" ON "field_device_sessions"("field_device_id", "revoked_at");
CREATE INDEX "field_device_sessions_admin_user_id_revoked_at_idx" ON "field_device_sessions"("admin_user_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_assigned_unit_id_fkey" FOREIGN KEY ("assigned_unit_id") REFERENCES "response_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_device_sessions" ADD CONSTRAINT "field_device_sessions_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_device_sessions" ADD CONSTRAINT "field_device_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
