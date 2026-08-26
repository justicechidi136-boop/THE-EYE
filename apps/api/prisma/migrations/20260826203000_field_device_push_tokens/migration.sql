CREATE TABLE "field_device_push_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "field_device_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'firebase-cloud-messaging',
    "app_environment" TEXT NOT NULL DEFAULT 'development',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "field_device_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_device_push_tokens_token_key"
    ON "field_device_push_tokens"("token");
CREATE INDEX "field_device_push_tokens_field_device_id_is_active_app_environment_idx"
    ON "field_device_push_tokens"("field_device_id", "is_active", "app_environment");

ALTER TABLE "field_device_push_tokens"
    ADD CONSTRAINT "field_device_push_tokens_field_device_id_fkey"
    FOREIGN KEY ("field_device_id") REFERENCES "field_devices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
