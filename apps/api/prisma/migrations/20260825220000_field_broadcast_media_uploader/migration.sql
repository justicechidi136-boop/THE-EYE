ALTER TABLE "broadcast_media"
  ALTER COLUMN "uploader_id" DROP NOT NULL,
  ADD COLUMN "uploader_admin_id" UUID;

ALTER TABLE "broadcast_media"
  ADD CONSTRAINT "broadcast_media_uploader_admin_id_fkey"
  FOREIGN KEY ("uploader_admin_id") REFERENCES "admin_users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broadcast_media"
  ADD CONSTRAINT "broadcast_media_exactly_one_uploader_check"
  CHECK (
    ("uploader_id" IS NOT NULL AND "uploader_admin_id" IS NULL)
    OR
    ("uploader_id" IS NULL AND "uploader_admin_id" IS NOT NULL)
  );

CREATE INDEX "broadcast_media_uploader_admin_id_idx"
  ON "broadcast_media"("uploader_admin_id");
