-- Mobile citizen support chat: extended conversation model, message types, citizen ownership.

CREATE TYPE "SupportCategory" AS ENUM (
  'EmergencyReport',
  'LiveVideo',
  'AccountAccess',
  'Location',
  'PoliceLocator',
  'Smartwatch',
  'WhistleblowerReward',
  'Withdrawal',
  'Community',
  'EvidenceUpload',
  'Notification',
  'SafetyConcern',
  'AbuseReport',
  'TechnicalIssue',
  'Other'
);

CREATE TYPE "SupportMessageType" AS ENUM (
  'Text',
  'Voice',
  'Image',
  'Document',
  'System',
  'IncidentLink',
  'LocationUpdate'
);

CREATE TYPE "SupportMessageVisibility" AS ENUM (
  'UserVisible',
  'AdminInternal'
);

CREATE TYPE "SupportDeliveryStatus" AS ENUM (
  'Pending',
  'Sent',
  'Delivered',
  'Read',
  'Failed'
);

ALTER TYPE "SupportConversationStatus" ADD VALUE IF NOT EXISTS 'WaitingForAdmin';
ALTER TYPE "SupportConversationStatus" ADD VALUE IF NOT EXISTS 'WaitingForUser';
ALTER TYPE "SupportConversationStatus" ADD VALUE IF NOT EXISTS 'Assigned';
ALTER TYPE "SupportConversationStatus" ADD VALUE IF NOT EXISTS 'Resolved';
ALTER TYPE "SupportConversationStatus" ADD VALUE IF NOT EXISTS 'Reopened';
ALTER TYPE "SupportConversationStatus" ADD VALUE IF NOT EXISTS 'Spam';
ALTER TYPE "SupportConversationStatus" ADD VALUE IF NOT EXISTS 'Abusive';

ALTER TABLE "support_conversations"
  ADD COLUMN "user_id" UUID,
  ADD COLUMN "category" "SupportCategory" NOT NULL DEFAULT 'Other',
  ADD COLUMN "linked_report_id" UUID,
  ADD COLUMN "linked_withdrawal_id" UUID,
  ADD COLUMN "linked_watch_device_id" UUID,
  ADD COLUMN "linked_community_id" UUID,
  ADD COLUMN "protected_reporter_identity_id" UUID,
  ADD COLUMN "assigned_team" TEXT,
  ADD COLUMN "anonymous_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preferred_language" TEXT,
  ADD COLUMN "last_user_message_at" TIMESTAMPTZ(6),
  ADD COLUMN "last_admin_message_at" TIMESTAMPTZ(6),
  ADD COLUMN "reopened_at" TIMESTAMPTZ(6);

ALTER TABLE "support_conversations"
  ALTER COLUMN "type" SET DEFAULT 'CitizenSupport';

ALTER TABLE "support_conversations"
  ADD CONSTRAINT "support_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "support_conversations_user_id_status_last_message_at_idx"
  ON "support_conversations"("user_id", "status", "last_message_at");

CREATE INDEX "support_conversations_category_status_idx"
  ON "support_conversations"("category", "status");

ALTER TABLE "support_messages"
  ADD COLUMN "message_type" "SupportMessageType" NOT NULL DEFAULT 'Text',
  ADD COLUMN "client_message_id" TEXT,
  ADD COLUMN "reply_to_message_id" UUID,
  ADD COLUMN "visibility" "SupportMessageVisibility" NOT NULL DEFAULT 'UserVisible',
  ADD COLUMN "delivery_status" "SupportDeliveryStatus" NOT NULL DEFAULT 'Sent',
  ADD COLUMN "attachment_mime_type" TEXT,
  ADD COLUMN "attachment_size_bytes" INTEGER,
  ADD COLUMN "attachment_duration_seconds" INTEGER,
  ADD COLUMN "edited_at" TIMESTAMPTZ(6),
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "support_messages"
  ADD CONSTRAINT "support_messages_reply_to_message_id_fkey"
  FOREIGN KEY ("reply_to_message_id") REFERENCES "support_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "support_messages_conversation_id_client_message_id_key"
  ON "support_messages"("conversation_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;
