# Chapter 10: Quality Requirements

## Quality Goals (summary)

| Priority | Goal | Metric |
|---|---|---|
| 1 | Correctness | KPI results match manual calculation; no silent data loss on import |
| 2 | Performance | Dashboard loads < 2 s for up to 500 issues / 200 timesheet rows |
| 3 | Role extensibility | Additional roles require only new RLS policies and view components, no schema changes |
| 4 | Maintainability | New column mapping can be added to a parser within one working day |

---

## Quality Scenarios

### QS-01: KPI Calculation Correctness

| | |
|---|---|
| **Source** | Project manager, Development team |
| **Stimulus** | A project has 10 budget entries with known planned and actual values |
| **Environment** | Production; data loaded from Supabase |
| **Artefact** | `calcBudgetKPIs` in `lib/calculations/kpi-calculations.ts` |
| **Response** | `differenceEur`, `differencePct`, and `burnRate` match the values computed by hand in a spreadsheet |
| **Measure** | Unit test suite covers ≥ 95% of calculation logic; boundary values (zero budget, negative difference) are explicitly tested |

### QS-02: Import Completeness

| | |
|---|---|
| **Source** | Project manager |
| **Stimulus** | A Jira Excel export with 200 issues is uploaded |
| **Environment** | Production; file size < 10 MB |
| **Artefact** | `POST /api/projects/[id]/import` + `jira-parser.ts` |
| **Response** | All 200 issues are persisted to `jira_issues`; the import log records `records_imported = 200`; no rows from the previous import remain |
| **Measure** | `recordsImported` in the API response equals the row count of the uploaded file; verified by integration test with fixture file |

### QS-03: Dashboard Load Time

| | |
|---|---|
| **Source** | Project manager |
| **Stimulus** | Project manager navigates to the dashboard of a project with 500 Jira issues and 200 timesheet rows |
| **Environment** | Intranet; Next.js running in Docker on a standard server |
| **Artefact** | `/app/(dashboard)/projects/[id]/page.tsx` |
| **Response** | The page is fully rendered and interactive |
| **Measure** | Time-to-first-byte + RSC render ≤ 2 seconds measured in Chrome DevTools on the intranet network; achieved by running all 7 DB queries in a single `Promise.all` |

### QS-04: Cross-User Data Isolation

| | |
|---|---|
| **Source** | Security review |
| **Stimulus** | A logged-in user requests the dashboard of a project owned by another user by guessing a UUID |
| **Environment** | Production; Supabase RLS active |
| **Artefact** | All Supabase queries in server-side code |
| **Response** | The database returns an empty result; the application redirects to `/` without exposing any data |
| **Measure** | RLS policy `auth.uid() = projects.owner_id` is applied to all tables; verified by checking that every table in the migration has a corresponding policy |

### QS-05: Threshold Validation Correctness

| | |
|---|---|
| **Source** | Project manager |
| **Stimulus** | Project manager submits a threshold form where the red budget threshold is equal to or lower than the yellow threshold |
| **Environment** | Settings page, any browser |
| **Artefact** | `ThresholdsSchema` in `lib/validations/thresholds.schema.ts` |
| **Response** | The form shows an inline error on the red threshold field; no database write occurs |
| **Measure** | Zod refinement `budget_red_pct > budget_yellow_pct` is validated server-side in the Server Action before any DB call; tested for all four dimensions |

### QS-06: Parser Resilience to Unknown Columns

| | |
|---|---|
| **Source** | Project manager (when Jira adds a new column in an export) |
| **Stimulus** | A Jira Excel export contains columns not listed in the parser's column map |
| **Environment** | Any environment |
| **Artefact** | `parseJiraExcel` in `lib/parsers/jira-parser.ts` |
| **Response** | Unknown columns are silently ignored; all known columns are mapped correctly; no error is returned |
| **Measure** | Unit test with a fixture file containing an unknown column `"Custom Field XYZ"` verifies that parsing succeeds and the unknown column does not appear in the output |

### QS-08: E2E Test Coverage for Critical User Journeys

| | |
|---|---|
| **Source** | Development team |
| **Stimulus** | A code change is merged to `main` |
| **Environment** | Local dev server (`npm run dev`); Playwright with `workers: 1` |
| **Artefact** | `/e2e/*.spec.ts` (Playwright test suites) |
| **Response** | All critical user journeys pass end-to-end in a real Chromium browser against the running Next.js application |
| **Measure** | The following journeys are covered: (1) Auth: login, logout, redirect guards; (2) Project lifecycle golden path: create project → Jira import → OpenAir import → dashboard KPI tiles → navigation; (3) Import error handling: file too large, wrong file type, partial parse (missing key, missing budget fields); (4) Threshold settings: load defaults, save custom values, validation errors, reset to defaults; (5) Project form validation: required fields, cross-field date validation |

### QS-07: Role Extensibility

| | |
|---|---|
| **Source** | Development team (Phase 2 planning) |
| **Stimulus** | A new `product_owner` role needs read-only access to Jira data for projects they are a member of |
| **Environment** | Development |
| **Artefact** | Supabase schema + RLS policies |
| **Response** | The new role is added by creating a `project_members` junction table and adding RLS policies that allow the PO to SELECT from `jira_issues` and `jira_sprints` for their projects; no existing tables or columns need to change |
| **Measure** | Schema review confirms no `ALTER TABLE` is needed; only `CREATE POLICY` statements are added |
