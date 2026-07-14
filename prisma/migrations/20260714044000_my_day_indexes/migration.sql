CREATE INDEX "tasks_owner_id_status_deleted_at_due_at_idx"
ON "tasks"("owner_id", "status", "deleted_at", "due_at");

CREATE INDEX "tasks_owner_id_status_deleted_at_updated_at_idx"
ON "tasks"("owner_id", "status", "deleted_at", "updated_at");
