-- Watch ownership and fleet management schema

ALTER TABLE "smartwatch_devices" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "smartwatch_devices"
  ADD COLUMN IF NOT EXISTS "manufacturer" TEXT,
  ADD COLUMN IF NOT EXISTS "app_version" TEXT,
  ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_known_state" TEXT,
  ADD COLUMN IF NOT EXISTS "last_known_lga" TEXT,
  ADD COLUMN IF NOT EXISTS "last_sos_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_emergency_alert_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_live_video_session_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "current_owner_type" TEXT NOT NULL DEFAULT 'UNASSIGNED_INVENTORY',
  ADD COLUMN IF NOT EXISTS "current_owner_id" UUID,
  ADD COLUMN IF NOT EXISTS "current_assignee_id" UUID,
  ADD COLUMN IF NOT EXISTS "current_organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "current_department_id" UUID,
  ADD COLUMN IF NOT EXISTS "current_inventory_location_id" UUID,
  ADD COLUMN IF NOT EXISTS "ownership_status" TEXT NOT NULL DEFAULT 'UNASSIGNED_INVENTORY',
  ADD COLUMN IF NOT EXISTS "assignment_status" TEXT NOT NULL DEFAULT 'UNASSIGNED',
  ADD COLUMN IF NOT EXISTS "inventory_status" TEXT NOT NULL DEFAULT 'IN_STOCK';

-- Backfill existing paired devices as PERSON_OWNED
UPDATE "smartwatch_devices"
SET
  "current_owner_type" = 'PERSON',
  "current_owner_id" = "user_id",
  "current_assignee_id" = "user_id",
  "ownership_status" = 'PERSON_OWNED',
  "assignment_status" = 'ASSIGNED',
  "inventory_status" = 'DEPLOYED'
WHERE "user_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "watch_organizations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "lga" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "phone" TEXT,
  "email" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "watch_departments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "watch_inventory_locations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "location_type" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "state" TEXT,
  "lga" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_inventory_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "watch_ownership_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "owner_type" TEXT NOT NULL,
  "owner_person_id" UUID,
  "owner_organization_id" UUID,
  "inventory_location_id" UUID,
  "ownership_status" TEXT NOT NULL,
  "valid_from" TIMESTAMPTZ(6) NOT NULL,
  "valid_to" TIMESTAMPTZ(6),
  "transferred_at" TIMESTAMPTZ(6),
  "transferred_by_admin_id" UUID,
  "transfer_reason" TEXT,
  "previous_record_id" UUID,
  "correlation_id" TEXT,
  "actor_admin_id" UUID,
  "ip_address" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_ownership_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "watch_assignment_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "organization_id" UUID,
  "department_id" UUID,
  "assignee_person_id" UUID,
  "assignment_status" TEXT NOT NULL,
  "valid_from" TIMESTAMPTZ(6) NOT NULL,
  "valid_to" TIMESTAMPTZ(6),
  "assigned_at" TIMESTAMPTZ(6) NOT NULL,
  "unassigned_at" TIMESTAMPTZ(6),
  "assigned_by_admin_id" UUID,
  "reason" TEXT,
  "correlation_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_assignment_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "watch_transfer_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "from_owner_type" TEXT NOT NULL,
  "from_owner_id" UUID,
  "to_owner_type" TEXT NOT NULL,
  "to_owner_id" UUID,
  "from_assignee_id" UUID,
  "to_assignee_id" UUID,
  "transferred_by_admin_id" UUID NOT NULL,
  "transfer_reason" TEXT,
  "correlation_id" TEXT NOT NULL,
  "ip_address" TEXT,
  "approval_status" TEXT NOT NULL DEFAULT 'APPROVED',
  "idempotency_key" TEXT,
  "transferred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "watch_transfer_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "watch_pairing_history_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "owner_type_at_pairing" TEXT,
  "owner_id_at_pairing" UUID,
  "assignee_id_at_pairing" UUID,
  "paired_user_id" UUID,
  "paired_at" TIMESTAMPTZ(6) NOT NULL,
  "paired_by_admin_id" UUID,
  "pairing_method" TEXT NOT NULL,
  "pairing_code_ref" TEXT,
  "pairing_status" TEXT NOT NULL,
  "authentication_status" TEXT NOT NULL DEFAULT 'PENDING',
  "last_successful_auth_at" TIMESTAMPTZ(6),
  "unpaired_at" TIMESTAMPTZ(6),
  "unpaired_by_admin_id" UUID,
  "unpair_reason" TEXT,
  "correlation_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_pairing_history_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "watch_bulk_operation_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "operation_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "requested_count" INTEGER NOT NULL,
  "processed_count" INTEGER NOT NULL DEFAULT 0,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "progress_pct" INTEGER NOT NULL DEFAULT 0,
  "actor_admin_id" UUID NOT NULL,
  "correlation_id" TEXT NOT NULL,
  "failure_report_key" TEXT,
  "cancelled_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "watch_bulk_operation_jobs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "smartwatch_devices"
  ADD CONSTRAINT "smartwatch_devices_current_organization_id_fkey"
  FOREIGN KEY ("current_organization_id") REFERENCES "watch_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smartwatch_devices"
  ADD CONSTRAINT "smartwatch_devices_current_department_id_fkey"
  FOREIGN KEY ("current_department_id") REFERENCES "watch_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smartwatch_devices"
  ADD CONSTRAINT "smartwatch_devices_current_inventory_location_id_fkey"
  FOREIGN KEY ("current_inventory_location_id") REFERENCES "watch_inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "watch_departments"
  ADD CONSTRAINT "watch_departments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "watch_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watch_ownership_records"
  ADD CONSTRAINT "watch_ownership_records_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watch_assignment_records"
  ADD CONSTRAINT "watch_assignment_records_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watch_transfer_records"
  ADD CONSTRAINT "watch_transfer_records_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watch_pairing_history_records"
  ADD CONSTRAINT "watch_pairing_history_records_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "smartwatch_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "watch_transfer_records_idempotency_key_key" ON "watch_transfer_records"("idempotency_key");

