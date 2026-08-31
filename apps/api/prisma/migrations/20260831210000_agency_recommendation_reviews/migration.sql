CREATE TYPE "AgencyRecommendationReviewOutcome" AS ENUM (
  'ACCEPTED_AS_RELEVANT',
  'NOT_RELEVANT',
  'INSUFFICIENT_OPERATIONAL_DATA',
  'WRONG_JURISDICTION',
  'WRONG_CAPABILITY',
  'OUTDATED_DIRECTORY_DATA',
  'OTHER'
);

CREATE TABLE "agency_recommendation_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "incident_id" UUID NOT NULL,
  "agency_id" UUID NOT NULL,
  "state_id" UUID NOT NULL,
  "reviewer_admin_id" UUID NOT NULL,
  "previous_review_id" UUID,
  "recommendation_key" TEXT NOT NULL,
  "recommendation_rule_version" TEXT NOT NULL,
  "agency_name" TEXT NOT NULL,
  "endpoint_id" UUID,
  "endpoint_type" TEXT NOT NULL,
  "endpoint_name" TEXT,
  "recommendation_tier" TEXT NOT NULL,
  "matched_capability" TEXT NOT NULL,
  "jurisdiction_level" TEXT NOT NULL,
  "operational_ready" BOOLEAN NOT NULL,
  "verification_state" TEXT NOT NULL,
  "qualified_distance_meters" INTEGER,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "limitations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "country_name" TEXT NOT NULL,
  "state_name" TEXT NOT NULL,
  "incident_type" "IncidentType" NOT NULL,
  "outcome" "AgencyRecommendationReviewOutcome" NOT NULL,
  "note" TEXT,
  "reviewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_recommendation_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agency_recommendation_reviews_incident_id_recommendation_key_reviewed_at_idx"
  ON "agency_recommendation_reviews"("incident_id", "recommendation_key", "reviewed_at");
CREATE INDEX "agency_recommendation_reviews_recommendation_rule_version_reviewed_at_idx"
  ON "agency_recommendation_reviews"("recommendation_rule_version", "reviewed_at");
CREATE INDEX "agency_recommendation_reviews_state_id_incident_type_reviewed_at_idx"
  ON "agency_recommendation_reviews"("state_id", "incident_type", "reviewed_at");
CREATE INDEX "agency_recommendation_reviews_agency_id_recommendation_tier_outcome_reviewed_at_idx"
  ON "agency_recommendation_reviews"("agency_id", "recommendation_tier", "outcome", "reviewed_at");
CREATE INDEX "agency_recommendation_reviews_reviewer_admin_id_reviewed_at_idx"
  ON "agency_recommendation_reviews"("reviewer_admin_id", "reviewed_at");

ALTER TABLE "agency_recommendation_reviews"
  ADD CONSTRAINT "agency_recommendation_reviews_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_recommendation_reviews"
  ADD CONSTRAINT "agency_recommendation_reviews_agency_id_fkey"
  FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_recommendation_reviews"
  ADD CONSTRAINT "agency_recommendation_reviews_state_id_fkey"
  FOREIGN KEY ("state_id") REFERENCES "administrative_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_recommendation_reviews"
  ADD CONSTRAINT "agency_recommendation_reviews_reviewer_admin_id_fkey"
  FOREIGN KEY ("reviewer_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_recommendation_reviews"
  ADD CONSTRAINT "agency_recommendation_reviews_previous_review_id_fkey"
  FOREIGN KEY ("previous_review_id") REFERENCES "agency_recommendation_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
