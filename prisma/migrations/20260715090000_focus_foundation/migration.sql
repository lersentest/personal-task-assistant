CREATE TYPE "TaskKind" AS ENUM ('TASK', 'CALL', 'MEETING', 'IDEA', 'NOTE');
CREATE TYPE "ActivityEventType" AS ENUM ('TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'TASK_DELETED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'FILE_ADDED');

ALTER TABLE "tasks"
  ADD COLUMN "kind" "TaskKind" NOT NULL DEFAULT 'TASK',
  ADD COLUMN "is_flexible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "activity_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "type" "ActivityEventType" NOT NULL,
  "task_id" UUID,
  "project_id" UUID,
  "file_id" UUID,
  "title" VARCHAR(500) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_events_owner_id_created_at_idx" ON "activity_events"("owner_id", "created_at");
CREATE INDEX "activity_events_task_id_idx" ON "activity_events"("task_id");
CREATE INDEX "tasks_owner_id_kind_deleted_at_idx" ON "tasks"("owner_id", "kind", "deleted_at");

ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
