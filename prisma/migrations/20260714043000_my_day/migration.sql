CREATE TYPE "DailyPlanScheduleType" AS ENUM ('FLEXIBLE', 'FIXED');

ALTER TABLE "tasks"
ADD COLUMN "estimated_duration_minutes" INTEGER;

CREATE TABLE "daily_plan_items" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "scheduled_start_at" TIMESTAMPTZ(3),
  "scheduled_end_at" TIMESTAMPTZ(3),
  "schedule_type" "DailyPlanScheduleType" NOT NULL DEFAULT 'FLEXIBLE',
  "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removed_at" TIMESTAMPTZ(3),
  "completed_in_plan_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "daily_plan_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "daily_plan_items_user_id_date_removed_at_idx"
ON "daily_plan_items"("user_id", "date", "removed_at");

CREATE INDEX "daily_plan_items_task_id_date_idx"
ON "daily_plan_items"("task_id", "date");

ALTER TABLE "daily_plan_items"
ADD CONSTRAINT "daily_plan_items_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_plan_items"
ADD CONSTRAINT "daily_plan_items_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
