-- Enforce ONE DEVICE ID = MAXIMUM ONE ACTIVE ACTIVATION CODE after lifecycle
-- fields and enum values are committed.

WITH duplicate_devices AS (
  SELECT "field_device_id", COUNT(*)::int AS active_count
  FROM "field_device_pairing_tokens"
  WHERE "status" IN ('Issued', 'Claimed')
  GROUP BY "field_device_id"
  HAVING COUNT(*) > 1
),
deactivated AS (
  UPDATE "field_devices" fd
  SET
    "registration_status" = 'Deactivated',
    "deactivation_reason" = 'DUPLICATE_ACTIVE_ACTIVATION_CODES',
    "security_deactivated_at" = NOW(),
    "requires_re_pair" = TRUE,
    "token_version" = "token_version" + 1,
    "updated_at" = NOW()
  FROM duplicate_devices d
  WHERE fd."id" = d."field_device_id"
  RETURNING fd."id", fd."public_device_id", d.active_count
),
revoked AS (
  UPDATE "field_device_pairing_tokens" t
  SET
    "status" = 'Revoked',
    "cancelled_at" = NOW(),
    "revoked_reason" = 'DUPLICATE_ACTIVE_ACTIVATION_CODES',
    "updated_at" = NOW()
  FROM duplicate_devices d
  WHERE t."field_device_id" = d."field_device_id"
    AND t."status" IN ('Issued', 'Claimed')
  RETURNING t."field_device_id"
),
revoked_sessions AS (
  UPDATE "field_device_sessions" s
  SET "revoked_at" = NOW()
  FROM duplicate_devices d
  WHERE s."field_device_id" = d."field_device_id"
    AND s."revoked_at" IS NULL
  RETURNING s."field_device_id"
)
INSERT INTO "audit_logs" (
  "id",
  "actor_type",
  "action",
  "entity_type",
  "entity_id",
  "reason",
  "metadata",
  "created_at"
)
SELECT
  gen_random_uuid(),
  'system',
  'DEVICE_DUPLICATE_ACTIVE_CODE_DETECTED',
  'field_device',
  d."id",
  'DUPLICATE_ACTIVE_ACTIVATION_CODES',
  jsonb_build_object(
    'deviceType', 'field_tablet',
    'publicDeviceId', d."public_device_id",
    'activeCodeCount', d.active_count,
    'result', 'DEVICE_DEACTIVATED_ALL_CODES_REVOKED'
  ),
  NOW()
FROM deactivated d;

CREATE UNIQUE INDEX IF NOT EXISTS "field_device_pairing_tokens_one_active_per_device"
  ON "field_device_pairing_tokens" ("field_device_id")
  WHERE "status" IN ('Issued', 'Claimed');

CREATE INDEX IF NOT EXISTS "smartwatch_pairing_sessions_device_status_idx"
  ON "smartwatch_pairing_sessions" ("device_id", "status");
