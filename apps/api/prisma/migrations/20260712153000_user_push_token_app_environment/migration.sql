ALTER TABLE "user_push_tokens"
  ADD COLUMN IF NOT EXISTS "app_environment" TEXT NOT NULL DEFAULT 'development';

UPDATE "user_push_tokens"
   SET "app_environment" = 'development'
 WHERE "app_environment" IS NULL OR "app_environment" = '';

CREATE INDEX IF NOT EXISTS "user_push_tokens_user_active_env_idx"
  ON "user_push_tokens" ("user_id", "is_active", "app_environment");

DROP INDEX IF EXISTS "user_push_tokens_user_active_idx";
