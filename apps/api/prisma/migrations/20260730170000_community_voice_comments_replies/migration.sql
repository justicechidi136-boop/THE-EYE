-- Neighborhood Watch voice comments, replies, and nullable post/comment bodies.

ALTER TABLE "community_posts" ALTER COLUMN "body" DROP NOT NULL;

ALTER TABLE "community_post_comments"
  ADD COLUMN "parent_comment_id" UUID,
  ALTER COLUMN "body" DROP NOT NULL;

ALTER TABLE "community_post_comments"
  ADD CONSTRAINT "community_post_comments_parent_comment_id_fkey"
  FOREIGN KEY ("parent_comment_id") REFERENCES "community_post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "community_post_comments_parent_comment_id_idx" ON "community_post_comments"("parent_comment_id");

CREATE TABLE "community_comment_media" (
  "id" UUID NOT NULL,
  "comment_id" UUID NOT NULL,
  "uploader_id" UUID NOT NULL,
  "media_type" "MediaType" NOT NULL,
  "bucket" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "file_hash" TEXT NOT NULL,
  "captured_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duration_seconds" INTEGER,
  "client_attachment_id" TEXT,
  "selected_language" TEXT,
  "detected_language" TEXT,
  "language_detection_confidence" DECIMAL(5,4),
  "transcription_status" "VoiceTranscriptionStatus",
  "transcript" TEXT,
  "translated_transcript" TEXT,
  "transcription_confidence" DECIMAL(5,4),
  "transcription_provider" TEXT,
  "transcription_error_code" TEXT,
  "transcription_processed_at" TIMESTAMPTZ(6),
  "moderation_status" "VoiceModerationStatus",
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "community_comment_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_comment_media_file_hash_key" ON "community_comment_media"("file_hash");
CREATE INDEX "community_comment_media_comment_id_idx" ON "community_comment_media"("comment_id");
CREATE INDEX "community_comment_media_transcription_status_idx" ON "community_comment_media"("transcription_status");
CREATE INDEX "community_comment_media_client_attachment_id_idx" ON "community_comment_media"("client_attachment_id");

ALTER TABLE "community_comment_media"
  ADD CONSTRAINT "community_comment_media_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "community_post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_comment_media"
  ADD CONSTRAINT "community_comment_media_uploader_id_fkey"
  FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
