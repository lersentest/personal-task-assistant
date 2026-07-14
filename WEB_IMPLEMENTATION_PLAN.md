# Web Implementation Plan

## Principles

- Keep the Telegram bot working.
- Use the existing NestJS backend as the only business-logic layer.
- Keep PostgreSQL/Supabase as the only database.
- Do not let the frontend write directly to Supabase tables.
- Store secrets only in environment variables.
- Use Supabase Auth for web login.
- Build the frontend in Russian with a structure that can later support more languages.

## Stage 1: Backend HTTP API and Auth

1. Convert `src/main.ts` from application-context bootstrap to HTTP bootstrap.
2. Keep Telegram bot and scheduled jobs as existing Nest providers.
3. Add CORS allowlist configuration:
   - local frontend
   - Vercel production URL
   - future custom domain
4. Add environment variables:
   - `PORT`
   - `FRONTEND_ORIGINS`
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET`
   - optional `SUPABASE_ANON_KEY`
5. Add migration for `users.auth_user_id`.
6. Add `AuthModule`:
   - parse `Authorization: Bearer <token>`
   - verify Supabase JWT
   - find or link the internal owner user
7. Add REST controllers:
   - dashboard
   - tasks
   - projects
   - tags
   - calendar
   - search
8. Add DTO validation with `zod`.
9. Add API tests for protected endpoints.

## Stage 2: Web App Shell

1. Add `web/` as a Next.js App Router project.
2. Use:
   - TypeScript
   - Tailwind CSS
   - shadcn-style local UI primitives
   - TanStack Query
   - React Hook Form
   - Zod
   - Lucide Icons
3. Add Supabase client auth:
   - email/password login
   - logout
   - password recovery screen
   - session persistence
   - protected routes
4. Add layout:
   - desktop sidebar
   - mobile bottom navigation
   - global create button
   - theme toggle
5. Add Russian labels and central dictionary file.

## Stage 3: Dashboard and Tasks

1. Dashboard:
   - greeting
   - today/overdue/upcoming/urgent stats
   - today tasks
   - overdue tasks
   - upcoming tasks
   - active projects
   - quick task creation
2. Tasks list:
   - list view
   - table view
   - filters in URL
   - search
   - sorting controls
3. Task details:
   - title
   - project
   - status
   - priority
   - description
   - due date/time
   - reminder
   - tags
   - timestamps
4. Create/edit task:
   - modal or side panel
   - shared form
   - Zod validation
   - optimistic updates
5. Quick actions:
   - complete
   - restore
   - move to trash
   - priority/status change

## Stage 4: Projects

1. Projects list with cards.
2. Project create/edit form.
3. Project detail page:
   - overview
   - active tasks
   - overdue tasks
   - completed tasks
   - files placeholder
   - history placeholder
4. Unassigned tasks page.

## Stage 5: Calendar

1. Add FullCalendar React using community plugins.
2. Show tasks with due dates.
3. Add month/week/day/list views.
4. Color tasks by status, priority, and overdue state.
5. Add date click task creation.
6. Add drag-and-drop rescheduling with rollback on error.

## Stage 6: Search, Files, Trash

1. Global search command.
2. Trash page for deleted tasks and archived/deleted projects.
3. File support after safe metadata is added:
   - Supabase Storage upload/download
   - image preview
   - PDF opening
   - project/task linking
   - soft delete

## Stage 7: Mobile, Theme, PWA

1. Validate responsive layouts:
   - 1920x1080
   - 1440x900
   - 1366x768
   - iPad
   - Android
   - iPhone
2. Add dark/light/system theme.
3. Add PWA manifest and icons.
4. Do not add offline sync or push notifications yet.

## Stage 8: Tests and Deployment

1. Backend:
   - unit tests
   - API auth tests
   - protected endpoint tests
2. Frontend:
   - component/form tests where practical
   - production build
3. GitHub:
   - initialize repository
   - commit without secrets
   - push to GitHub
4. Vercel:
   - import GitHub repository
   - configure env vars
   - deploy frontend
5. Railway:
   - deploy backend changes
   - set CORS frontend origin
6. Final documentation:
   - setup
   - local run
   - production deploy
   - environment variables

