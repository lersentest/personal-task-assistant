-- Harden public delegated-task access and enable owner-scoped RLS policies.
-- Runtime backend access still goes through the server Prisma connection.

CREATE TABLE "task_share_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "delegated_task_id" uuid NOT NULL REFERENCES "delegated_tasks"("id") ON DELETE CASCADE,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "token_hash" varchar(128) NOT NULL UNIQUE,
  "permissions" text[] NOT NULL DEFAULT ARRAY['VIEW', 'COMMENT', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'STATUS_UPDATE']::text[],
  "expires_at" timestamptz(3),
  "revoked_at" timestamptz(3),
  "last_used_at" timestamptz(3),
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now()
);

CREATE INDEX "task_share_links_delegated_task_id_revoked_at_idx" ON "task_share_links"("delegated_task_id", "revoked_at");
CREATE INDEX "task_share_links_owner_id_created_at_idx" ON "task_share_links"("owner_id", "created_at");
CREATE INDEX "task_share_links_expires_at_idx" ON "task_share_links"("expires_at");

CREATE TABLE "security_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "task_share_link_id" uuid,
  "delegated_task_id" uuid,
  "event_type" varchar(80) NOT NULL,
  "outcome" varchar(32) NOT NULL,
  "metadata" jsonb,
  "created_at" timestamptz(3) NOT NULL DEFAULT now()
);

CREATE INDEX "security_audit_events_owner_id_created_at_idx" ON "security_audit_events"("owner_id", "created_at");
CREATE INDEX "security_audit_events_task_share_link_id_created_at_idx" ON "security_audit_events"("task_share_link_id", "created_at");
CREATE INDEX "security_audit_events_delegated_task_id_created_at_idx" ON "security_audit_events"("delegated_task_id", "created_at");
CREATE INDEX "security_audit_events_event_type_created_at_idx" ON "security_audit_events"("event_type", "created_at");

DROP INDEX IF EXISTS "delegated_tasks_public_access_token_public_access_revoked_at_idx";
DROP INDEX IF EXISTS "delegated_tasks_public_access_token_key";
ALTER TABLE "delegated_tasks"
  DROP COLUMN IF EXISTS "public_access_token",
  DROP COLUMN IF EXISTS "public_access_revoked_at";

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'projects',
    'executors',
    'executor_invites',
    'delegated_tasks',
    'delegated_task_comments',
    'delegated_task_events',
    'delegated_task_reminders',
    'task_share_links',
    'tasks',
    'task_checklist_items',
    'daily_plan_items',
    'tags',
    'task_tags',
    'reminders',
    'daily_summary_deliveries',
    'activity_events',
    'attachments',
    'ai_analytics_conversations',
    'ai_analytics_messages',
    'security_audit_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "users_owner_select" ON "users";
DROP POLICY IF EXISTS "users_owner_update" ON "users";
CREATE POLICY "users_owner_select" ON "users"
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());
CREATE POLICY "users_owner_update" ON "users"
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "projects_owner_all" ON "projects";
CREATE POLICY "projects_owner_all" ON "projects"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id() AND created_by_id = public.current_app_user_id());

DROP POLICY IF EXISTS "executors_owner_all" ON "executors";
CREATE POLICY "executors_owner_all" ON "executors"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "executor_invites_owner_select" ON "executor_invites";
CREATE POLICY "executor_invites_owner_select" ON "executor_invites"
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.executors e
    WHERE e.id = executor_invites.executor_id
      AND e.owner_id = public.current_app_user_id()
  ));

DROP POLICY IF EXISTS "delegated_tasks_owner_all" ON "delegated_tasks";
CREATE POLICY "delegated_tasks_owner_all" ON "delegated_tasks"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "delegated_task_comments_owner_all" ON "delegated_task_comments";
CREATE POLICY "delegated_task_comments_owner_all" ON "delegated_task_comments"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "delegated_task_events_owner_select" ON "delegated_task_events";
CREATE POLICY "delegated_task_events_owner_select" ON "delegated_task_events"
  FOR SELECT TO authenticated
  USING (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "delegated_task_reminders_owner_all" ON "delegated_task_reminders";
CREATE POLICY "delegated_task_reminders_owner_all" ON "delegated_task_reminders"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delegated_tasks dt
    WHERE dt.id = delegated_task_reminders.task_id
      AND dt.owner_id = public.current_app_user_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.delegated_tasks dt
    WHERE dt.id = delegated_task_reminders.task_id
      AND dt.owner_id = public.current_app_user_id()
  ));

DROP POLICY IF EXISTS "task_share_links_owner_all" ON "task_share_links";
CREATE POLICY "task_share_links_owner_all" ON "task_share_links"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id() AND created_by_id = public.current_app_user_id());

DROP POLICY IF EXISTS "tasks_owner_all" ON "tasks";
CREATE POLICY "tasks_owner_all" ON "tasks"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (
    owner_id = public.current_app_user_id()
    AND created_by_id = public.current_app_user_id()
    AND assignee_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS "task_checklist_items_owner_all" ON "task_checklist_items";
CREATE POLICY "task_checklist_items_owner_all" ON "task_checklist_items"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_checklist_items.task_id
      AND t.owner_id = public.current_app_user_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_checklist_items.task_id
      AND t.owner_id = public.current_app_user_id()
  ));

DROP POLICY IF EXISTS "daily_plan_items_owner_all" ON "daily_plan_items";
CREATE POLICY "daily_plan_items_owner_all" ON "daily_plan_items"
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "tags_owner_all" ON "tags";
CREATE POLICY "tags_owner_all" ON "tags"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "task_tags_owner_all" ON "task_tags";
CREATE POLICY "task_tags_owner_all" ON "task_tags"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_tags.task_id
      AND t.owner_id = public.current_app_user_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_tags.task_id
      AND t.owner_id = public.current_app_user_id()
  ));

DROP POLICY IF EXISTS "reminders_owner_all" ON "reminders";
CREATE POLICY "reminders_owner_all" ON "reminders"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = reminders.task_id
      AND t.owner_id = public.current_app_user_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = reminders.task_id
      AND t.owner_id = public.current_app_user_id()
  ));

DROP POLICY IF EXISTS "daily_summary_deliveries_owner_select" ON "daily_summary_deliveries";
CREATE POLICY "daily_summary_deliveries_owner_select" ON "daily_summary_deliveries"
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "activity_events_owner_select" ON "activity_events";
CREATE POLICY "activity_events_owner_select" ON "activity_events"
  FOR SELECT TO authenticated
  USING (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "attachments_owner_all" ON "attachments";
CREATE POLICY "attachments_owner_all" ON "attachments"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id() AND uploaded_by_id = public.current_app_user_id());

DROP POLICY IF EXISTS "ai_analytics_conversations_owner_all" ON "ai_analytics_conversations";
CREATE POLICY "ai_analytics_conversations_owner_all" ON "ai_analytics_conversations"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "ai_analytics_messages_owner_all" ON "ai_analytics_messages";
CREATE POLICY "ai_analytics_messages_owner_all" ON "ai_analytics_messages"
  FOR ALL TO authenticated
  USING (owner_id = public.current_app_user_id())
  WITH CHECK (owner_id = public.current_app_user_id());

DROP POLICY IF EXISTS "security_audit_events_owner_select" ON "security_audit_events";
CREATE POLICY "security_audit_events_owner_select" ON "security_audit_events"
  FOR SELECT TO authenticated
  USING (owner_id = public.current_app_user_id());
