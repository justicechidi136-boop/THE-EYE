CREATE TABLE "danger_event_deliveries" (
    "id" UUID NOT NULL,
    "danger_event_id" UUID NOT NULL,
    "recipient_user_id" UUID,
    "recipient_key" TEXT NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "alert_revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "distance_meters" DECIMAL(10,2),
    "location_captured_at" TIMESTAMPTZ(6) NOT NULL,
    "notification_id" UUID,
    "last_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "danger_event_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "danger_event_deliveries_danger_event_id_fkey"
      FOREIGN KEY ("danger_event_id") REFERENCES "danger_events"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "danger_event_deliveries_danger_event_id_recipient_key_alert_revision_key"
  ON "danger_event_deliveries"("danger_event_id", "recipient_key", "alert_revision");
CREATE INDEX "danger_event_deliveries_recipient_user_id_created_at_idx"
  ON "danger_event_deliveries"("recipient_user_id", "created_at");
CREATE INDEX "danger_event_deliveries_danger_event_id_status_idx"
  ON "danger_event_deliveries"("danger_event_id", "status");
