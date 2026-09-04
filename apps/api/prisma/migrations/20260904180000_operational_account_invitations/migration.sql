-- Wave D adds canonical city/town scope and secure operational-account invitations.
ALTER TYPE "CommunityLevel" ADD VALUE IF NOT EXISTS 'CityTown';

CREATE TYPE "AdminAccountStatus" AS ENUM ('PendingActivation', 'Active', 'Deactivated');
CREATE TYPE "AdminInvitationStatus" AS ENUM ('Pending', 'Sent', 'Accepted', 'Failed', 'Expired');

ALTER TABLE "admin_users"
  ADD COLUMN "community_id" UUID,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "account_status" "AdminAccountStatus" NOT NULL DEFAULT 'Active',
  ADD COLUMN "activated_at" TIMESTAMPTZ(6);

UPDATE "admin_users"
SET "account_status" = CASE WHEN "is_active" THEN 'Active'::"AdminAccountStatus" ELSE 'Deactivated'::"AdminAccountStatus" END,
    "activated_at" = CASE WHEN "is_active" THEN "created_at" ELSE NULL END;

CREATE TABLE "admin_account_invitations" (
  "id" UUID NOT NULL,
  "admin_user_id" UUID NOT NULL,
  "created_by_admin_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "status" "AdminInvitationStatus" NOT NULL DEFAULT 'Pending',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "sent_at" TIMESTAMPTZ(6),
  "accepted_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_account_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_account_invitations_token_hash_key" ON "admin_account_invitations"("token_hash");
CREATE INDEX "admin_users_community_id_idx" ON "admin_users"("community_id");
CREATE INDEX "admin_users_account_status_idx" ON "admin_users"("account_status");
CREATE INDEX "admin_account_invitations_admin_user_id_status_idx" ON "admin_account_invitations"("admin_user_id", "status");
CREATE INDEX "admin_account_invitations_expires_at_idx" ON "admin_account_invitations"("expires_at");

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_account_invitations" ADD CONSTRAINT "admin_account_invitations_admin_user_id_fkey"
  FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_account_invitations" ADD CONSTRAINT "admin_account_invitations_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
