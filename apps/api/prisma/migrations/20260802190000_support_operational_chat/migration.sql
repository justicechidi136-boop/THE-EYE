-- Support operational chat for admin live chat workspace.

CREATE TYPE "SupportConversationType" AS ENUM (
  'Incident',
  'CitizenSupport',
  'Agency',
  'Responder'
);

CREATE TYPE "SupportConversationStatus" AS ENUM (
  'Open',
  'Pending',
  'Escalated',
  'Closed'
);

CREATE TYPE "SupportConversationPriority" AS ENUM (
  'Urgent',
  'High',
  'Normal',
  'Low'
);

CREATE TYPE "SupportParticipantRole" AS ENUM (
  'Citizen',
  'Admin',
  'Agency',
  'Responder',
  'System'
);

CREATE TABLE "support_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "type" "SupportConversationType" NOT NULL,
  "status" "SupportConversationStatus" NOT NULL DEFAULT 'Open',
  "priority" "SupportConversationPriority" NOT NULL DEFAULT 'Normal',
  "subject" TEXT NOT NULL,
  "incident_id" UUID,
  "assigned_admin_id" UUID,
  "country" TEXT,
  "state" TEXT,
  "lga" TEXT,
  "unread_admin" INTEGER NOT NULL DEFAULT 0,
  "unread_citizen" INTEGER NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "closed_by_id" UUID,
  "close_reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_conversations_reference_key" UNIQUE ("reference"),
  CONSTRAINT "support_conversations_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_conversations_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_conversations_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "support_conversations_status_priority_last_message_at_idx" ON "support_conversations"("status", "priority", "last_message_at");
CREATE INDEX "support_conversations_incident_id_idx" ON "support_conversations"("incident_id");
CREATE INDEX "support_conversations_assigned_admin_id_status_idx" ON "support_conversations"("assigned_admin_id", "status");
CREATE INDEX "support_conversations_country_state_lga_idx" ON "support_conversations"("country", "state", "lga");

CREATE TABLE "support_conversation_participants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "role" "SupportParticipantRole" NOT NULL,
  "admin_user_id" UUID,
  "user_id" UUID,
  "display_name" TEXT NOT NULL,
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "left_at" TIMESTAMPTZ(6),
  CONSTRAINT "support_conversation_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_conversation_participants_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "support_conversation_participants_conversation_id_idx" ON "support_conversation_participants"("conversation_id");

CREATE TABLE "support_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "sender_role" "SupportParticipantRole" NOT NULL,
  "admin_user_id" UUID,
  "user_id" UUID,
  "body" TEXT NOT NULL,
  "is_internal" BOOLEAN NOT NULL DEFAULT false,
  "has_attachment" BOOLEAN NOT NULL DEFAULT false,
  "attachment_key" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_messages_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "support_messages_conversation_id_created_at_idx" ON "support_messages"("conversation_id", "created_at");
