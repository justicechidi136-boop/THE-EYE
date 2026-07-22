-- Sprint 5: membership moderation fields and banned status
ALTER TYPE "CommunityMembershipStatus" ADD VALUE IF NOT EXISTS 'Banned';
ALTER TYPE "CommunityReportTargetType" ADD VALUE IF NOT EXISTS 'Community';

ALTER TABLE "community_memberships" ADD COLUMN IF NOT EXISTS "moderator_note" TEXT;
ALTER TABLE "community_memberships" ADD COLUMN IF NOT EXISTS "moderated_by_id" UUID;
ALTER TABLE "community_memberships" ADD COLUMN IF NOT EXISTS "moderated_at" TIMESTAMPTZ(6);
