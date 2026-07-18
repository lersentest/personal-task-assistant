-- AI analytics chat history
CREATE TYPE "AiAnalyticsMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "ai_analytics_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL DEFAULT 'AI-чат',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_analytics_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_analytics_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "role" "AiAnalyticsMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "model" VARCHAR(120),
    "artifacts" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analytics_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_analytics_conversations_owner_id_archived_at_updated_at_idx"
  ON "ai_analytics_conversations"("owner_id", "archived_at", "updated_at");

CREATE INDEX "ai_analytics_messages_conversation_id_created_at_idx"
  ON "ai_analytics_messages"("conversation_id", "created_at");

CREATE INDEX "ai_analytics_messages_owner_id_created_at_idx"
  ON "ai_analytics_messages"("owner_id", "created_at");

ALTER TABLE "ai_analytics_conversations"
  ADD CONSTRAINT "ai_analytics_conversations_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_analytics_messages"
  ADD CONSTRAINT "ai_analytics_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_analytics_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_analytics_messages"
  ADD CONSTRAINT "ai_analytics_messages_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Read-only semantic schema for AI analytics.
-- Every view is scoped by SET LOCAL app.current_user_id inside the backend SQL executor.
CREATE SCHEMA IF NOT EXISTS "ai_analytics";

CREATE OR REPLACE VIEW "ai_analytics"."tasks" AS
SELECT
  t.id AS task_id,
  t.title,
  t.description,
  t.status::text AS status,
  CASE t.status
    WHEN 'NEW' THEN 'Новая'
    WHEN 'IN_PROGRESS' THEN 'В работе'
    WHEN 'COMPLETED' THEN 'Завершена'
    WHEN 'CANCELLED' THEN 'Отменена'
  END AS status_label,
  t.priority::text AS priority,
  CASE t.priority
    WHEN 'LOW' THEN 'Низкий'
    WHEN 'NORMAL' THEN 'Обычный'
    WHEN 'HIGH' THEN 'Высокий'
    WHEN 'URGENT' THEN 'Срочный'
  END AS priority_label,
  t.kind::text AS task_type,
  CASE t.kind
    WHEN 'TASK' THEN 'Задача'
    WHEN 'CALL' THEN 'Звонок'
    WHEN 'MEETING' THEN 'Встреча'
    WHEN 'IDEA' THEN 'Идея'
    WHEN 'NOTE' THEN 'Заметка'
  END AS task_type_label,
  p.id AS project_id,
  p.name AS project_name,
  t.created_at,
  t.updated_at,
  t.due_at,
  t.remind_at,
  t.completed_at,
  t.cancelled_at,
  t.deleted_at,
  t.estimated_duration_minutes AS estimated_minutes,
  t.due_date_type::text AS due_date_type,
  CASE
    WHEN t.due_date_type = 'EXACT_TIME' THEN 'Точное время'
    WHEN t.due_date_type = 'BEFORE_DATE' THEN 'До срока'
    WHEN t.due_date_type = 'ON_DATE' THEN 'В день'
    ELSE 'Без срока'
  END AS planning_mode,
  t.status = 'COMPLETED' AS is_completed,
  t.deleted_at IS NOT NULL AS is_deleted,
  t.due_at IS NOT NULL
    AND t.status NOT IN ('COMPLETED', 'CANCELLED')
    AND t.deleted_at IS NULL
    AND t.due_at < now() AS is_overdue,
  EXTRACT(day FROM (COALESCE(t.completed_at, t.cancelled_at, now()) - t.created_at))::int AS days_open,
  CASE
    WHEN t.completed_at IS NOT NULL THEN EXTRACT(epoch FROM (t.completed_at - t.created_at)) / 60
    ELSE NULL
  END AS cycle_time_minutes,
  dpi.scheduled_date,
  dpi.scheduled_start_at,
  dpi.scheduled_end_at,
  COALESCE(files.files_count, 0) AS files_count,
  COALESCE(checklist.total, 0) AS checklist_total,
  COALESCE(checklist.completed, 0) AS checklist_completed,
  COALESCE(tags.tags, ARRAY[]::text[]) AS tags
