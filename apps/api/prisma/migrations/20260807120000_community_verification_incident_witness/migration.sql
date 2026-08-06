-- Community Verification (Phase 4): per-user incident witness requests and responses

CREATE TYPE "CommunityVerificationRequestStatus" AS ENUM (
  'Pending',
  'Delivered',
  'Opened',
  'Responded',
  'Skipped',
  'Expired',
  'Revoked',
  'Cancelled'
);

CREATE TYPE "CommunityVerificationResponseType" AS ENUM (
  'Confirmed',
  'NotFound',
  'StillOngoing',
  'AppearsResolved',
  'UnsafeToVerify',
  'Skipped',
  'Unsure'
);

CREATE TYPE "CommunityVerificationConfidenceLevel" AS ENUM (
  'High',
  'Medium',
  'Low'
);

CREATE TYPE "CommunityVerificationDistanceBand" AS ENUM (
  'WITHIN_100_M',
  'WITHIN_250_M',
  'WITHIN_500_M',
  'WITHIN_1_KM',
  'BEYOND_1_KM'
);

CREATE TABLE "community_verification_requests" (
  "id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "status" "CommunityVerificationRequestStatus" NOT NULL DEFAULT 'Pending',
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "approximate_distance_meters" INTEGER,
  "distance_band" "CommunityVerificationDistanceBand",
  "safe_payload_version" INTEGER NOT NULL DEFAULT 1,
  "notification_id" UUID,
  "delivery_status" TEXT,
  "opened_at" TIMESTAMPTZ(6),
  "responded_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "revoked_by_admin_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_verification_responses" (
  "id" UUID NOT NULL,
  "request_id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "response_type" "CommunityVerificationResponseType" NOT NULL,
  "confidence" "CommunityVerificationConfidenceLevel",
  "note" TEXT,
  "voice_attachment_id" UUID,
  "location_quality" TEXT,
  "location_source" TEXT,
  "approximate_distance_at_response" INTEGER,
  "trust_weight" DECIMAL(5,4),
  "client_action_id" TEXT NOT NULL,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "flagged_suspicious" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "community_verification_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_verification_requests_incident_id_target_user_id_issued_at_key"
  ON "community_verification_requests"("incident_id", "target_user_id", "issued_at");
CREATE INDEX "community_verification_requests_target_user_id_status_expires_at_idx"
  ON "community_verification_requests"("target_user_id", "status", "expires_at");
CREATE INDEX "community_verification_requests_incident_id_status_issued_at_idx"
  ON "community_verification_requests"("incident_id", "status", "issued_at");
CREATE INDEX "community_verification_requests_status_expires_at_idx"
  ON "community_verification_requests"("status", "expires_at");

CREATE UNIQUE INDEX "community_verification_responses_request_id_key"
  ON "community_verification_responses"("request_id");
CREATE UNIQUE INDEX "community_verification_responses_client_action_id_key"
  ON "community_verification_responses"("client_action_id");
CREATE INDEX "community_verification_responses_incident_id_response_type_submitted_at_idx"
  ON "community_verification_responses"("incident_id", "response_type", "submitted_at");
CREATE INDEX "community_verification_responses_user_id_submitted_at_idx"
  ON "community_verification_responses"("user_id", "submitted_at");

ALTER TABLE "community_verification_requests"
  ADD CONSTRAINT "community_verification_requests_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_verification_requests"
  ADD CONSTRAINT "community_verification_requests_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_verification_requests"
  ADD CONSTRAINT "community_verification_requests_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_verification_responses"
  ADD CONSTRAINT "community_verification_responses_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "community_verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_verification_responses"
  ADD CONSTRAINT "community_verification_responses_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_verification_responses"
  ADD CONSTRAINT "community_verification_responses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
