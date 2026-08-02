enum SupportConversationType {
  Incident
  CitizenSupport
  Agency
  Responder
}

enum SupportConversationStatus {
  Open
  Pending
  Escalated
  Closed
}

enum SupportConversationPriority {
  Urgent
  High
  Normal
  Low
}

enum SupportParticipantRole {
  Citizen
  Admin
  Agency
  Responder
  System
}

model SupportConversation {
  id              String                       @id @default(uuid()) @db.Uuid
  reference       String                       @unique
  type            SupportConversationType
  status          SupportConversationStatus    @default(Open)
  priority        SupportConversationPriority  @default(Normal)
  subject         String
  incidentId      String?                      @map("incident_id") @db.Uuid
  assignedAdminId String?                      @map("assigned_admin_id") @db.Uuid
  country         String?
  state           String?
  lga             String?
  unreadAdmin     Int                          @default(0) @map("unread_admin")
  unreadCitizen   Int                          @default(0) @map("unread_citizen")
  lastMessageAt   DateTime?                    @map("last_message_at") @db.Timestamptz(6)
  closedAt        DateTime?                    @map("closed_at") @db.Timestamptz(6)
  closedById      String?                      @map("closed_by_id") @db.Uuid
  closeReason     String?                      @map("close_reason")
  metadata        Json                         @default("{}")
  version         Int                          @default(0)
  createdAt       DateTime                     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime                     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  incident        Incident?                    @relation(fields: [incidentId], references: [id])
  assignedAdmin   AdminUser?                   @relation("SupportConversationAssignee", fields: [assignedAdminId], references: [id])
  closedBy        AdminUser?                   @relation("SupportConversationClosedBy", fields: [closedById], references: [id])
  messages        SupportMessage[]
  participants    SupportConversationParticipant[]

  @@index([status, priority, lastMessageAt])
  @@index([incidentId])
  @@index([assignedAdminId, status])
  @@index([country, state, lga])
  @@map("support_conversations")
}

model SupportConversationParticipant {
  id               String                @id @default(uuid()) @db.Uuid
  conversationId   String                @map("conversation_id") @db.Uuid
  role             SupportParticipantRole
  adminUserId      String?               @map("admin_user_id") @db.Uuid
  userId           String?               @map("user_id") @db.Uuid
  displayName      String                @map("display_name")
  joinedAt         DateTime              @default(now()) @map("joined_at") @db.Timestamptz(6)
  leftAt           DateTime?             @map("left_at") @db.Timestamptz(6)
  conversation     SupportConversation   @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  adminUser        AdminUser?            @relation("SupportParticipantAdmin", fields: [adminUserId], references: [id])
  user             User?                 @relation("SupportParticipantUser", fields: [userId], references: [id])

  @@index([conversationId])
  @@map("support_conversation_participants")
}

model SupportMessage {
  id               String              @id @default(uuid()) @db.Uuid
  conversationId   String              @map("conversation_id") @db.Uuid
  senderRole       SupportParticipantRole @map("sender_role")
  adminUserId      String?             @map("admin_user_id") @db.Uuid
  userId           String?             @map("user_id") @db.Uuid
  body             String
  isInternal       Boolean             @default(false) @map("is_internal")
  hasAttachment    Boolean             @default(false) @map("has_attachment")
  attachmentKey    String?             @map("attachment_key")
  createdAt        DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  conversation     SupportConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  adminUser        AdminUser?          @relation("SupportMessageAdmin", fields: [adminUserId], references: [id])
  user             User?               @relation("SupportMessageUser", fields: [userId], references: [id])

  @@index([conversationId, createdAt])
  @@map("support_messages")
}
