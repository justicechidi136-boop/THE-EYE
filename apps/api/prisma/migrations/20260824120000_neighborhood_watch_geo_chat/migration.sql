ALTER TABLE "community_posts"
  ADD COLUMN "reply_to_post_id" UUID,
  ADD COLUMN "client_message_id" TEXT,
  ADD COLUMN "edited_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "community_posts_client_message_id_key"
  ON "community_posts"("client_message_id");

CREATE INDEX "community_posts_reply_to_post_id_idx"
  ON "community_posts"("reply_to_post_id");

ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_reply_to_post_id_fkey"
  FOREIGN KEY ("reply_to_post_id") REFERENCES "community_posts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
