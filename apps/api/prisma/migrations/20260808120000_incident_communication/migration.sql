-- Phase 6: Incident-scoped reporter/dispatcher/responder communication

CREATE TYPE "IncidentConversationStatus" AS ENUM ('Active', 'Restricted', 'Closed', 'Archived');
CREATE TYPE "IncidentMessageType" AS ENUM (
  'Text', 'Voice', 'Image', 'Video', 'SystemUpdate', 'InformationRequest',
  'QuickReply', 'LocationUpdate', 'SafetyInstruction', 'OfficialNotice'
);
CREATE TYPE "IncidentMessageModerationStatus" AS ENUM ('Pending', 'Approved', 'Flagged', 'Hidden');
CREATE TYPE "IncidentInformationRequestStatus" AS ENUM ('Open', 'Responded', 'Expired', 'Cancelled');

CREATE TABLE "incident_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "incident_id" UUID NOT NULL,
  "status" "IncidentConversationStatus" NOT NULL DEFAULT 'Active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "last_message_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "closed_by_id" UUID,
  "close_reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_conversations_incident_id_key" UNIQUE ("incident_id"),
  CONSTRAINT "incident_conversations_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "incident_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "sender_user_id" UUID,
  "sender_admin_id" UUID,
  "sender_role" TEXT NOT NULL,
  "sender_agency_id" UUID,
  "sender_responder_id" UUID,
  "message_type" "IncidentMessageType" NOT NULL,
  "body" TEXT NOT NULL,
  "attachment_id" UUID,
  "structured_action" JSONB,
  "reply_to_message_id" UUID,
  "client_message_id" TEXT,
  "moderation_status" "IncidentMessageModerationStatus" NOT NULL DEFAULT 'Approved',
  "delivery_version" INTEGER NOT NULL DEFAULT 1,
  "is_internal" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "incident_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "incident_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_messages_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "incident_messages_sender_admin_id_fkey" FOREIGN KEY ("sender_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "incident_messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "incident_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "incident_messages_conversation_id_client_message_id_key"
  ON "incident_messages"("conversation_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;

CREATE INDEX "incident_messages_conversation_id_created_at_idx" ON "incident_messages"("conversation_id", "created_at");
CREATE INDEX "incident_messages_incident_id_created_at_idx" ON "incident_messages"("incident_id", "created_at");
CREATE INDEX "incident_messages_sender_user_id_created_at_idx" ON "incident_messages"("sender_user_id", "created_at");

CREATE TABLE "incident_message_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "recipient_user_id" UUID,
  "recipient_admin_id" UUID,
  "recipient_context" TEXT,
  "delivered_at" TIMESTAMPTZ(6),
  "read_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "failure_code" TEXT,
  "delivery_channel" TEXT NOT NULL DEFAULT 'in_app',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_message_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_message_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "incident_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_message_receipts_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "incident_message_receipts_message_id_idx" ON "incident_message_receipts"("message_id");
CREATE INDEX "incident_message_receipts_recipient_user_id_read_at_idx" ON "incident_message_receipts"("recipient_user_id", "read_at");

CREATE TABLE "incident_information_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "request_type" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "allowed_reply_types" JSONB NOT NULL DEFAULT '[]',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMPTZ(6),
  "requested_by_admin_id" UUID,
  "status" "IncidentInformationRequestStatus" NOT NULL DEFAULT 'Open',
  "response_message_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_information_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_information_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "incident_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_information_requests_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "incident_information_requests_requested_by_admin_id_fkey" FOREIGN KEY ("requested_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "incident_information_requests_incident_id_status_created_at_idx"
  ON "incident_information_requests"("incident_id", "status", "created_at");
CREATE INDEX "incident_information_requests_conversation_id_created_at_idx"
  ON "incident_information_requests"("conversation_id", "created_at");

CREATE INDEX "incident_conversations_status_last_message_at_idx"
  ON "incident_conversations"("status", "last_message_at");
