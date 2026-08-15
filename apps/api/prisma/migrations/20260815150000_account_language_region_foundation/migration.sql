ALTER TABLE "profiles"
  ADD COLUMN "country_code" TEXT,
  ADD COLUMN "preferred_locale" TEXT;

ALTER TABLE "admin_user_preferences"
  ADD COLUMN "preferred_locale" TEXT;

CREATE INDEX "profiles_country_code_idx" ON "profiles"("country_code");
