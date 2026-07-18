export const ANALYTICS_ALLOWED_VIEWS = [
  'tasks',
  'projects',
  'delegated_tasks',
  'executors',
  'daily_plan_items',
  'attachments',
  'task_activity',
  'delegated_task_events',
  'reminders',
  'tags',
  'task_tags',
  'task_checklist_items',
] as const;

export type AnalyticsAllowedView = (typeof ANALYTICS_ALLOWED_VIEWS)[number];

export const analyticsSchemaPrompt = `
Доступны только read-only представления в schema ai_analytics. Всегда обращайся к ним с полным именем, например ai_analytics.tasks.

ai_analytics.tasks:
- личные задачи владельца;
- поля: task_id, title, description, status, status_label, priority, priority_label, task_type, task_type_label, project_id, project_name, created_at, updated_at, due_at, remind_at, completed_at, cancelled_at, deleted_at, estimated_minutes, due_date_type, planning_mode, is_completed, is_deleted, is_overdue, days_open, cycle_time_minutes, scheduled_date, scheduled_start_at, scheduled_end_at, files_count, checklist_total, checklist_completed, tags.

ai_analytics.projects:
- проекты владельца;
- поля: project_id, project_name, description, status, status_label, created_at, updated_at, archived_at, deleted_at, personal_tasks_total, personal_tasks_completed, personal_tasks_overdue, delegated_tasks_total, delegated_tasks_completed, delegated_tasks_overdue, last_activity_at.

ai_analytics.delegated_tasks:
- делегированные задачи владельца;
- поля: delegated_task_id, title, description, result_text, status, status_label, priority, project_id, project_name, executor_id, executor_name, executor_company, executor_role, created_at, updated_at, sent_at, accepted_at, started_at, submitted_at, returned_at, completed_at, cancelled_at, due_at, deleted_at, is_completed, is_deleted, is_overdue, days_open, cycle_time_minutes, comments_count, files_count, returns_count, questions_count, last_activity_at.

ai_analytics.executors:
- исполнители владельца;
- поля: executor_id, executor_name, executor_company, executor_role, email, phone, telegram_username, language, timezone, connection_status, is_active, connected_at, created_at, updated_at, archived_at, deleted_at.

ai_analytics.daily_plan_items:
- план дня и временная шкала;
- поля: daily_plan_item_id, task_id, task_title, project_name, plan_date, order, scheduled_start_at, scheduled_end_at, schedule_type, added_at, removed_at, completed_in_plan_at, estimated_minutes, task_status, task_priority.

ai_analytics.attachments:
- метаданные файлов без бинарного содержимого;
- поля: attachment_id, file_name, mime_type, size_bytes, task_id, task_title, project_id, project_name, delegated_task_id, delegated_task_title, created_at, deleted_at.

ai_analytics.task_activity:
- события личных задач, проектов и файлов;
- поля: activity_id, event_type, title, task_id, task_title, project_id, project_name, file_id, created_at.

ai_analytics.delegated_task_events:
- события делегированных задач;
- поля: event_id, delegated_task_id, delegated_task_title, executor_id, executor_name, event_type, title, created_at.

ai_analytics.reminders:
- напоминания по личным задачам;
- поля: reminder_id, task_id, task_title, remind_at, reminder_type, status, sent_at, created_at.

ai_analytics.tags / ai_analytics.task_tags / ai_analytics.task_checklist_items:
- теги задач и пункты чек-листов.

Важная семантика:
- overdue/просрочено = есть due_at, задача не завершена/не отменена и due_at < now().
- estimated_minutes = оценочная длительность, не фактически потраченное время.
- cycle_time_minutes = время от создания до завершения, если завершено.
- deleted_at не null означает soft delete.
- Для фактического потраченного времени сейчас нет надёжного отдельного поля; честно называй расчёты оценочными.
`.trim();
