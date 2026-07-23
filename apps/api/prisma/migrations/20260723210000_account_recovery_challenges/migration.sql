-- CreateTable
CREATE TABLE "account_recovery_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "email_hash" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'recover_access',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_ip_hash" TEXT,
    "request_device" JSONB NOT NULL DEFAULT '{}',
    "completed_by_provider_uid" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_recovery_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_recovery_challenges_token_hash_key" ON "account_recovery_challenges"("token_hash");
CREATE INDEX "account_recovery_challenges_user_id_status_idx" ON "account_recovery_challenges"("user_id", "status");
CREATE INDEX "account_recovery_challenges_expires_at_idx" ON "account_recovery_challenges"("expires_at");

ALTER TABLE "account_recovery_challenges" ADD CONSTRAINT "account_recovery_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
