CREATE TABLE "task_checklist_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "task_id" UUID NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "is_completed" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),
  "deleted_at" TIMESTAMPTZ(3),

  CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_checklist_items_task_id_deleted_at_position_idx"
ON "task_checklist_items"("task_id", "deleted_at", "position");

ALTER TABLE "task_checklist_items"
ADD CONSTRAINT "task_checklist_items_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
