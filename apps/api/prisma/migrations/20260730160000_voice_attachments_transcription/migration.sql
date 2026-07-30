-- Voice attachment and transcription support for incident and community media.

CREATE TYPE "VoiceTranscriptionStatus" AS ENUM ('Uploaded', 'Queued', 'Processing', 'Completed', 'LowConfidence', 'Failed');
CREATE TYPE "VoiceModerationStatus" AS ENUM ('Pending', 'Approved', 'Flagged', 'Rejected');

ALTER TABLE "incident_media"
  ADD COLUMN "duration_seconds" INTEGER,
  ADD COLUMN "client_attachment_id" TEXT,
  ADD COLUMN "selected_language" TEXT,
  ADD COLUMN "detected_language" TEXT,
  ADD COLUMN "language_detection_confidence" DECIMAL(5,4),
  ADD COLUMN "transcription_status" "VoiceTranscriptionStatus",
  ADD COLUMN "transcript" TEXT,
  ADD COLUMN "translated_transcript" TEXT,
  ADD COLUMN "transcription_confidence" DECIMAL(5,4),
  ADD COLUMN "transcription_provider" TEXT,
  ADD COLUMN "transcription_error_code" TEXT,
  ADD COLUMN "transcription_processed_at" TIMESTAMPTZ(6),
  ADD COLUMN "moderation_status" "VoiceModerationStatus",
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE INDEX "incident_media_transcription_status_idx" ON "incident_media"("transcription_status");
CREATE INDEX "incident_media_client_attachment_id_idx" ON "incident_media"("client_attachment_id");

ALTER TABLE "community_post_media"
  ADD COLUMN "duration_seconds" INTEGER,
  ADD COLUMN "client_attachment_id" TEXT,
  ADD COLUMN "selected_language" TEXT,
  ADD COLUMN "detected_language" TEXT,
  ADD COLUMN "language_detection_confidence" DECIMAL(5,4),
  ADD COLUMN "transcription_status" "VoiceTranscriptionStatus",
  ADD COLUMN "transcript" TEXT,
  ADD COLUMN "translated_transcript" TEXT,
  ADD COLUMN "transcription_confidence" DECIMAL(5,4),
  ADD COLUMN "transcription_provider" TEXT,
  ADD COLUMN "transcription_error_code" TEXT,
  ADD COLUMN "transcription_processed_at" TIMESTAMPTZ(6),
  ADD COLUMN "moderation_status" "VoiceModerationStatus",
  ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE INDEX "community_post_media_transcription_status_idx" ON "community_post_media"("transcription_status");
CREATE INDEX "community_post_media_client_attachment_id_idx" ON "community_post_media"("client_attachment_id");
