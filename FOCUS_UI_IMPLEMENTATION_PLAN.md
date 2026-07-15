# Focus UI implementation plan

## Stage 1 — Foundation and Classic protection

Deliverables:

- audit current frontend structure;
- create Focus architecture documentation;
- add `interfaceMode` and `appearance` preferences;
- apply preferences before hydration;
- add Focus design tokens for light and dark;
- create a base Focus shell with sidebar/topbar;
- keep Classic as the default and regression baseline;
- expose mode and appearance controls in Settings.

Out of scope for Stage 1:

- full redesign of every page body;
- backend preference persistence;
- full command palette implementation;
- calendar drag/resize redesign.

## Stage 2 — Primary work screens

Deliverables:

- Focus My Day:
  - today list;
  - day plan;
  - timeline without repeated empty-slot cards;
  - possible tasks;
  - drag-and-drop plus button alternatives.
- Focus Dashboard:
  - quick capture;
  - metrics;
  - attention list;
  - active projects;
  - recent activity.
- Focus Tasks:
  - list/card presentation;
  - filters;
  - grouped actions;
  - drawers for create/edit/view.
- Focus Projects:
  - project cards;
  - progress;
  - project detail redesign.
- Shared Focus cards and drawer wrappers.

## Stage 3 — Calendar, all pages, responsive polish

Deliverables:

- Focus calendar month:
  - Russian localization;
  - Monday-first weeks;
  - 24-hour time;
  - `+ ещё N` overflow;
  - filters.
- Focus calendar week/day:
  - working time range;
  - current-time line;
  - fixed/flexible visual language;
  - drag and resize.
- Full Focus coverage for pages not shown in mockups:
  - files;
  - search;
  - trash/archive;
  - unassigned;
  - settings;
  - profile;
  - login/auth states.
- Mobile navigation and mobile alternatives for drag-and-drop.
- Dark Focus theme pass.
- Accessibility and performance pass.

## Regression checklist

- Classic Light unchanged.
- Classic Dark unchanged.
- Focus Light works.
- Focus Dark works.
- Focus System follows OS preference.
- Mode selection survives refresh.
- Main navigation works in both modes.
- Voice button remains available.
- Existing API data remains shared between modes.
- No duplicate business logic is introduced.

