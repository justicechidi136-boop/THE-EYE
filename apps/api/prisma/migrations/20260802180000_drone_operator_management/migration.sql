-- Extend drone_operators for compliance workflow
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "operator_code" TEXT;
UPDATE "drone_operators" SET "operator_code" = 'OP-' || UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 8))
  WHERE "operator_code" IS NULL;
ALTER TABLE "drone_operators" ALTER COLUMN "operator_code" SET NOT NULL;

ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "profile_photo_object_key" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "lga" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "operating_address" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "employment_type" TEXT NOT NULL DEFAULT 'AgencyStaff';
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "assigned_agency_id" UUID;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "assigned_operating_base" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "emergency_contact_name" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "account_status" TEXT NOT NULL DEFAULT 'PendingReview';
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "availability_status" TEXT NOT NULL DEFAULT 'Unavailable';
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "last_check_in_at" TIMESTAMPTZ(6);
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "maximum_concurrent_missions" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "emergency_call_available" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(6);
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "suspended_by_id" UUID;
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "reactivated_at" TIMESTAMPTZ(6);
ALTER TABLE "drone_operators" ADD COLUMN IF NOT EXISTS "reactivated_by_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "drone_operators_operator_code_key" ON "drone_operators"("operator_code");
CREATE INDEX IF NOT EXISTS "drone_operators_country_state_lga_idx" ON "drone_operators"("country", "state", "lga");
CREATE INDEX IF NOT EXISTS "drone_operators_assigned_agency_id_idx" ON "drone_operators"("assigned_agency_id");
CREATE INDEX IF NOT EXISTS "drone_operators_account_status_availability_status_idx" ON "drone_operators"("account_status", "availability_status");
CREATE INDEX IF NOT EXISTS "drone_operators_email_idx" ON "drone_operators"("email");
CREATE INDEX IF NOT EXISTS "drone_operators_phone_idx" ON "drone_operators"("phone");

