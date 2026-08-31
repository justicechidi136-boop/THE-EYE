CREATE TYPE "AdministrativeStateType" AS ENUM ('STATE', 'FCT');
CREATE TYPE "LocalGovernmentAreaType" AS ENUM ('LGA', 'AREA_COUNCIL');
CREATE TYPE "ReferenceVerificationStatus" AS ENUM ('VERIFIED', 'PARTIALLY_VERIFIED', 'PENDING_VERIFICATION', 'DISPUTED', 'RETIRED');
CREATE TYPE "AgencyGovernmentLevel" AS ENUM ('FEDERAL', 'STATE', 'LOCAL', 'MULTI_LEVEL');
CREATE TYPE "AgencyOfficeType" AS ENUM ('HEADQUARTERS', 'COMMAND', 'FORMATION', 'DIVISION', 'STATION', 'ZONAL_OFFICE', 'STATE_OFFICE', 'LOCAL_OFFICE', 'OTHER');
CREATE TYPE "AgencyCoverageType" AS ENUM ('NATIONAL', 'STATE', 'LGA', 'WARD', 'CUSTOM_COVERAGE_AREA');
CREATE TYPE "AgencyContactType" AS ENUM ('PHONE', 'EMERGENCY_PHONE', 'TOLL_FREE', 'SMS', 'WHATSAPP', 'EMAIL', 'WEBSITE', 'REPORTING_PORTAL', 'SOCIAL_MEDIA_OFFICIAL');

CREATE TABLE "reference_data_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "version" TEXT,
  "retrieved_at" TIMESTAMPTZ(6) NOT NULL,
  "checksum" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reference_data_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "countries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_id" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "official_name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "administrative_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "country_id" UUID NOT NULL,
  "source_id" UUID,
  "source_record_id" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "official_name" TEXT NOT NULL,
  "type" "AdministrativeStateType" NOT NULL,
  "slug" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "administrative_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "local_government_areas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "state_id" UUID NOT NULL,
  "source_id" UUID,
  "source_record_id" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "official_name" TEXT NOT NULL,
  "type" "LocalGovernmentAreaType" NOT NULL,
  "slug" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "local_government_areas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lga_id" UUID NOT NULL,
  "source_id" UUID,
  "source_record_id" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "official_name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "jurisdictions"
  ADD COLUMN "country_ref_id" UUID,
  ADD COLUMN "state_ref_id" UUID,
  ADD COLUMN "lga_ref_id" UUID,
  ADD COLUMN "ward_ref_id" UUID;

ALTER TABLE "agencies"
  ADD COLUMN "official_name" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "government_level" "AgencyGovernmentLevel",
  ADD COLUMN "official_website" TEXT,
  ADD COLUMN "verification_status" "ReferenceVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  ADD COLUMN "verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "verification_source" TEXT,
  ADD COLUMN "data_quality_notes" TEXT;

CREATE TABLE "agency_offices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agency_id" UUID NOT NULL,
  "parent_office_id" UUID,
  "police_station_id" UUID,
  "country_id" UUID NOT NULL,
  "state_id" UUID,
  "lga_id" UUID,
  "ward_id" UUID,
  "name" TEXT NOT NULL,
  "office_type" "AgencyOfficeType" NOT NULL,
  "physical_address" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "coordinates_verified" BOOLEAN NOT NULL DEFAULT false,
  "is_24_hours" BOOLEAN,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "verification_status" "ReferenceVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "verified_at" TIMESTAMPTZ(6),
  "source_url" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_offices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agency_offices_geography_check" CHECK (
    ("lga_id" IS NULL OR "state_id" IS NOT NULL) AND
    ("ward_id" IS NULL OR "lga_id" IS NOT NULL) AND
    (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL))
  )
);

