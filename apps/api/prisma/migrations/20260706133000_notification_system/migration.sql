ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'IncidentStatusUpdate',
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS "target_latitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "target_longitude" DECIMAL(9, 6),
  ADD COLUMN IF NOT EXISTS "target_location" geography(Point,4326),
  ADD COLUMN IF NOT EXISTS "target_radius_meters" INTEGER,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION set_notification_target_point()
RETURNS trigger AS $$
BEGIN
  IF NEW.target_latitude IS NOT NULL AND NEW.target_longitude IS NOT NULL THEN
    NEW.target_location := ST_SetSRID(ST_MakePoint(NEW.target_longitude, NEW.target_latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_set_target_point ON "notifications";
CREATE TRIGGER notifications_set_target_point
BEFORE INSERT OR UPDATE OF target_latitude, target_longitude
ON "notifications"
FOR EACH ROW EXECUTE FUNCTION set_notification_target_point();

CREATE TABLE IF NOT EXISTS "notification_delivery_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL,
  "channel" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "provider_message_id" TEXT,
  "error" TEXT,
  "request_payload" JSONB,
  "response_payload" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sent_at" TIMESTAMPTZ,
  "delivered_at" TIMESTAMPTZ,
  CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "notifications_type_priority_created_idx" ON "notifications"("type", "priority", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_target_location_idx" ON "notifications" USING GIST ("target_location");
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_notification_created_idx" ON "notification_delivery_logs"("notification_id", "created_at");
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_channel_status_created_idx" ON "notification_delivery_logs"("channel", "status", "created_at");

CREATE TABLE IF NOT EXISTS "user_push_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "device_id" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'firebase-cloud-messaging',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_push_tokens_token_key" ON "user_push_tokens"("token");
CREATE INDEX IF NOT EXISTS "user_push_tokens_user_active_idx" ON "user_push_tokens"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "user_push_tokens_platform_idx" ON "user_push_tokens"("platform");
