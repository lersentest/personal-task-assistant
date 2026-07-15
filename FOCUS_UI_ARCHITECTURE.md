# Focus UI architecture

## Goal

Focus UI is a second interface mode for the existing Personal Tasks product. It must reuse the same backend, API client, React Query data, validation and business logic as Classic UI.

The rule for this redesign is:

- one database;
- one backend;
- one API layer;
- one business model;
- two presentation modes: Classic and Focus.

## Modes

The product has two independent UI preferences:

```ts
type InterfaceMode = 'classic' | 'focus';
type Appearance = 'light' | 'dark' | 'system';
```

`interfaceMode` controls layout and component language. `appearance` controls light/dark/system colors. These settings are intentionally separate, so all combinations remain possible:

- Classic + Light
- Classic + Dark
- Focus + Light
- Focus + Dark
- Focus + System

Stage 1 stores the preferences in `localStorage` and applies them before hydration to avoid a visible mode flip. Backend profile sync should be added later if the user model gains preference fields.

## Classic protection

Classic UI is the regression baseline and should not be visually changed by Focus work. Focus-specific styling is scoped by:

- `data-ui-mode="focus"` on the document element;
- `--focus-*` design tokens;
- Focus components under `web/components/focus`;
- shared components only when they are genuinely mode-neutral.

Avoid global CSS changes that alter Classic pages. If a style is Focus-only, scope it under `[data-ui-mode="focus"]`.

## Folder direction

Recommended structure:

```txt
web/components/
  classic/        # optional wrappers for preserved Classic screens
  focus/          # Focus shell, cards, topbar, sidebar, calendar wrappers
  shared/         # business-neutral UI and forms reused by both modes
```

Current Stage 1 introduces the Focus foundation without moving every existing component yet. Later stages should migrate page-level UI gradually.

## Reuse map

Reusable without business changes:

- `web/lib/api.ts`
- `web/lib/types.ts`
- Supabase auth integration
- React Query provider
- existing task/project API calls
- voice command button and backend
- existing task/project forms as shared business forms

Needs visual wrappers/refactor:

- `AppShell`
- page headers and content spacing
- task cards
- project cards
- calendar wrappers
- my-day timeline
- settings/profile/files/search/trash/unassigned screens

May need backend/API extension later:

- persistent `interfaceMode` and `appearance` in profile;
- project progress metrics if dashboard data is insufficient;
- server-side calendar filtering/pagination for large task sets.

## Focus shell

Focus shell owns:

- left sidebar grouped by product areas;
- topbar with global search affordance, microphone, create button, profile status;
- main content surface;
- mobile bottom navigation in later responsive work;
- command palette in a later iteration.

Stage 1 shell is intentionally conservative: it frames the existing pages in the Focus layout. Stage 2 and Stage 3 will replace the inner pages with native Focus screens.

## Design tokens

Focus uses semantic tokens rather than hard-coded one-off colors:

- `--focus-bg`
- `--focus-surface`
- `--focus-surface-secondary`
- `--focus-border`
- `--focus-border-soft`
- `--focus-text`
- `--focus-text-secondary`
- `--focus-text-muted`
- `--focus-primary`
- `--focus-primary-hover`
- `--focus-primary-soft`
- `--focus-success`
- `--focus-danger`
- `--focus-warning`
- `--focus-shadow`

Classic continues to use the existing `--background`, `--foreground`, `--panel`, `--line`, `--accent` tokens.

## Page coverage

Focus must eventually cover all pages, not only screens from mockups:

- My Day
- Dashboard
- Today
- Calendar
- Tasks
- Task detail
- Projects
- Project detail
- Unassigned
- Search
- Files
- Trash/archive
- Settings
- Profile
- Login/auth states
- empty/loading/error states

The visual language should be inferred from the supplied mockups and applied consistently to pages not shown in the designs.

## Testing expectations

Every stage should check:

- Classic still renders;
- Focus renders;
- light/dark/system appearance does not break;
- mobile does not lose primary navigation;
- existing data and mutations still use the same API.