ALTER TABLE "drone_operators" ADD CONSTRAINT "drone_operators_assigned_agency_id_fkey"
  FOREIGN KEY ("assigned_agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_operators" ADD CONSTRAINT "drone_operators_suspended_by_id_fkey"
  FOREIGN KEY ("suspended_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_operators" ADD CONSTRAINT "drone_operators_reactivated_by_id_fkey"
  FOREIGN KEY ("reactivated_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "drone_operator_licences" (
    "id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "licence_number" TEXT NOT NULL,
    "licence_category" TEXT NOT NULL,
    "issuing_authority" TEXT NOT NULL,
    "issue_date" TIMESTAMPTZ(6),
    "expiry_date" TIMESTAMPTZ(6),
    "verification_status" TEXT NOT NULL DEFAULT 'Unverified',
    "verified_at" TIMESTAMPTZ(6),
    "verified_by_id" UUID,
    "rejection_reason" TEXT,
    "document_object_key" TEXT,
    "document_mime_type" TEXT,
    "document_checksum" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drone_operator_licences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "drone_operator_licences_licence_number_key" ON "drone_operator_licences"("licence_number");
CREATE INDEX IF NOT EXISTS "drone_operator_licences_operator_id_expiry_date_idx" ON "drone_operator_licences"("operator_id", "expiry_date");
CREATE INDEX IF NOT EXISTS "drone_operator_licences_verification_status_expiry_date_idx" ON "drone_operator_licences"("verification_status", "expiry_date");

CREATE TABLE IF NOT EXISTS "drone_operator_certifications" (
    "id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "certification_type" TEXT NOT NULL,
    "training_provider" TEXT,
    "certificate_number" TEXT,
    "issue_date" TIMESTAMPTZ(6),
    "expiry_date" TIMESTAMPTZ(6),
    "document_object_key" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'Unverified',
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drone_operator_certifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "drone_operator_certifications_operator_id_certification_type_idx" ON "drone_operator_certifications"("operator_id", "certification_type");
CREATE INDEX IF NOT EXISTS "drone_operator_certifications_verification_status_expiry_date_idx" ON "drone_operator_certifications"("verification_status", "expiry_date");

CREATE TABLE IF NOT EXISTS "drone_operator_qualifications" (
    "id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "drone_device_id" UUID,
    "drone_model" TEXT,
    "qualification_level" TEXT NOT NULL DEFAULT 'Trainee',
    "qualified_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "assessed_by_id" UUID,
    "last_competency_assessment_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drone_operator_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "drone_operator_qualifications_operator_id_drone_device_id_idx" ON "drone_operator_qualifications"("operator_id", "drone_device_id");
CREATE INDEX IF NOT EXISTS "drone_operator_qualifications_operator_id_drone_model_idx" ON "drone_operator_qualifications"("operator_id", "drone_model");
CREATE INDEX IF NOT EXISTS "drone_operator_qualifications_status_expires_at_idx" ON "drone_operator_qualifications"("status", "expires_at");

CREATE TABLE IF NOT EXISTS "drone_operator_documents" (
    "id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "checksum" TEXT,
    "size_bytes" INTEGER,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drone_operator_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "drone_operator_documents_operator_id_document_type_idx" ON "drone_operator_documents"("operator_id", "document_type");

CREATE TABLE IF NOT EXISTS "drone_operator_status_history" (
    "id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "previous_availability" TEXT,
    "new_availability" TEXT,
    "reason" TEXT,
    "changed_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drone_operator_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "drone_operator_status_history_operator_id_created_at_idx" ON "drone_operator_status_history"("operator_id", "created_at");

CREATE TABLE IF NOT EXISTS "drone_mission_assignments" (
    "id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "assignment_role" TEXT NOT NULL DEFAULT 'Primary',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "assigned_by_id" UUID,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),
    "decline_reason" TEXT,
    "idempotency_key" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drone_mission_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "drone_mission_assignments_idempotency_key_key" ON "drone_mission_assignments"("idempotency_key");
CREATE INDEX IF NOT EXISTS "drone_mission_assignments_mission_id_assignment_role_status_idx" ON "drone_mission_assignments"("mission_id", "assignment_role", "status");
CREATE INDEX IF NOT EXISTS "drone_mission_assignments_operator_id_status_idx" ON "drone_mission_assignments"("operator_id", "status");

CREATE TABLE IF NOT EXISTS "drone_mission_preflight_checks" (
    "id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "operator_id" UUID,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "failed_checks" JSONB NOT NULL DEFAULT '[]',
    "emergency_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "override_by_id" UUID,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drone_mission_preflight_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "drone_mission_preflight_checks_mission_id_checked_at_idx" ON "drone_mission_preflight_checks"("mission_id", "checked_at");

CREATE TABLE IF NOT EXISTS "drone_operator_safety_records" (
    "id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "record_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mission_id" UUID,
    "severity" TEXT NOT NULL DEFAULT 'Info',
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_id" UUID,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "drone_operator_safety_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "drone_operator_safety_records_operator_id_recorded_at_idx" ON "drone_operator_safety_records"("operator_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "drone_operator_safety_records_record_type_idx" ON "drone_operator_safety_records"("record_type");

ALTER TABLE "drone_operator_licences" ADD CONSTRAINT "drone_operator_licences_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_operator_licences" ADD CONSTRAINT "drone_operator_licences_verified_by_id_fkey"
  FOREIGN KEY ("verified_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "drone_operator_certifications" ADD CONSTRAINT "drone_operator_certifications_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_operator_certifications" ADD CONSTRAINT "drone_operator_certifications_verified_by_id_fkey"
  FOREIGN KEY ("verified_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "drone_operator_qualifications" ADD CONSTRAINT "drone_operator_qualifications_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_operator_qualifications" ADD CONSTRAINT "drone_operator_qualifications_drone_device_id_fkey"
  FOREIGN KEY ("drone_device_id") REFERENCES "drone_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_operator_qualifications" ADD CONSTRAINT "drone_operator_qualifications_assessed_by_id_fkey"
  FOREIGN KEY ("assessed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "drone_operator_documents" ADD CONSTRAINT "drone_operator_documents_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_operator_documents" ADD CONSTRAINT "drone_operator_documents_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "drone_operator_status_history" ADD CONSTRAINT "drone_operator_status_history_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_operator_status_history" ADD CONSTRAINT "drone_operator_status_history_changed_by_id_fkey"
  FOREIGN KEY ("changed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "drone_mission_assignments" ADD CONSTRAINT "drone_mission_assignments_mission_id_fkey"
  FOREIGN KEY ("mission_id") REFERENCES "drone_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_mission_assignments" ADD CONSTRAINT "drone_mission_assignments_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_mission_assignments" ADD CONSTRAINT "drone_mission_assignments_assigned_by_id_fkey"
  FOREIGN KEY ("assigned_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "drone_mission_preflight_checks" ADD CONSTRAINT "drone_mission_preflight_checks_mission_id_fkey"
  FOREIGN KEY ("mission_id") REFERENCES "drone_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_mission_preflight_checks" ADD CONSTRAINT "drone_mission_preflight_checks_override_by_id_fkey"
  FOREIGN KEY ("override_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "drone_operator_safety_records" ADD CONSTRAINT "drone_operator_safety_records_operator_id_fkey"
  FOREIGN KEY ("operator_id") REFERENCES "drone_operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drone_operator_safety_records" ADD CONSTRAINT "drone_operator_safety_records_mission_id_fkey"
  FOREIGN KEY ("mission_id") REFERENCES "drone_missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drone_operator_safety_records" ADD CONSTRAINT "drone_operator_safety_records_recorded_by_id_fkey"
  FOREIGN KEY ("recorded_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