FROM "tasks" t
LEFT JOIN "projects" p ON p.id = t.project_id
LEFT JOIN LATERAL (
  SELECT
    min(date)::date AS scheduled_date,
    min(scheduled_start_at) AS scheduled_start_at,
    max(scheduled_end_at) AS scheduled_end_at
  FROM "daily_plan_items"
  WHERE task_id = t.id AND removed_at IS NULL
) dpi ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS files_count
  FROM "attachments"
  WHERE task_id = t.id AND deleted_at IS NULL
) files ON true
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE is_completed)::int AS completed
  FROM "task_checklist_items"
  WHERE task_id = t.id AND deleted_at IS NULL
) checklist ON true
LEFT JOIN LATERAL (
  SELECT array_agg(tag.name ORDER BY tag.name) AS tags
  FROM "task_tags" task_tag
  JOIN "tags" tag ON tag.id = task_tag.tag_id
  WHERE task_tag.task_id = t.id
) tags ON true
WHERE t.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."projects" AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.description,
  p.status::text AS status,
  CASE p.status
    WHEN 'ACTIVE' THEN 'Активный'
    WHEN 'ON_HOLD' THEN 'На паузе'
    WHEN 'COMPLETED' THEN 'Завершён'
    WHEN 'ARCHIVED' THEN 'Архив'
  END AS status_label,
  p.created_at,
  p.updated_at,
  p.archived_at,
  p.deleted_at,
  COALESCE(task_stats.personal_tasks_total, 0) AS personal_tasks_total,
  COALESCE(task_stats.personal_tasks_completed, 0) AS personal_tasks_completed,
  COALESCE(task_stats.personal_tasks_overdue, 0) AS personal_tasks_overdue,
  COALESCE(delegated_stats.delegated_tasks_total, 0) AS delegated_tasks_total,
  COALESCE(delegated_stats.delegated_tasks_completed, 0) AS delegated_tasks_completed,
  COALESCE(delegated_stats.delegated_tasks_overdue, 0) AS delegated_tasks_overdue,
  GREATEST(
    p.updated_at,
    COALESCE(task_stats.last_task_activity_at, p.updated_at),
    COALESCE(delegated_stats.last_delegated_activity_at, p.updated_at)
  ) AS last_activity_at
FROM "projects" p
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS personal_tasks_total,
    count(*) FILTER (WHERE status = 'COMPLETED')::int AS personal_tasks_completed,
    count(*) FILTER (
      WHERE due_at IS NOT NULL
        AND status NOT IN ('COMPLETED', 'CANCELLED')
        AND due_at < now()
    )::int AS personal_tasks_overdue,
    max(updated_at) AS last_task_activity_at
  FROM "tasks"
  WHERE project_id = p.id AND owner_id = p.owner_id AND deleted_at IS NULL
) task_stats ON true
LEFT JOIN LATERAL (
  SELECT
    count(*)::int AS delegated_tasks_total,
    count(*) FILTER (WHERE status = 'COMPLETED')::int AS delegated_tasks_completed,
    count(*) FILTER (
      WHERE due_at IS NOT NULL
        AND status NOT IN ('COMPLETED', 'CANCELLED')
        AND due_at < now()
    )::int AS delegated_tasks_overdue,
    max(updated_at) AS last_delegated_activity_at
  FROM "delegated_tasks"
  WHERE project_id = p.id AND owner_id = p.owner_id AND deleted_at IS NULL
) delegated_stats ON true
WHERE p.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."executors" AS
SELECT
  e.id AS executor_id,
  e.full_name AS executor_name,
  e.company AS executor_company,
  e.role AS executor_role,
  e.email,
  e.phone,
  e.telegram_username,
  e.language::text AS language,
  e.timezone,
  e.connection_status::text AS connection_status,
  e.is_active,
  e.connected_at,
  e.created_at,
  e.updated_at,
  e.archived_at,
  e.deleted_at
FROM "executors" e
WHERE e.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."delegated_tasks" AS
SELECT
  dt.id AS delegated_task_id,
  dt.title,
  dt.description,
  dt.result_text,
  dt.status::text AS status,
  CASE dt.status
    WHEN 'DRAFT' THEN 'Черновик'
    WHEN 'SENT' THEN 'Ожидает исполнителя'
    WHEN 'ACCEPTED' THEN 'В работе'
    WHEN 'IN_PROGRESS' THEN 'В работе'
    WHEN 'QUESTION' THEN 'Есть вопрос'
    WHEN 'WAITING_REVIEW' THEN 'На проверке'
    WHEN 'RETURNED' THEN 'В работе'
    WHEN 'COMPLETED' THEN 'Завершена'
    WHEN 'CANCELLED' THEN 'Отменена'
  END AS status_label,
  dt.priority::text AS priority,
  p.id AS project_id,
  p.name AS project_name,
  e.id AS executor_id,
  e.full_name AS executor_name,
  e.company AS executor_company,
  e.role AS executor_role,
  dt.created_at,
  dt.updated_at,
  dt.sent_at,
  dt.accepted_at,
  dt.started_at,
  dt.submitted_at,
  dt.returned_at,
  dt.completed_at,
  dt.cancelled_at,
  dt.due_at,
  dt.deleted_at,
  dt.status = 'COMPLETED' AS is_completed,
  dt.deleted_at IS NOT NULL AS is_deleted,
  dt.due_at IS NOT NULL
    AND dt.status NOT IN ('COMPLETED', 'CANCELLED')
    AND dt.deleted_at IS NULL
    AND dt.due_at < now() AS is_overdue,
  EXTRACT(day FROM (COALESCE(dt.completed_at, dt.cancelled_at, now()) - dt.created_at))::int AS days_open,
  CASE
    WHEN dt.completed_at IS NOT NULL THEN EXTRACT(epoch FROM (dt.completed_at - dt.created_at)) / 60
    ELSE NULL
  END AS cycle_time_minutes,
  COALESCE(comments.comments_count, 0) AS comments_count,
  COALESCE(files.files_count, 0) AS files_count,
  COALESCE(events.returns_count, 0) AS returns_count,
  COALESCE(events.questions_count, 0) AS questions_count,
  COALESCE(events.last_activity_at, dt.updated_at) AS last_activity_at
