ALTER TABLE "broadcasts" ADD COLUMN "scheduled_at" TIMESTAMPTZ(6);

CREATE INDEX "broadcasts_scheduled_at_idx" ON "broadcasts"("scheduled_at");
