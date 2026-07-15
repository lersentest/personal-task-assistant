# Delegation module: current architecture audit

## Scope

This document records the current state of Personal Task Assistant before adding the delegation module. The key product rule for the new module is: personal tasks and delegated tasks are different entities and must not be mixed in shared task lists, calendars, daily plans, summaries or workload calculations.

## Backend

The backend is a NestJS application with Prisma and PostgreSQL/Supabase.

Main modules already present:

- `UsersModule`: creates and looks up the single owner user from Telegram profile data and links Supabase Auth users to that owner.
- `TasksModule`: personal task CRUD, filtering, calendar data, soft delete, restore, completion, tags and summary counts.
- `ProjectsModule`: owner projects and project status/soft delete.
- `TagsModule`: owner tags for personal tasks.
- `RemindersModule`: personal task reminders, snooze and overdue reminder scheduling.
- `AutomationModule`: scheduled personal reminders and daily Telegram summary for the owner.
- `TelegramModule`: grammY long-polling bot, owner access guard, text/voice commands, callbacks and confirmation drafts.
- `ApiModule`: authenticated REST API used by the Next.js web app.
- `AttachmentsModule`: stores uploaded files in the database as bytes and links them to personal tasks or projects.
- `MyDayModule`: daily plan and time planning for personal tasks.

## Current data model

Core Prisma models:

- `User`
- `Project`
- `Task`
- `DailyPlanItem`
- `Tag`
- `TaskTag`
- `Reminder`
- `DailySummaryDelivery`
- `ActivityEvent`
- `Attachment`

Important current detail: `Task` already has `assigneeId`, but API-created and Telegram-created tasks set `ownerId`, `createdById` and `assigneeId` to the same owner user. Under the delegation specification this field must not be repurposed for executors. Delegated work needs a separate `delegated_tasks` table.

Current enums:

- `ProjectStatus`: `ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`
- `TaskStatus`: `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `TaskPriority`: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- `DueDateType`: `ON_DATE`, `BEFORE_DATE`, `EXACT_TIME`
- `TaskSourceType`: `TEXT`, `VOICE`, `FORWARDED_MESSAGE`
- `TaskKind`: `TASK`, `CALL`, `MEETING`, `IDEA`, `NOTE`
- `ActivityEventType`: personal task/project/file events
- `ReminderType` / `ReminderStatus`
- `DailyPlanScheduleType`

## Telegram access today

Telegram access is currently restricted by `TelegramAccessService`.

- It reads `ALLOWED_TELEGRAM_USER_ID`.
- Every bot update passes through `bot.use(this.access.createMiddleware())`.
- If `ctx.from.id` does not match the configured owner Telegram ID, the bot replies that access is restricted and stops processing.

This is safe for a single-owner personal bot, but it blocks the future executor flow. The new access layer must distinguish:

1. Owner access: full existing bot capabilities, still guarded by `ALLOWED_TELEGRAM_USER_ID`.
2. Executor access: limited access only after a valid invite is accepted and only to delegated tasks assigned to that executor.
3. Unknown Telegram users: no access except the invite acceptance flow started through a valid `exec_*` deep link token.

## Web authorization today

The web app uses Supabase Auth. Backend requests are protected by `SupabaseAuthGuard`.

- The guard verifies a Supabase JWT.
- It links the authenticated Supabase user to the owner Telegram user using `ALLOWED_TELEGRAM_USER_ID`.
- Only the owner gets web access.

This matches the delegation requirement: executors must not receive Supabase Auth accounts or web-interface access.

## API today

Current REST API is owner-only through `SupabaseAuthGuard`.

Existing route groups:

- `/api/me`
- `/api/dashboard`
- `/api/calendar`
- `/api/search`
- `/api/tasks`
- `/api/projects`
- `/api/tags`
- `/api/attachments`
- `/api/my-day`
- `/api/voice`

All current task routes operate on personal `tasks`. Delegated tasks need separate routes, e.g. `/api/executors` and `/api/delegated-tasks`.

## Personal reminders and summaries today

`AutomationService` runs every minute for:

- due personal reminders;
- owner daily personal summary at 07:00 local time.

`RemindersService` stores reminders in the existing `reminders` table linked to personal `Task`.

Delegated reminders should not reuse personal `Reminder` rows because delegated tasks have different recipients, lifecycle and completion rules. The delegation module should introduce its own reminder/digest logic and, if needed, a separate table for delegated reminder deliveries.

## Attachments today

`Attachment` can link to a personal task or a project. Files are stored in DB bytes with a 10 MB limit.

Delegated tasks need explicit attachment support later. The clean extension is to add nullable `delegatedTaskId` to attachments or create a delegated-specific attachment relation. Access checks must ensure executors only receive files attached to their assigned delegated tasks.

## Activity today

`ActivityEvent` stores owner activity for personal tasks, projects and files.

Delegated tasks need a separate event/history model or an extended activity model. A separate `delegated_task_events` table is safer because the lifecycle and actors differ from personal tasks.

## UI today

There are two interface modes:

- Classic UI
- Focus UI

Current pages show only personal data:

- dashboard/overview
- my day
- today
- calendar
- tasks
- projects
- project detail
- files
- search
- trash
- settings/profile

Delegated data must not appear in `My day`, personal task lists, personal calendar, personal overdue lists, personal summary cards or personal workload calculations. It needs its own navigation section and pages.

## Existing services that can be reused

Safe to reuse:

- `PrismaService`
- `ProjectsService.getOwned()` for validating owner/project access
- Supabase owner guard for web owner actions
- Telegram bot instance/token and grammY primitives
- Scheduler infrastructure from `@nestjs/schedule`
- Date/time utilities based on Luxon
- Existing web API client pattern
- Existing Focus UI shell/navigation patterns
- Existing attachment storage approach, after adding delegated-task access checks

Should not be reused directly as delegated data:

- `TasksService` personal task queries and summaries
- `MyDayService`
- personal `Reminder` records
- personal `DailySummaryDelivery`
- personal task callbacks without a role check

## Key risks

1. Accidentally mixing delegated tasks into personal task lists or daily planning.
2. Weak Telegram callback validation allowing an executor to act on another executor's task.
3. Storing raw invite tokens in the database.
4. Breaking existing owner Telegram flows when the access middleware is expanded.
5. Reusing personal reminder logic and sending executor reminders to the owner or vice versa.
6. Adding web access for executors by mistake.
7. Creating migrations that break existing Supabase data.

## Stage 1 conclusion

The current architecture is suitable for adding delegation if the new module is introduced as an isolated bounded context:

- new Prisma models;
- new NestJS services/controllers;
- explicit Telegram role resolution;
- separate UI pages;
- no changes to the semantics of existing personal `tasks`.
