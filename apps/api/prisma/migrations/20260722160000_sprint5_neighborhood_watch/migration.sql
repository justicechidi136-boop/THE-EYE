-- Sprint 5: community status, citizen requests, content reports
CREATE TYPE "CommunityStatus" AS ENUM ('Active', 'Archived', 'Suspended');
CREATE TYPE "CommunityRequestStatus" AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE "CommunityReportTargetType" AS ENUM ('Post', 'Comment', 'Member');
CREATE TYPE "CommunityReportStatus" AS ENUM ('Pending', 'Reviewed', 'Dismissed');

ALTER TABLE "communities" ADD COLUMN "status" "CommunityStatus" NOT NULL DEFAULT 'Active';
CREATE INDEX "communities_status_idx" ON "communities"("status");

CREATE TABLE "community_requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "lga" TEXT,
    "ward" TEXT,
    "estate" TEXT,
    "street" TEXT,
    "visibility" "CommunityVisibility" NOT NULL DEFAULT 'Private',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "status" "CommunityRequestStatus" NOT NULL DEFAULT 'Pending',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_note" TEXT,
    "community_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "community_content_reports" (
    "id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" "CommunityReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason_code" TEXT NOT NULL,
    "note" TEXT,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'Pending',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_content_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "community_requests_status_created_at_idx" ON "community_requests"("status", "created_at");
CREATE INDEX "community_requests_requester_id_idx" ON "community_requests"("requester_id");
CREATE INDEX "community_requests_country_state_lga_idx" ON "community_requests"("country", "state", "lga");
CREATE INDEX "community_content_reports_community_id_status_created_at_idx" ON "community_content_reports"("community_id", "status", "created_at");
CREATE INDEX "community_content_reports_target_type_target_id_idx" ON "community_content_reports"("target_type", "target_id");

ALTER TABLE "community_requests" ADD CONSTRAINT "community_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_requests" ADD CONSTRAINT "community_requests_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "community_content_reports" ADD CONSTRAINT "community_content_reports_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_content_reports" ADD CONSTRAINT "community_content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