CREATE TABLE "agency_jurisdictions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agency_id" UUID NOT NULL,
  "office_id" UUID,
  "country_id" UUID NOT NULL,
  "state_id" UUID,
  "lga_id" UUID,
  "ward_id" UUID,
  "coverage_type" "AgencyCoverageType" NOT NULL,
  "custom_coverage" JSONB,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_jurisdictions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agency_jurisdictions_hierarchy_check" CHECK (
    ("coverage_type" = 'NATIONAL' AND "state_id" IS NULL AND "lga_id" IS NULL AND "ward_id" IS NULL) OR
    ("coverage_type" = 'STATE' AND "state_id" IS NOT NULL AND "lga_id" IS NULL AND "ward_id" IS NULL) OR
    ("coverage_type" = 'LGA' AND "state_id" IS NOT NULL AND "lga_id" IS NOT NULL AND "ward_id" IS NULL) OR
    ("coverage_type" = 'WARD' AND "state_id" IS NOT NULL AND "lga_id" IS NOT NULL AND "ward_id" IS NOT NULL) OR
    ("coverage_type" = 'CUSTOM_COVERAGE_AREA' AND "custom_coverage" IS NOT NULL)
  )
);

CREATE TABLE "agency_contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agency_id" UUID NOT NULL,
  "office_id" UUID,
  "type" "AgencyContactType" NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT,
  "emergency_only" BOOLEAN NOT NULL DEFAULT false,
  "publicly_verified" BOOLEAN NOT NULL DEFAULT false,
  "verification_status" "ReferenceVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "source_url" TEXT,
  "last_verified_at" TIMESTAMPTZ(6),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agency_contacts_public_verification_check" CHECK (
    NOT "publicly_verified" OR ("source_url" IS NOT NULL AND "last_verified_at" IS NOT NULL AND "verification_status" = 'VERIFIED')
  )
);

