# Changelog

All notable changes to this project are documented in this file.

---

## [MVP] — Phase 7 complete

### FEAT-001: Authentication

- Email/password login via Supabase Auth
- Middleware-based auth guard — all dashboard routes redirect to `/login` if unauthenticated
- Server Action `login()` — validates credentials, sets session cookie
- Server Action `logout()` — clears session, redirects to `/login`
- Generic error message on failed login (no hint whether email or password is wrong)
- Session persists across browser restarts (Supabase cookie-based session)
- Navigation bar shows user email and logout button

### FEAT-002: Project Overview

- Lists all projects belonging to the logged-in user
- Per-project stability badge (green / yellow / red / grey "no import")
- Shows the most critical KPI dimension and its value (e.g. budget deviation %)
- Last import date visible per project
- Empty state: prompt to create first project
- "Neues Projekt anlegen" button opens the create-project dialog

### FEAT-003: Create Project

- Dialog form with fields: Name, Project Number, Start Date, End Date, Total Budget (€), Description, Customer
- Zod validation schema (`lib/validations/project.schema.ts`) with inline field errors
- Server Action `createProject()` — validates → inserts project → creates `project_thresholds` with defaults → redirects to import page
- Default thresholds created automatically on project creation (15%/25% budget; 5/15 days; 85%/100% resource; 10%/20% scope)

### FEAT-004: Jira Import

- File upload (`.xlsx` / `.xls`) via drag-and-drop or file dialog
- 10 MB file size limit enforced in the API route
- `parseJiraExcel()` parser (`lib/parsers/jira-parser.ts`):
  - Maps English and German column headers case-insensitively
  - Required fields: Issue Key, Status — parse errors collected with row number
  - Unknown columns silently ignored; empty rows skipped
- Full replace on re-import (DELETE existing rows, then INSERT)
- Batch insert in chunks of 500 rows
- Import log entry created (date, filename, status, record count)
- Upload UI shows record count on success and parse errors with row numbers

### FEAT-005: OpenAir Import

- Same upload rules as FEAT-004
- `parseOpenAirExcel()` parser (`lib/parsers/openair-parser.ts`):
  - Detects Timesheets, Budget, and Milestones blocks by header row
  - English and German column headers supported
  - Missing budget fields produce warnings (not hard errors)
  - Negative hours produce warnings
- Import log entry created per import

### FEAT-006: Project Dashboard

- Server Component — all data fetched and all KPIs computed server-side (no client-side data requests)
- Header: project name, project number, overall stability badge with score
- Four KPI cards in a 2×2 grid:
  - **Budget**: Planned €, Actual €, Difference € (colour-coded), Burn Rate €/month, progress bar
  - **Schedule**: Next milestone with date, list of up to 3 delayed milestones with delay in days, milestone status bar chart
  - **Resources**: Horizontal bar chart of utilisation % per role (Recharts), reference line at 100%
  - **Scope**: Story point progress bar, completion %, bug rate %, velocity of last 3 sprints (Recharts mini line chart)
- Empty state: "Noch keine Daten vorhanden" prompt with link to import page when no data exists
- "Daten importieren" and "Einstellungen" buttons in page header

### FEAT-007: Threshold Configuration

- Settings page per project (`/projects/[id]/settings`)
- Form grouped into four sections: Budget, Schedule, Resources, Scope
- Each section: yellow threshold input + red threshold input with explanatory hint text
- Zod validation schema (`lib/validations/thresholds.schema.ts`):
  - Coercion from form string values to numbers
  - Refinement: red threshold must be strictly greater than yellow for all four dimensions
  - Centralised error message from `ERRORS.THRESHOLD_INVALID_RANGE`
- Server Action `updateThresholds()` — validates → checks project ownership → upserts thresholds
- Server Action `resetThresholds()` — resets all eight fields to system defaults
- Inline field errors on validation failure; success banner on save
- Reset button opens a confirmation dialog before writing
- After save or reset: `router.refresh()` reloads page data so dashboard reflects new thresholds immediately

---

## Technical improvements (Phase 7.2 — quality pass)

- Removed unused `_today` parameter from `calcScheduleKPIs()` and all callers
- Added `ERRORS.PROJECT_INVALID_DATE` and `ERRORS.IMPORT_NETWORK_ERROR` to centralise remaining hardcoded error strings
- Zero `any` types across the entire codebase
- No `console.log` in production code
- 13 test files, **165 tests passing**
- TypeScript: 0 errors (`tsc --noEmit`)
- ESLint: 0 warnings, 0 errors (`next lint`)
- RLS enabled on all 8 database tables

---

## Architecture decisions

| ADR | Decision |
|---|---|
| ADR-001 | Supabase instead of a custom backend |
| ADR-002 | Excel file import instead of direct API integration |
| ADR-003 | shadcn/ui instead of a custom design system |
| ADR-004 | Next.js App Router instead of Pages Router |

Full arc42 architecture documentation: [`docs/arc42/`](docs/arc42/)
