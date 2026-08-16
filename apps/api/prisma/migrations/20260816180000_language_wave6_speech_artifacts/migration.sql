CREATE TYPE "SpeechContentProvenance" AS ENUM ('ORIGINAL', 'TRANSCRIPT', 'TRANSLATION', 'SYNTHESIZED_SPEECH');

CREATE TYPE "LanguageProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNSUPPORTED');

CREATE TABLE "speech_artifacts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source_type" text NOT NULL,
  "source_id" uuid NOT NULL,
  "provenance" "SpeechContentProvenance" NOT NULL,
  "source_locale" text,
  "detected_locale" text,
  "language_confidence" decimal(5,4),
  "content" text,
  "source_hash" text,
  "provider" text,
  "model" text,
  "confidence" decimal(5,4),
  "status" "LanguageProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "error_code" text,
  "generated_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "speech_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "speech_translations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "speech_artifact_id" uuid NOT NULL,
  "target_locale" text NOT NULL,
  "source_locale" text,
  "translated_text" text,
  "provider" text,
  "model" text,
  "confidence" decimal(5,4),
  "status" "LanguageProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "error_code" text,
  "generated_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "speech_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "speech_artifacts_source_type_source_id_provenance_key"
  ON "speech_artifacts"("source_type", "source_id", "provenance");
CREATE INDEX "speech_artifacts_source_type_source_id_idx" ON "speech_artifacts"("source_type", "source_id");
CREATE INDEX "speech_artifacts_status_idx" ON "speech_artifacts"("status");

CREATE UNIQUE INDEX "speech_translations_speech_artifact_id_target_locale_key"
  ON "speech_translations"("speech_artifact_id", "target_locale");
CREATE INDEX "speech_translations_target_locale_idx" ON "speech_translations"("target_locale");
CREATE INDEX "speech_translations_status_idx" ON "speech_translations"("status");

ALTER TABLE "speech_translations"
  ADD CONSTRAINT "speech_translations_speech_artifact_id_fkey"
  FOREIGN KEY ("speech_artifact_id") REFERENCES "speech_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