FROM "delegated_tasks" dt
JOIN "executors" e ON e.id = dt.executor_id
LEFT JOIN "projects" p ON p.id = dt.project_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS comments_count
  FROM "delegated_task_comments"
  WHERE task_id = dt.id AND deleted_at IS NULL
) comments ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS files_count
  FROM "attachments"
  WHERE delegated_task_id = dt.id AND deleted_at IS NULL
) files ON true
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE type = 'RETURNED')::int AS returns_count,
    count(*) FILTER (WHERE type = 'QUESTION_ASKED')::int AS questions_count,
    max(created_at) AS last_activity_at
  FROM "delegated_task_events"
  WHERE task_id = dt.id
) events ON true
WHERE dt.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."daily_plan_items" AS
SELECT
  dpi.id AS daily_plan_item_id,
  dpi.task_id,
  t.title AS task_title,
  p.name AS project_name,
  dpi.date::date AS plan_date,
  dpi."order",
  dpi.scheduled_start_at,
  dpi.scheduled_end_at,
  dpi.schedule_type::text AS schedule_type,
  dpi.added_at,
  dpi.removed_at,
  dpi.completed_in_plan_at,
  t.estimated_duration_minutes AS estimated_minutes,
  t.status::text AS task_status,
  t.priority::text AS task_priority
FROM "daily_plan_items" dpi
JOIN "tasks" t ON t.id = dpi.task_id
LEFT JOIN "projects" p ON p.id = t.project_id
WHERE dpi.user_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."attachments" AS
SELECT
  a.id AS attachment_id,
  a.file_name,
  a.mime_type,
  a.size_bytes,
  a.task_id,
  t.title AS task_title,
  a.project_id,
  p.name AS project_name,
  a.delegated_task_id,
  dt.title AS delegated_task_title,
  a.created_at,
  a.deleted_at
FROM "attachments" a
LEFT JOIN "tasks" t ON t.id = a.task_id
LEFT JOIN "projects" p ON p.id = a.project_id
LEFT JOIN "delegated_tasks" dt ON dt.id = a.delegated_task_id
WHERE a.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."task_activity" AS
SELECT
  ae.id AS activity_id,
  ae.type::text AS event_type,
  ae.title,
  ae.task_id,
  t.title AS task_title,
  ae.project_id,
  p.name AS project_name,
  ae.file_id,
  ae.created_at
FROM "activity_events" ae
LEFT JOIN "tasks" t ON t.id = ae.task_id
LEFT JOIN "projects" p ON p.id = ae.project_id
WHERE ae.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."delegated_task_events" AS
SELECT
  e.id AS event_id,
  e.task_id AS delegated_task_id,
  dt.title AS delegated_task_title,
  e.executor_id,
  ex.full_name AS executor_name,
  e.type::text AS event_type,
  e.title,
  e.created_at
FROM "delegated_task_events" e
JOIN "delegated_tasks" dt ON dt.id = e.task_id
LEFT JOIN "executors" ex ON ex.id = e.executor_id
WHERE e.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."reminders" AS
SELECT
  r.id AS reminder_id,
  r.task_id,
  t.title AS task_title,
  r.remind_at,
  r.type::text AS reminder_type,
  r.status::text AS status,
  r.sent_at,
  r.created_at
FROM "reminders" r
JOIN "tasks" t ON t.id = r.task_id
WHERE t.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."tags" AS
SELECT
  tag.id AS tag_id,
  tag.name,
  tag.normalized_name,
  tag.created_at
FROM "tags" tag
WHERE tag.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."task_tags" AS
SELECT
  task_tag.task_id,
  t.title AS task_title,
  task_tag.tag_id,
  tag.name AS tag_name,
  task_tag.assigned_at
FROM "task_tags" task_tag
JOIN "tasks" t ON t.id = task_tag.task_id
JOIN "tags" tag ON tag.id = task_tag.tag_id
WHERE t.owner_id = (current_setting('app.current_user_id', true))::uuid;

CREATE OR REPLACE VIEW "ai_analytics"."task_checklist_items" AS
SELECT
  item.id AS checklist_item_id,
  item.task_id,
  t.title AS task_title,
  item.title,
  item.is_completed,
  item.position,
  item.created_at,
  item.updated_at,
  item.completed_at,
  item.deleted_at
FROM "task_checklist_items" item
JOIN "tasks" t ON t.id = item.task_id
WHERE t.owner_id = (current_setting('app.current_user_id', true))::uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_analytics_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA "ai_analytics" TO ai_analytics_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA "ai_analytics" TO ai_analytics_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA "ai_analytics" GRANT SELECT ON TABLES TO ai_analytics_reader';
  END IF;
END
$$;
