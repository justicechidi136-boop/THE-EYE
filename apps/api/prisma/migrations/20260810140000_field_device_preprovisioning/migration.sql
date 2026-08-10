-- Field Device Pre-Provisioning + Permission Profiles + Secure QR Pairing

-- Provisioning lifecycle enums (kept independent of FieldDeviceRegistrationStatus)
CREATE TYPE "FieldProvisioningMode" AS ENUM ('SelfRegistration', 'PreProvisioned');
CREATE TYPE "FieldPreProvisionStatus" AS ENUM ('Draft', 'AwaitingPairing', 'Paired', 'AwaitingFinalApproval', 'Active', 'Cancelled', 'Expired');
CREATE TYPE "FieldActivationPolicy" AS ENUM ('AutoActivateOnPairing', 'RequireSupervisorFinalApproval');
CREATE TYPE "FieldPairingTokenStatus" AS ENUM ('Issued', 'Claimed', 'Completed', 'Expired', 'Revoked', 'Failed');

-- publicKey / installationIdHash become nullable so a pre-provisioned device can exist
-- unbound until pairing completes. The existing unique index on installation_id_hash
-- is preserved and Postgres unique indexes permit multiple NULLs.
ALTER TABLE "field_devices" ALTER COLUMN "public_key" DROP NOT NULL;
ALTER TABLE "field_devices" ALTER COLUMN "installation_id_hash" DROP NOT NULL;

ALTER TABLE "field_devices"
  ADD COLUMN "provisioning_mode" "FieldProvisioningMode" NOT NULL DEFAULT 'SelfRegistration',
  ADD COLUMN "provisioned_at" TIMESTAMPTZ(6),
  ADD COLUMN "provisioned_by_id" UUID,
  ADD COLUMN "permission_profile_id" UUID,
  ADD COLUMN "assigned_team_id" TEXT,
  ADD COLUMN "operational_role" TEXT,
  ADD COLUMN "device_mode" TEXT,
  ADD COLUMN "activation_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "review_at" TIMESTAMPTZ(6),
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "pre_provision_status" "FieldPreProvisionStatus",
  ADD COLUMN "activation_policy" "FieldActivationPolicy",
  ADD COLUMN "authority_snapshot" JSONB,
  ADD COLUMN "inventory_asset_ref" TEXT,
  ADD COLUMN "permission_overrides" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "permission_denies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "field_devices_provisioning_mode_pre_provision_status_idx" ON "field_devices"("provisioning_mode", "pre_provision_status");
CREATE INDEX "field_devices_permission_profile_id_idx" ON "field_devices"("permission_profile_id");

-- CreateTable
CREATE TABLE "field_permission_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "operational_role" TEXT,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "disabled_at" TIMESTAMPTZ(6),
    "disabled_by_id" UUID,
    "disabled_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_permission_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_permission_profiles_code_key" ON "field_permission_profiles"("code");
CREATE INDEX "field_permission_profiles_is_active_idx" ON "field_permission_profiles"("is_active");
CREATE INDEX "field_permission_profiles_operational_role_idx" ON "field_permission_profiles"("operational_role");

-- CreateTable
CREATE TABLE "field_device_pairing_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "field_device_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "short_code_hash" TEXT NOT NULL,
    "status" "FieldPairingTokenStatus" NOT NULL DEFAULT 'Issued',
    "issued_by_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "claimed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_id" UUID,
    "revoked_reason" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "claim_ip_hash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_device_pairing_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_device_pairing_tokens_token_hash_key" ON "field_device_pairing_tokens"("token_hash");
CREATE UNIQUE INDEX "field_device_pairing_tokens_short_code_hash_key" ON "field_device_pairing_tokens"("short_code_hash");
CREATE INDEX "field_device_pairing_tokens_field_device_id_status_idx" ON "field_device_pairing_tokens"("field_device_id", "status");
CREATE INDEX "field_device_pairing_tokens_expires_at_idx" ON "field_device_pairing_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_provisioned_by_id_fkey" FOREIGN KEY ("provisioned_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_permission_profile_id_fkey" FOREIGN KEY ("permission_profile_id") REFERENCES "field_permission_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "field_permission_profiles" ADD CONSTRAINT "field_permission_profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_permission_profiles" ADD CONSTRAINT "field_permission_profiles_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "field_permission_profiles" ADD CONSTRAINT "field_permission_profiles_disabled_by_id_fkey" FOREIGN KEY ("disabled_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "field_device_pairing_tokens" ADD CONSTRAINT "field_device_pairing_tokens_field_device_id_fkey" FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_device_pairing_tokens" ADD CONSTRAINT "field_device_pairing_tokens_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "field_device_pairing_tokens" ADD CONSTRAINT "field_device_pairing_tokens_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
