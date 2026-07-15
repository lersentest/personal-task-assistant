ALTER TABLE "attachments"
  DROP CONSTRAINT IF EXISTS "attachments_single_parent_check";

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_single_parent_check" CHECK (
    (
      CASE WHEN "task_id" IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN "project_id" IS NOT NULL THEN 1 ELSE 0 END
      + CASE WHEN "delegated_task_id" IS NOT NULL THEN 1 ELSE 0 END
    ) = 1
  );
