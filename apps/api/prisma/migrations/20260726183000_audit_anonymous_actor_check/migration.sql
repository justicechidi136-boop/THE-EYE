-- Allow anonymous incident intake audit rows without fabricating actor IDs.
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_actor_check";

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_actor_check" CHECK (
  "actor_user_id" IS NOT NULL
  OR "actor_admin_id" IS NOT NULL
  OR "actor_type" IN ('system', 'anonymous')
);
