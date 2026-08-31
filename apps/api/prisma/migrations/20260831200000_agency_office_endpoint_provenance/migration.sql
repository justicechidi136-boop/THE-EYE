CREATE TYPE "AgencyCoordinateEvidenceClass" AS ENUM (
  'AUTHORITATIVE_COORDINATE',
  'VERIFIED_ADDRESS_GEOCODE',
  'THIRD_PARTY_REFERENCE',
  'UNKNOWN'
);

ALTER TABLE "agency_offices"
  ADD COLUMN "address_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "address_source_url" TEXT,
  ADD COLUMN "address_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "coordinate_evidence_class" "AgencyCoordinateEvidenceClass" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "coordinates_source_url" TEXT,
  ADD COLUMN "coordinates_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "operating_hours_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "operating_hours_source_url" TEXT,
  ADD COLUMN "operating_hours_verified_at" TIMESTAMPTZ(6);
