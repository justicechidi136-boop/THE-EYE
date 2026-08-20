ALTER TABLE "speech_artifacts" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "speech_translations" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "speech_syntheses" (
  "id" UUID NOT NULL,
  "speech_translation_id" UUID NOT NULL,
  "target_locale" TEXT NOT NULL,
  "provenance" TEXT NOT NULL DEFAULT 'SYNTHESIZED_SPEECH',
  "voice" TEXT,
  "bucket" TEXT,
  "object_key" TEXT,
  "content_type" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "status" "LanguageProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "error_code" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "generated_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "speech_syntheses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "speech_syntheses_speech_translation_id_version_key"
  ON "speech_syntheses"("speech_translation_id", "version");
CREATE INDEX "speech_syntheses_target_locale_status_idx"
  ON "speech_syntheses"("target_locale", "status");

CREATE TABLE "broadcast_comment_reactions" (
  "id" UUID NOT NULL,
  "comment_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "reaction" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_comment_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "broadcast_comment_reactions_comment_id_user_id_reaction_key"
  ON "broadcast_comment_reactions"("comment_id", "user_id", "reaction");
CREATE INDEX "broadcast_comment_reactions_comment_id_created_at_idx"
  ON "broadcast_comment_reactions"("comment_id", "created_at");

CREATE TABLE "broadcast_media" (
  "id" UUID NOT NULL,
  "broadcast_id" UUID NOT NULL,
  "sighting_id" UUID,
  "uploader_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "media_type" "MediaType" NOT NULL,
  "bucket" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "file_hash" TEXT,
  "size_bytes" BIGINT,
  "captured_at" TIMESTAMPTZ(6),
  "duration_seconds" INTEGER,
  "client_attachment_id" TEXT,
  "selected_language" TEXT,
  "detected_language" TEXT,
  "language_detection_confidence" DECIMAL(5,4),
  "transcription_status" "VoiceTranscriptionStatus",
  "transcript" TEXT,
  "transcription_confidence" DECIMAL(5,4),
  "transcription_provider" TEXT,
  "transcription_error_code" TEXT,
  "transcription_processed_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "broadcast_media_object_key_key" ON "broadcast_media"("object_key");
CREATE UNIQUE INDEX "broadcast_media_broadcast_id_client_attachment_id_key"
  ON "broadcast_media"("broadcast_id", "client_attachment_id");
CREATE INDEX "broadcast_media_broadcast_id_role_created_at_idx"
  ON "broadcast_media"("broadcast_id", "role", "created_at");
CREATE INDEX "broadcast_media_sighting_id_created_at_idx"
  ON "broadcast_media"("sighting_id", "created_at");
CREATE INDEX "broadcast_media_transcription_status_idx"
  ON "broadcast_media"("transcription_status");

ALTER TABLE "speech_syntheses"
  ADD CONSTRAINT "speech_syntheses_speech_translation_id_fkey"
  FOREIGN KEY ("speech_translation_id") REFERENCES "speech_translations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_comment_reactions"
  ADD CONSTRAINT "broadcast_comment_reactions_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "broadcast_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_comment_reactions"
  ADD CONSTRAINT "broadcast_comment_reactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_media"
  ADD CONSTRAINT "broadcast_media_broadcast_id_fkey"
  FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_media"
  ADD CONSTRAINT "broadcast_media_sighting_id_fkey"
  FOREIGN KEY ("sighting_id") REFERENCES "broadcast_sightings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_media"
  ADD CONSTRAINT "broadcast_media_uploader_id_fkey"
  FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