CREATE INDEX IF NOT EXISTS "smartwatch_devices_current_owner_type_current_owner_id_idx"
  ON "smartwatch_devices"("current_owner_type", "current_owner_id");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_current_organization_id_idx"
  ON "smartwatch_devices"("current_organization_id");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_current_department_id_idx"
  ON "smartwatch_devices"("current_department_id");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_current_assignee_id_idx"
  ON "smartwatch_devices"("current_assignee_id");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_ownership_status_idx"
  ON "smartwatch_devices"("ownership_status");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_assignment_status_idx"
  ON "smartwatch_devices"("assignment_status");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_inventory_status_idx"
  ON "smartwatch_devices"("inventory_status");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_eid_idx"
  ON "smartwatch_devices"("eid");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_owner_status_last_seen_idx"
  ON "smartwatch_devices"("current_owner_type", "ownership_status", "last_seen_at");
CREATE INDEX IF NOT EXISTS "smartwatch_devices_org_assignment_online_idx"
  ON "smartwatch_devices"("current_organization_id", "assignment_status", "is_online");

CREATE INDEX IF NOT EXISTS "watch_organizations_country_state_lga_idx"
  ON "watch_organizations"("country", "state", "lga");
CREATE INDEX IF NOT EXISTS "watch_departments_organization_id_idx"
  ON "watch_departments"("organization_id");
CREATE INDEX IF NOT EXISTS "watch_ownership_records_device_valid_from_idx"
  ON "watch_ownership_records"("device_id", "valid_from");
CREATE INDEX IF NOT EXISTS "watch_assignment_records_device_valid_from_idx"
  ON "watch_assignment_records"("device_id", "valid_from");
CREATE INDEX IF NOT EXISTS "watch_transfer_records_device_transferred_at_idx"
  ON "watch_transfer_records"("device_id", "transferred_at");
CREATE INDEX IF NOT EXISTS "watch_pairing_history_records_device_paired_at_idx"
  ON "watch_pairing_history_records"("device_id", "paired_at");
CREATE INDEX IF NOT EXISTS "watch_bulk_operation_jobs_status_created_at_idx"
  ON "watch_bulk_operation_jobs"("status", "created_at");
