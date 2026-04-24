# Chapter 2: Constraints

## Technical Constraints

| Constraint | Rationale |
|---|---|
| **Next.js 14 with App Router** | Established standard for the team; App Router enables React Server Components for simpler data fetching without a separate API layer for reads |
| **TypeScript — no `any`** | Prevent silent type errors in KPI calculations and parser mappings, which are the most logic-dense parts of the system |
| **Supabase (PostgreSQL + Auth + RLS)** | Provides database, authentication, and row-level security in a single managed service; avoids building a custom backend for the MVP |
| **Excel import (no API integration)** | Jira and OpenAir API credentials are not available in the MVP. Excel export is the only sanctioned integration path |
| **Docker deployment on internal server** | The application must run in the company intranet without public internet access; Docker ensures reproducible deployment independent of the host OS |
| **shadcn/ui + Tailwind CSS** | Agreed UI stack; no CSS Modules, no styled-components. Keeps styling conventions consistent |
| **Recharts for charts** | Already a project dependency; avoids adding a second charting library |
| **xlsx (SheetJS) for Excel parsing** | Server-side only — never runs in the browser. Avoids bundling a large binary parser into the client bundle |
| **Zod for all validation** | Single validation library for forms, API responses, and Excel column mappings; enables schema reuse between frontend and backend |
| **Vitest for unit and integration tests** | Chosen for speed and native ESM support with Next.js |

## Organisational Constraints

| Constraint | Rationale |
|---|---|
| **Manual Excel import in MVP** | No API credentials for Jira or OpenAir; automated sync is a Phase 2 feature |
| **Single user role in MVP** | Only the `project_manager` role exists. The data model must support additional roles (see ADR-001), but role-switching UI is not in scope |
| **Maximum ~5 concurrent projects per user** | Practical limit for the MVP user group; no pagination required |
| **GDPR: minimal personal data** | Only user email and display names from OpenAir timesheets are stored. No sensitive personal data beyond what is needed for project reporting |
| **Browser support: Chrome, Firefox, Edge (current)** | Covers all browsers used in the company; no IE11 or Safari required |
| **No mobile app** | Responsive web is sufficient; the dashboard is used on desktop workstations |

## Conventions

| Convention | Detail |
|---|---|
| **Project language** | All code, comments, UI strings, and documentation are written in English |
| **File structure** | Follows the layout defined in `CLAUDE.md`; deviations require an ADR |
| **Migrations** | Every schema change is a separate dated SQL file under `/supabase/migrations/` |
| **RLS** | Enabled on every table without exception; policies follow the `auth.uid() = projects.owner_id` pattern |
