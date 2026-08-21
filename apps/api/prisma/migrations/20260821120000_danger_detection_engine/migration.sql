CREATE TYPE "DangerDetectionSourceType" AS ENUM (
  'INCIDENT', 'COMMUNITY_POST', 'COMMUNITY_COMMENT', 'BROADCAST_SIGHTING',
  'INCIDENT_AUDIO', 'COMMUNITY_POST_AUDIO', 'BROADCAST_SIGHTING_AUDIO'
);

CREATE TYPE "DangerDetectionState" AS ENUM (
  'DETECTED', 'POTENTIAL', 'VERIFYING', 'CONFIRMED', 'RESOLVED', 'REJECTED', 'FAILED'
);

CREATE TYPE "DangerLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "DangerCategory" AS ENUM (
  'ACTIVE_SHOOTING', 'ARMED_ATTACK', 'ARMED_ROBBERY', 'KIDNAPPING_IN_PROGRESS',
  'EXPLOSION', 'FIRE_WITH_LIFE_RISK', 'BOMB_OR_EXPLOSIVE_THREAT',
  'VIOLENT_MOB_OR_RIOT', 'VEHICLE_ATTACK', 'SERIOUS_WEAPON_ASSAULT',
  'MAJOR_HAZARDOUS_RELEASE', 'OTHER_IMMEDIATE_LIFE_THREAT'
);

CREATE TABLE "danger_detection_assessments" (
  "id" UUID NOT NULL,
  "source_type" "DangerDetectionSourceType" NOT NULL,
  "source_id" UUID NOT NULL,
  "content_hash" TEXT NOT NULL,
  "incident_id" UUID,
  "speech_artifact_id" UUID,
  "danger_zone_id" UUID,
  "source_locale" TEXT,
  "classifier_provider" TEXT NOT NULL,
  "classifier_model" TEXT,
  "classifier_version" INTEGER NOT NULL DEFAULT 1,
  "danger_level" "DangerLevel" NOT NULL,
  "category" "DangerCategory" NOT NULL,
  "immediate_threat" BOOLEAN NOT NULL,
  "active_incident" BOOLEAN NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL,
  "requires_verification" BOOLEAN NOT NULL,
  "location_usable" BOOLEAN NOT NULL DEFAULT false,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "occurred_at" TIMESTAMPTZ(6),
  "state" "DangerDetectionState" NOT NULL DEFAULT 'DETECTED',
  "cluster_key" TEXT,
  "correlated_source_count" INTEGER NOT NULL DEFAULT 1,
  "resulting_action" TEXT NOT NULL DEFAULT 'NONE',
  "error_code" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "danger_detection_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "danger_detection_assessments_source_type_source_id_content_hash_key"
  ON "danger_detection_assessments"("source_type", "source_id", "content_hash");
CREATE INDEX "danger_detection_assessments_state_danger_level_created_at_idx"
  ON "danger_detection_assessments"("state", "danger_level", "created_at");
CREATE INDEX "danger_detection_assessments_incident_id_created_at_idx"
  ON "danger_detection_assessments"("incident_id", "created_at");
CREATE INDEX "danger_detection_assessments_cluster_key_created_at_idx"
  ON "danger_detection_assessments"("cluster_key", "created_at");
CREATE INDEX "danger_detection_assessments_danger_zone_id_idx"
  ON "danger_detection_assessments"("danger_zone_id");
