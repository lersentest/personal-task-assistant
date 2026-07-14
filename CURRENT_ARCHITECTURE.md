# Current Architecture

## Summary

Personal Task Assistant is currently a NestJS backend that runs as a Telegram bot plus scheduled automation worker. It uses Prisma with PostgreSQL/Supabase as the single source of truth. There is no HTTP REST API and no web frontend yet.

## Runtime

- Entry point: `src/main.ts`
- Current startup mode: `NestFactory.createApplicationContext(AppModule)`
- Telegram bot starts from `TelegramService.onApplicationBootstrap()`
- Reminder and daily summary jobs run through `@nestjs/schedule`
- Deployment target: Railway
- Database: PostgreSQL/Supabase via Prisma

Because the app is started as an application context, it does not currently listen for HTTP requests. To support the web app, the backend must be switched to a normal Nest HTTP application while keeping the same providers, bot startup, and scheduled jobs.

## Existing Modules

- `TelegramModule`: Telegram command handlers, menus, callback actions, voice input flow, and confirmation workflow.
- `UsersModule`: Telegram user provisioning and lookup.
- `TasksModule`: core task creation, listing, updates, soft delete, restore, tags, reminders, and summary counts.
- `ProjectsModule`: project creation, listing, lookup, and status updates.
- `TagsModule`: tag lookup/listing.
- `RemindersModule`: pending reminder lookup, snooze, cancellation, and overdue scheduling.
- `AutomationModule`: Telegram reminder delivery and daily summary delivery.
- `AiModule`: natural language parsing and voice transcription.
- `DatabaseModule`: Prisma service.

## Existing Data Model

The Prisma schema already contains the core web entities:

- `User`
- `Project`
- `Task`
- `Tag`
- `TaskTag`
- `Reminder`
- `DailySummaryDelivery`

Existing enums:

- `ProjectStatus`: `ACTIVE`, `ON_HOLD`, `COMPLETED`, `ARCHIVED`
- `TaskStatus`: `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `TaskPriority`: `LOW`, `NORMAL`, `HIGH`, `URGENT`
- `DueDateType`: `ON_DATE`, `BEFORE_DATE`, `EXACT_TIME`
- `TaskSourceType`: `TEXT`, `VOICE`, `FORWARDED_MESSAGE`
- `ReminderType`: `CUSTOM`, `DAY_BEFORE`, `DUE_DATE`, `OVERDUE`, `SNOOZE`
- `ReminderStatus`: `PENDING`, `SENT`, `CANCELLED`

## Reusable Components

The web app can reuse these services without duplicating business logic:

- `TasksService.create()`
- `TasksService.update()`
- `TasksService.list()`
- `TasksService.getOwned()`
- `TasksService.softDelete()`
- `TasksService.restore()`
- `TasksService.summary()`
- `ProjectsService.create()`
- `ProjectsService.update()`
- `ProjectsService.list()`
- `ProjectsService.getOwned()`
- `TagsService.list()`
- `RemindersService.cancelPending()`
- `RemindersService.snooze()`
- `UsersService`

Telegram-specific parsing and confirmation logic should remain in Telegram handlers. The REST API should call the shared services directly with explicit DTOs.

## Missing Backend Pieces

- HTTP bootstrap with CORS.
- REST controllers.
- Request DTO validation.
- Supabase Auth access-token verification.
- `User.authUserId` mapping between Supabase Auth users and internal users.
- Dashboard endpoint.
- Calendar endpoint.
- Search endpoint.
- File metadata/storage module.
- API-safe error responses.
- Production CORS allowlist.

## Required API Surface

Initial web API:

- `GET /api/me`
- `GET /api/dashboard`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/:id/restore`
- `DELETE /api/tasks/:id`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/calendar`
- `GET /api/search`
- `GET /api/tags`

File endpoints should be added after storage metadata is introduced safely:

- `GET /api/files`
- `POST /api/files`
- `DELETE /api/files/:id`

## Database Changes Needed

Minimal required migration:

- Add nullable unique `auth_user_id` to `users`.

Future file support migration:

- Add file metadata table with owner, project/task links, storage bucket/path, file name, mime type, size, timestamps, and `deleted_at`.

No separate database or parallel data model is needed.

## Main Risks

- Breaking Telegram bot startup when switching from application context to HTTP app.
- Incorrect Supabase JWT verification.
- CORS accidentally too permissive in production.
- Creating a web-only data path that bypasses existing services.
- Adding file deletion before safe soft-delete/restore behavior exists.
- Deploying frontend before backend has a stable public API URL.

