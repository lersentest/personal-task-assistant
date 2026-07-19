INSERT INTO "projects" (
  "owner_id",
  "created_by_id",
  "name",
  "description",
  "status",
  "created_at",
  "updated_at",
  "archived_at",
  "deleted_at"
)
SELECT
  "id",
  "id",
  'Без проекта',
  'Служебный проект для задач без выбранного проекта.',
  'ACTIVE',
  NOW(),
  NOW(),
  NULL,
  NULL
FROM "users"
ON CONFLICT ("owner_id", "name") DO UPDATE
SET
  "status" = 'ACTIVE',
  "archived_at" = NULL,
  "deleted_at" = NULL,
  "updated_at" = NOW();

UPDATE "tasks" t
SET
  "project_id" = p."id",
  "updated_at" = NOW()
FROM "projects" p
WHERE
  t."owner_id" = p."owner_id"
  AND p."name" = 'Без проекта'
  AND t."project_id" IS NULL;

UPDATE "delegated_tasks" dt
SET
  "project_id" = p."id",
  "updated_at" = NOW()
FROM "projects" p
WHERE
  dt."owner_id" = p."owner_id"
  AND p."name" = 'Без проекта'
  AND dt."project_id" IS NULL;
