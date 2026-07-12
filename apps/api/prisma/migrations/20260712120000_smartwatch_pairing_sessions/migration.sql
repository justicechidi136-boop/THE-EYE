CREATE TABLE IF NOT EXISTS "smartwatch_pairing_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" TEXT NOT NULL,
    "pairing_code_hash" TEXT NOT NULL,
    "firebase_env" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "device_secret_plain" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smartwatch_pairing_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "smartwatch_pairing_sessions_device_id_key"
    ON "smartwatch_pairing_sessions"("device_id");

CREATE INDEX IF NOT EXISTS "smartwatch_pairing_sessions_expires_at_idx"
    ON "smartwatch_pairing_sessions"("expires_at");
