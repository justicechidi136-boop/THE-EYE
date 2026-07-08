ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "sequence" BIGINT,
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "event_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "chain_version" INTEGER NOT NULL DEFAULT 1;

CREATE SEQUENCE IF NOT EXISTS audit_logs_sequence_seq;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC)::bigint AS rn
  FROM audit_logs
  WHERE sequence IS NULL
)
UPDATE audit_logs a
SET sequence = ordered.rn
FROM ordered
WHERE a.id = ordered.id;

SELECT setval(
  'audit_logs_sequence_seq',
  GREATEST((SELECT COALESCE(MAX(sequence), 0) FROM audit_logs), 1),
  true
);

ALTER TABLE "audit_logs"
  ALTER COLUMN "sequence" SET DEFAULT nextval('audit_logs_sequence_seq');

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_sequence_key" ON "audit_logs"("sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_event_hash_key" ON "audit_logs"("event_hash") WHERE "event_hash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "audit_logs_event_hash_idx" ON "audit_logs"("event_hash");
CREATE INDEX IF NOT EXISTS "audit_logs_reason_idx" ON "audit_logs"("reason");

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_prevent_update ON "audit_logs";
CREATE TRIGGER audit_logs_prevent_update
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON "audit_logs";
CREATE TRIGGER audit_logs_prevent_delete
BEFORE DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
