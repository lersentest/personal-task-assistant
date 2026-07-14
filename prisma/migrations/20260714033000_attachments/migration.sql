CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "task_id" UUID,
    "project_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attachments_single_parent_check" CHECK (
      ("task_id" IS NOT NULL AND "project_id" IS NULL)
      OR ("task_id" IS NULL AND "project_id" IS NOT NULL)
    )
);

CREATE INDEX "attachments_owner_id_created_at_idx" ON "attachments"("owner_id", "created_at");
CREATE INDEX "attachments_task_id_idx" ON "attachments"("task_id");
CREATE INDEX "attachments_project_id_idx" ON "attachments"("project_id");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
