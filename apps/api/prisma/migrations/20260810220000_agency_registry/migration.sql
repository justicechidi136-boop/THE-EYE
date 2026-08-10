-- Agency Registry: extend agencies, response_units, field_permission_profiles

-- agencies: additive registry columns
ALTER TABLE "agencies" ALTER COLUMN "jurisdiction_id" DROP NOT NULL;

ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "parent_agency_id" UUID,
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "short_name" TEXT,
  ADD COLUMN IF NOT EXISTS "jurisdiction_level" TEXT NOT NULL DEFAULT 'LGA',
  ADD COLUMN IF NOT EXISTS "country_code" TEXT NOT NULL DEFAULT 'NG',
  ADD COLUMN IF NOT EXISTS "state_code" TEXT,
  ADD COLUMN IF NOT EXISTS "lga_code" TEXT,
  ADD COLUMN IF NOT EXISTS "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "is_government" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_emergency_responder" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_dispatchable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "is_field_operations_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_drone_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_broadcast_authority" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS "contact_metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill geo codes from jurisdictions (Jurisdiction uses full names)
UPDATE "agencies" a
SET
  "country_code" = CASE
    WHEN lower(j.country) IN ('nigeria', 'ng') THEN 'NG'
    ELSE upper(left(coalesce(j.country, 'NG'), 2))
  END,
  "state_code" = CASE
    WHEN lower(j.state) IN ('lagos', 'la') THEN 'LA'
    WHEN j.state IS NULL OR j.state = '' THEN NULL
    ELSE upper(left(j.state, 2))
  END,
  "lga_code" = CASE
    WHEN j.lga IS NULL OR j.lga = '' THEN NULL
    ELSE upper(regexp_replace(j.lga, '\s+', '_', 'g'))
  END,
  "jurisdiction_level" = 'LGA'
FROM "jurisdictions" j
WHERE a."jurisdiction_id" = j."id"
  AND (a."state_code" IS NULL OR a."lga_code" IS NULL OR a."country_code" = 'NG');

-- Normalize legacy type strings
UPDATE "agencies"
SET "type" = CASE lower("type")
  WHEN 'police' THEN 'POLICE'
  WHEN 'emergency' THEN 'EMS'
  WHEN 'ems' THEN 'EMS'
  WHEN 'fire' THEN 'FIRE_RESCUE'
  WHEN 'fire_rescue' THEN 'FIRE_RESCUE'
  WHEN 'frsc' THEN 'ROAD_SAFETY'
  WHEN 'road_safety' THEN 'ROAD_SAFETY'
  WHEN 'nscdc' THEN 'CIVIL_DEFENCE'
  WHEN 'civil_defence' THEN 'CIVIL_DEFENCE'
  WHEN 'security' THEN 'PRIVATE_SECURITY'
  ELSE upper(replace("type", ' ', '_'))
END
WHERE "type" IS NOT NULL
  AND "type" NOT IN (
    'POLICE','FIRE_RESCUE','EMS','ROAD_SAFETY','CIVIL_DEFENCE','EMERGENCY_MANAGEMENT',
    'MILITARY','INTELLIGENCE','IMMIGRATION','CORRECTIONS','MARITIME_SECURITY','CUSTOMS',
    'PRIVATE_SECURITY','LOCAL_GOVERNMENT','OTHER'
  );

-- Known seed UUIDs
UPDATE "agencies"
SET
  "code" = 'NG-LAG-IKEJA-POLICE',
  "short_name" = 'Ikeja Police',
  "is_field_operations_enabled" = true,
  "is_dispatchable" = true,
  "capabilities" = ARRAY['INCIDENT_DISPATCH','PATROL','CHECKPOINT','FIELD_OPERATIONS','BOLO']::TEXT[],
  "status" = CASE WHEN "is_active" THEN 'Active' ELSE 'Inactive' END
WHERE "id" = '22222222-2222-2222-2222-222222222222';

UPDATE "agencies"
SET
  "code" = 'NG-LAG-IKEJA-EMS',
  "short_name" = 'Ikeja EMS',
  "is_field_operations_enabled" = false,
  "is_dispatchable" = true,
  "capabilities" = ARRAY['INCIDENT_DISPATCH','MEDICAL_RESPONSE']::TEXT[],
  "status" = CASE WHEN "is_active" THEN 'Active' ELSE 'Inactive' END
WHERE "id" = '22222222-2222-2222-2222-222222222223';

-- Enable FO for remaining POLICE agencies
UPDATE "agencies"
SET
  "is_field_operations_enabled" = true,
  "capabilities" = CASE
    WHEN cardinality("capabilities") = 0 THEN ARRAY['INCIDENT_DISPATCH','PATROL','FIELD_OPERATIONS']::TEXT[]
    ELSE "capabilities"
  END
WHERE "type" = 'POLICE'
  AND "is_field_operations_enabled" = false;

-- Unique codes for any remaining rows (must be non-null before unique index)
UPDATE "agencies"
SET
  "code" = 'AGY-' || upper(replace("id"::text, '-', '')),
  "short_name" = coalesce("short_name", left("name", 40)),
  "status" = CASE WHEN "is_active" THEN 'Active' ELSE 'Inactive' END
WHERE "code" IS NULL;

ALTER TABLE "agencies" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "agencies_code_key" ON "agencies"("code");
CREATE INDEX IF NOT EXISTS "agencies_country_code_state_code_is_active_idx"
  ON "agencies"("country_code", "state_code", "is_active");
CREATE INDEX IF NOT EXISTS "agencies_type_is_active_idx" ON "agencies"("type", "is_active");
CREATE INDEX IF NOT EXISTS "agencies_parent_agency_id_idx" ON "agencies"("parent_agency_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agencies_parent_agency_id_fkey'
  ) THEN
    ALTER TABLE "agencies"
      ADD CONSTRAINT "agencies_parent_agency_id_fkey"
      FOREIGN KEY ("parent_agency_id") REFERENCES "agencies"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- response_units org hierarchy
ALTER TABLE "response_units"
  ADD COLUMN IF NOT EXISTS "parent_unit_id" UUID,
  ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "unit_kind" TEXT NOT NULL DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS "country_code" TEXT,
  ADD COLUMN IF NOT EXISTS "state_code" TEXT,
  ADD COLUMN IF NOT EXISTS "lga_code" TEXT;

UPDATE "response_units"
SET "name" = CASE
  WHEN "name" IS NULL OR "name" = '' THEN "unit_identifier"
  ELSE "name"
END;

CREATE INDEX IF NOT EXISTS "response_units_parent_unit_id_idx" ON "response_units"("parent_unit_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'response_units_parent_unit_id_fkey'
  ) THEN
    ALTER TABLE "response_units"
      ADD CONSTRAINT "response_units_parent_unit_id_fkey"
      FOREIGN KEY ("parent_unit_id") REFERENCES "response_units"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- field permission profile agency-type compatibility (empty = all)
ALTER TABLE "field_permission_profiles"
  ADD COLUMN IF NOT EXISTS "compatible_agency_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