CREATE TABLE "agency_incident_capabilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agency_id" UUID NOT NULL,
  "incident_type" "IncidentType" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "can_receive_report" BOOLEAN NOT NULL DEFAULT true,
  "can_dispatch" BOOLEAN NOT NULL DEFAULT false,
  "can_escalate" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_incident_capabilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reference_data_sources_url_key" ON "reference_data_sources"("url");
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");
CREATE UNIQUE INDEX "countries_slug_key" ON "countries"("slug");
CREATE INDEX "countries_is_active_name_idx" ON "countries"("is_active", "name");
CREATE UNIQUE INDEX "administrative_states_country_id_code_key" ON "administrative_states"("country_id", "code");
CREATE UNIQUE INDEX "administrative_states_country_id_name_key" ON "administrative_states"("country_id", "name");
CREATE UNIQUE INDEX "administrative_states_country_id_slug_key" ON "administrative_states"("country_id", "slug");
CREATE UNIQUE INDEX "administrative_states_id_country_id_key" ON "administrative_states"("id", "country_id");
CREATE INDEX "administrative_states_country_id_is_active_name_idx" ON "administrative_states"("country_id", "is_active", "name");
CREATE UNIQUE INDEX "local_government_areas_state_id_code_key" ON "local_government_areas"("state_id", "code");
CREATE UNIQUE INDEX "local_government_areas_state_id_name_key" ON "local_government_areas"("state_id", "name");
CREATE UNIQUE INDEX "local_government_areas_state_id_slug_key" ON "local_government_areas"("state_id", "slug");
CREATE UNIQUE INDEX "local_government_areas_id_state_id_key" ON "local_government_areas"("id", "state_id");
CREATE INDEX "local_government_areas_state_id_is_active_name_idx" ON "local_government_areas"("state_id", "is_active", "name");
CREATE UNIQUE INDEX "wards_lga_id_code_key" ON "wards"("lga_id", "code");
CREATE UNIQUE INDEX "wards_lga_id_name_key" ON "wards"("lga_id", "name");
CREATE UNIQUE INDEX "wards_lga_id_slug_key" ON "wards"("lga_id", "slug");
CREATE UNIQUE INDEX "wards_id_lga_id_key" ON "wards"("id", "lga_id");
CREATE INDEX "wards_lga_id_is_active_name_idx" ON "wards"("lga_id", "is_active", "name");
CREATE INDEX "jurisdictions_canonical_geography_idx" ON "jurisdictions"("country_ref_id", "state_ref_id", "lga_ref_id", "ward_ref_id");
CREATE UNIQUE INDEX "agency_offices_police_station_id_key" ON "agency_offices"("police_station_id");
CREATE UNIQUE INDEX "agency_offices_identity_key" ON "agency_offices"("agency_id", "name", "country_id", COALESCE("state_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("lga_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX "agency_offices_agency_id_is_active_idx" ON "agency_offices"("agency_id", "is_active");
CREATE INDEX "agency_offices_state_id_lga_id_ward_id_idx" ON "agency_offices"("state_id", "lga_id", "ward_id");
CREATE INDEX "agency_offices_latitude_longitude_idx" ON "agency_offices"("latitude", "longitude");
CREATE UNIQUE INDEX "agency_jurisdictions_identity_key" ON "agency_jurisdictions"("agency_id", COALESCE("office_id", '00000000-0000-0000-0000-000000000000'::uuid), "coverage_type", "country_id", COALESCE("state_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("lga_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("ward_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX "agency_jurisdictions_lookup_idx" ON "agency_jurisdictions"("coverage_type", "country_id", "state_id", "lga_id", "ward_id", "is_active");
CREATE UNIQUE INDEX "agency_contacts_identity_key" ON "agency_contacts"("agency_id", COALESCE("office_id", '00000000-0000-0000-0000-000000000000'::uuid), "type", "value");
CREATE INDEX "agency_contacts_public_idx" ON "agency_contacts"("agency_id", "publicly_verified", "is_active");
CREATE UNIQUE INDEX "agency_incident_capabilities_agency_id_incident_type_key" ON "agency_incident_capabilities"("agency_id", "incident_type");
CREATE INDEX "agency_incident_capabilities_lookup_idx" ON "agency_incident_capabilities"("incident_type", "priority", "is_active");

ALTER TABLE "countries" ADD CONSTRAINT "countries_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "reference_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "administrative_states" ADD CONSTRAINT "administrative_states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "administrative_states" ADD CONSTRAINT "administrative_states_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "reference_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_government_areas" ADD CONSTRAINT "local_government_areas_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "administrative_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "local_government_areas" ADD CONSTRAINT "local_government_areas_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "reference_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wards" ADD CONSTRAINT "wards_lga_id_fkey" FOREIGN KEY ("lga_id") REFERENCES "local_government_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wards" ADD CONSTRAINT "wards_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "reference_data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_country_ref_id_fkey" FOREIGN KEY ("country_ref_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_state_ref_id_fkey" FOREIGN KEY ("state_ref_id") REFERENCES "administrative_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_lga_ref_id_fkey" FOREIGN KEY ("lga_ref_id") REFERENCES "local_government_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_ward_ref_id_fkey" FOREIGN KEY ("ward_ref_id") REFERENCES "wards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_state_country_ref_fkey" FOREIGN KEY ("state_ref_id", "country_ref_id") REFERENCES "administrative_states"("id", "country_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_lga_state_ref_fkey" FOREIGN KEY ("lga_ref_id", "state_ref_id") REFERENCES "local_government_areas"("id", "state_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "jurisdictions" ADD CONSTRAINT "jurisdictions_ward_lga_ref_fkey" FOREIGN KEY ("ward_ref_id", "lga_ref_id") REFERENCES "wards"("id", "lga_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_parent_office_id_fkey" FOREIGN KEY ("parent_office_id") REFERENCES "agency_offices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_police_station_id_fkey" FOREIGN KEY ("police_station_id") REFERENCES "police_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "administrative_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_lga_id_fkey" FOREIGN KEY ("lga_id") REFERENCES "local_government_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_state_country_fkey" FOREIGN KEY ("state_id", "country_id") REFERENCES "administrative_states"("id", "country_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_lga_state_fkey" FOREIGN KEY ("lga_id", "state_id") REFERENCES "local_government_areas"("id", "state_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_offices" ADD CONSTRAINT "agency_offices_ward_lga_fkey" FOREIGN KEY ("ward_id", "lga_id") REFERENCES "wards"("id", "lga_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "agency_offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "administrative_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_lga_id_fkey" FOREIGN KEY ("lga_id") REFERENCES "local_government_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_state_country_fkey" FOREIGN KEY ("state_id", "country_id") REFERENCES "administrative_states"("id", "country_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_lga_state_fkey" FOREIGN KEY ("lga_id", "state_id") REFERENCES "local_government_areas"("id", "state_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_jurisdictions" ADD CONSTRAINT "agency_jurisdictions_ward_lga_fkey" FOREIGN KEY ("ward_id", "lga_id") REFERENCES "wards"("id", "lga_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agency_contacts" ADD CONSTRAINT "agency_contacts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_contacts" ADD CONSTRAINT "agency_contacts_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "agency_offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agency_incident_capabilities" ADD CONSTRAINT "agency_incident_capabilities_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
