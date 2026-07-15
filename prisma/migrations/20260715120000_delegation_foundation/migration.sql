-- CreateEnum
CREATE TYPE "ExecutorLanguage" AS ENUM ('RU', 'UK', 'EN', 'DE');

-- CreateEnum
CREATE TYPE "ExecutorConnectionStatus" AS ENUM ('NOT_CONNECTED', 'INVITE_CREATED', 'CONNECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DelegatedTaskStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'IN_PROGRESS', 'QUESTION', 'WAITING_REVIEW', 'RETURNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DelegatedTaskCommentAuthor" AS ENUM ('OWNER', 'EXECUTOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DelegatedTaskEventType" AS ENUM ('CREATED', 'UPDATED', 'SENT', 'ACCEPTED', 'STARTED', 'QUESTION_ASKED', 'OWNER_REPLIED', 'SUBMITTED', 'ACCEPTED_BY_OWNER', 'RETURNED', 'CANCELLED', 'REMINDED', 'REASSIGNED', 'FILE_ADDED');

-- CreateEnum
CREATE TYPE "DelegatedReminderType" AS ENUM ('MANUAL', 'DAY_BEFORE', 'DUE_DATE', 'OVERDUE', 'DIGEST');

-- CreateTable
CREATE TABLE "executors" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255),
    "role" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(64),
    "telegram_user_id" BIGINT,
    "telegram_username" VARCHAR(255),
    "telegram_first_name" VARCHAR(255),
    "telegram_last_name" VARCHAR(255),
    "language" "ExecutorLanguage" NOT NULL DEFAULT 'RU',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Zurich',
    "daily_digest_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_digest_time" VARCHAR(5) NOT NULL DEFAULT '08:00',
    "connection_status" "ExecutorConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "connected_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "executors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executor_invites" (
    "id" UUID NOT NULL,
    "executor_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executor_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegated_tasks" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "executor_id" UUID NOT NULL,
    "project_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "result_text" TEXT,
    "status" "DelegatedTaskStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "due_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "returned_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "last_reminder_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "delegated_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegated_task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "executor_id" UUID,
    "author" "DelegatedTaskCommentAuthor" NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "delegated_task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegated_task_events" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "executor_id" UUID,
    "type" "DelegatedTaskEventType" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegated_task_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegated_task_reminders" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "remind_at" TIMESTAMPTZ(3) NOT NULL,
    "type" "DelegatedReminderType" NOT NULL DEFAULT 'MANUAL',
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegated_task_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "executors_owner_id_telegram_user_id_key" ON "executors"("owner_id", "telegram_user_id");

-- CreateIndex
CREATE INDEX "executors_owner_id_deleted_at_idx" ON "executors"("owner_id", "deleted_at");

-- CreateIndex
CREATE INDEX "executors_owner_id_connection_status_is_active_idx" ON "executors"("owner_id", "connection_status", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "executor_invites_token_hash_key" ON "executor_invites"("token_hash");

-- CreateIndex
CREATE INDEX "executor_invites_executor_id_created_at_idx" ON "executor_invites"("executor_id", "created_at");

-- CreateIndex
CREATE INDEX "executor_invites_expires_at_idx" ON "executor_invites"("expires_at");

-- CreateIndex
CREATE INDEX "delegated_tasks_owner_id_status_deleted_at_idx" ON "delegated_tasks"("owner_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "delegated_tasks_owner_id_due_at_idx" ON "delegated_tasks"("owner_id", "due_at");

-- CreateIndex
CREATE INDEX "delegated_tasks_executor_id_status_deleted_at_idx" ON "delegated_tasks"("executor_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "delegated_tasks_project_id_status_deleted_at_idx" ON "delegated_tasks"("project_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "delegated_task_comments_task_id_created_at_idx" ON "delegated_task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "delegated_task_comments_owner_id_created_at_idx" ON "delegated_task_comments"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "delegated_task_events_owner_id_created_at_idx" ON "delegated_task_events"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "delegated_task_events_task_id_created_at_idx" ON "delegated_task_events"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "delegated_task_reminders_status_remind_at_idx" ON "delegated_task_reminders"("status", "remind_at");

-- CreateIndex
CREATE INDEX "delegated_task_reminders_task_id_status_idx" ON "delegated_task_reminders"("task_id", "status");

-- AddForeignKey
ALTER TABLE "executors" ADD CONSTRAINT "executors_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executor_invites" ADD CONSTRAINT "executor_invites_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "executors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_tasks" ADD CONSTRAINT "delegated_tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_tasks" ADD CONSTRAINT "delegated_tasks_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_tasks" ADD CONSTRAINT "delegated_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_task_comments" ADD CONSTRAINT "delegated_task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "delegated_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_task_comments" ADD CONSTRAINT "delegated_task_comments_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "executors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_task_events" ADD CONSTRAINT "delegated_task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "delegated_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_task_events" ADD CONSTRAINT "delegated_task_events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_task_events" ADD CONSTRAINT "delegated_task_events_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "executors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegated_task_reminders" ADD CONSTRAINT "delegated_task_reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "delegated_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
