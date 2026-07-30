CREATE TYPE "PolicySectionKey" AS ENUM (
  'community',
  'permissions',
  'notifications',
  'broadcasts',
  'verification',
  'patrols',
  'volunteers',
  'smartwatch',
  'integrations'
);

CREATE TABLE "policy_configurations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "section" "PolicySectionKey" NOT NULL,
  "scope_key" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL DEFAULT '{}',
  "community_id" UUID,
  "updated_by_admin_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "policy_configurations_section_scope_key_key" UNIQUE ("section", "scope_key"),
  CONSTRAINT "policy_configurations_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "policy_configurations_updated_by_admin_id_fkey" FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "policy_configurations_section_is_active_idx" ON "policy_configurations"("section", "is_active");

CREATE TABLE "admin_user_preferences" (
  "admin_user_id" UUID NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'system',
  "notification_prefs" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_user_preferences_pkey" PRIMARY KEY ("admin_user_id"),
  CONSTRAINT "admin_user_preferences_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
