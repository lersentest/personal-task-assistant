-- Add public task workspace fields and delegated-task attachments.
ALTER TABLE "delegated_tasks"
  ADD COLUMN "public_access_token" UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "public_access_revoked_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "delegated_tasks_public_access_token_key"
  ON "delegated_tasks"("public_access_token");

CREATE INDEX "delegated_tasks_public_access_token_public_access_revoked_at_idx"
  ON "delegated_tasks"("public_access_token", "public_access_revoked_at");

ALTER TABLE "attachments"
  ADD COLUMN "delegated_task_id" UUID;

CREATE INDEX "attachments_delegated_task_id_idx"
  ON "attachments"("delegated_task_id");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_delegated_task_id_fkey"
  FOREIGN KEY ("delegated_task_id") REFERENCES "delegated_tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
