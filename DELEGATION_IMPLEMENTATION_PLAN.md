# Delegation module: implementation plan

## Main product rule

Personal tasks and delegated tasks are separate entities.

- Personal tasks stay in `tasks`.
- Delegated tasks live in `delegated_tasks`.
- Delegated tasks must not appear in My Day, personal calendar, personal dashboards, personal overdue lists, personal summaries or personal workload planning.
- Executors use Telegram only and never receive Supabase Auth or web access.

## Stage 1: audit, database models and migrations

Status: planned as the first implementation slice.

Deliverables:

1. Architecture audit document.
2. Implementation plan document.
3. Prisma enums and models:
   - `Executor`
   - `ExecutorInvite`
   - `DelegatedTask`
   - `DelegatedTaskComment`
   - `DelegatedTaskEvent`
   - optional delivery/reminder support tables where needed.
4. SQL migration for new tables and indexes.
5. No behavior changes to personal task flows.

Validation:

- `npm run typecheck`
- `npm run build`
- Prisma generate/migration SQL sanity check

## Stage 2: executors directory

Backend:

- `ExecutorsModule`
- `ExecutorsService`
- owner-only REST controller:
  - `GET /api/executors`
  - `POST /api/executors`
  - `GET /api/executors/:id`
  - `PATCH /api/executors/:id`
  - `DELETE /api/executors/:id`

Web:

- new navigation item: `Исполнители`
- list page
- create/edit modal
- executor detail page
- connection status:
  - not connected
  - invite created
  - connected
  - inactive

Rules:

- executor is not a `User`;
- executor has no Supabase account;
- soft archive/delete instead of destructive delete where possible.

## Stage 3: Telegram invites and role resolution

Backend:

- invite creation/regeneration/revocation:
  - `POST /api/executors/:id/invite`
  - `POST /api/executors/:id/invite/regenerate`
  - `POST /api/executors/:id/invite/revoke`
- deep link format:
  - `https://t.me/BOT_USERNAME?start=exec_RANDOM_TOKEN`
- store only token hash in `executor_invites`;
- token TTL defaults to 7 days.

Telegram:

- `/start exec_*` bypasses the owner-only block only for invite resolution.
- unknown users without valid invite remain blocked.
- accepted invite stores:
  - `telegramUserId`
  - `telegramUsername`
  - `telegramFirstName`
  - `telegramLastName`
  - `connectedAt`

Security:

- owner role: existing `ALLOWED_TELEGRAM_USER_ID`;
- executor role: lookup by connected `telegramUserId`;
- unknown role: no access.

## Stage 4: delegated task CRUD and sending to Telegram

Backend:

- `DelegatedTasksModule`
- `DelegatedTasksService`
- owner-only REST controller:
  - `GET /api/delegated-tasks`
  - `POST /api/delegated-tasks`
  - `GET /api/delegated-tasks/:id`
  - `PATCH /api/delegated-tasks/:id`
  - `DELETE /api/delegated-tasks/:id`
  - `POST /api/delegated-tasks/:id/send`
  - `POST /api/delegated-tasks/:id/remind`
  - `POST /api/delegated-tasks/:id/cancel`
  - `POST /api/delegated-tasks/:id/reassign`

Web:

- new module `Делегированные`
- delegated task list
- create/edit delegated task modal
- executor filter
- project filter
- status filter
- priority filter
- separate project tab `Делегированные`

Telegram:

- sending a delegated task to a connected executor;
- inline buttons for executor actions.

## Stage 5: executor task lifecycle

Executor Telegram actions:

- accept task;
- start work;
- ask question;
- mark done.

Owner actions:

- review submitted result;
- accept completion;
- return to work with comment;
- cancel;
- manual reminder.

Statuses:

- `DRAFT`
- `SENT`
- `ACCEPTED`
- `IN_PROGRESS`
- `QUESTION`
- `WAITING_REVIEW`
- `RETURNED`
- `COMPLETED`
- `CANCELLED`

Every callback must validate:

1. Telegram user ID.
2. Connected executor identity.
3. The task is assigned to that executor.
4. The status transition is allowed.
5. The task is not deleted.
6. The task is not cancelled unless the callback explicitly supports that state.

## Stage 6: comments, notifications and owner review

Data:

- `delegated_task_comments`
- `delegated_task_events`

Flows:

- executor question -> owner Telegram/web notification;
- owner reply -> executor Telegram notification;
- executor done -> owner review notification;
- owner return -> executor receives comment;
- owner accept -> task reaches final `COMPLETED`.

## Stage 7: digests, deadlines and reminders

Settings/env:

- `EXECUTOR_INVITE_TTL_DAYS=7`
- `DEFAULT_EXECUTOR_TIMEZONE=Europe/Zurich`
- `DEFAULT_EXECUTOR_DIGEST_TIME=08:00`
- `OWNER_DELEGATED_DIGEST_TIME=08:15`
- `DELEGATED_OVERDUE_REMINDER_ENABLED=true`

Automation:

- executor daily digest;
- owner delegated-task digest;
- due reminders;
- overdue reminders;
- manual reminder.

Do not reuse personal `DailySummaryDelivery` or personal `Reminder` without explicit separation.

## Stage 8: files, search, filters and history

Files:

- add delegated task file support;
- executor access only to files attached to assigned delegated tasks;
- owner access through delegated task detail.

Search:

- delegated module search stays separate from personal search, or is displayed in a separate result group.

History:

- show event timeline for delegated task.

## Stage 9: tests and production hardening

Unit tests:

- executor creation;
- invite creation;
- expired invite;
- reused invite;
- Telegram connection;
- role resolution;
- task creation/send;
- status transitions;
- comments;
- reminder/digest logic;
- callback tampering protection.

E2E smoke:

1. Owner creates executor.
2. Owner creates invite.
3. Executor opens Telegram deep link.
4. Executor connects.
5. Owner creates delegated task.
6. Owner sends task.
7. Executor accepts, starts, asks question, completes.
8. Owner returns it.
9. Executor completes again.
10. Owner accepts completion.

## Deployment approach

Use small safe pushes:

1. Database models/migration only.
2. Executors CRUD + UI.
3. Telegram invite connection and role resolution.
4. Delegated task CRUD/send.
5. Lifecycle, comments, reminders and polish.

Each push should pass:

- backend typecheck/build;
- web typecheck/build;
- Prisma generate;
- manual smoke where possible.
