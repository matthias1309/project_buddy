# FEAT-011: Epic Budget Tracking — Implementation Plan

**Status:** Phase 1 complete ✓  
**Requirement:** [docs/req/FEAT-011-epic-budget-tracking.md](../req/FEAT-011-epic-budget-tracking.md)  
**FEAT-007 extension:** [docs/req/FEAT-007-threshold-configuration.md](../req/FEAT-007-threshold-configuration.md)

---

## Key findings from codebase review

- `JiraIssue.epic` already exists — the parser already reads the "Epic Link" column via `COL_EPIC`. Only `tShirtDays` is new.
- **Bug to fix:** `ticketRef` is missing from the OA timesheet mapping in `app/(dashboard)/projects/[id]/page.tsx:152-161`. Without it the aggregation chain (OA → Story → Epic) does not work on the dashboard.
- `filterBySprints` / `filterByPeriod` are inlined in `app/(dashboard)/projects/[id]/time/page.tsx`. The new pure `filterTimesheets()` in Phase 2 covers the same logic and is used by the epics page — no refactor of the time page needed.

---

## Phase 1 — DB & Domain Types

### 1.1 Database migration ✓
- [x] Create `/supabase/migrations/20260427_004_epic_budget_fields.sql`
  - `ALTER TABLE jira_issues ADD COLUMN t_shirt_days integer;`
  - `ALTER TABLE project_thresholds ADD COLUMN epic_warning_margin_pct integer NOT NULL DEFAULT 10;`
- [x] `types/database.types.ts` manually updated to reflect new columns (`t_shirt_days`, `epic_warning_margin_pct`)

### 1.2 Domain types ✓
- [x] `types/domain.types.ts`: `tShirtDays?: number` added to `JiraIssue`
- [x] `types/domain.types.ts`: `epicWarningMarginPct: number` added to `ProjectThresholds`
- [x] `types/domain.types.ts`: `EpicBudgetRow`, `EpicBudgetSummary`, `EpicBudgetStatus` added
- [x] `DEFAULT_THRESHOLDS` updated in all three locations:
  - `app/(dashboard)/projects/[id]/page.tsx`
  - `app/(dashboard)/page.tsx`
  - `lib/validations/thresholds.schema.ts`
- [x] `rawThresholds` mapping updated to include `epicWarningMarginPct` in:
  - `app/(dashboard)/projects/[id]/page.tsx`
  - `app/(dashboard)/page.tsx`
  - `app/(dashboard)/projects/[id]/settings/page.tsx`
- [x] `lib/actions/threshold.actions.ts`: `epic_warning_margin_pct` added to formData read and upsert
- [x] `lib/validations/thresholds.schema.ts`: `epic_warning_margin_pct` field added (min 1, max 99)
- [x] `tests/validations/thresholds.schema.test.ts`: updated `validInput`, added 4 new test cases
- [x] `tests/calculations/stability-index.test.ts`: `epicWarningMarginPct` added to fixture
- [x] All 308 unit tests passing ✓

---

## Phase 2 — Logic (TDD)

**Rule:** Write tests first, then implement until green.

### 2.1 Epic calculations — tests first
- [ ] Create `tests/calculations/epic-calculations.test.ts`
  - Epic with no OA bookings → 0 h, 0 PT, 0 %, green
  - Epic with no T-Shirt (`null`) → `plannedDays = null`, `usagePct = null`, `status = 'unknown'`
  - Epic at exactly 90 % usage (warningMargin = 10) → yellow
  - Epic at exactly 100 % usage → red
  - Epic at 89 % (warningMargin = 10) → green
  - Epic at 101 % → red
  - Team filter: only bookings from matching team counted
  - Sprint filter (date range): only bookings within window counted
  - Month filter: only bookings in that month counted
  - Two sprints (union of date ranges): both windows included
  - Sprint + month filter (intersection): only overlap counted
  - `calcEpicTileSummary`: correct overbooked / nearLimit counts
  - `filterTimesheets`: team, date-from/to, combined

### 2.2 Epic calculations — implementation
- [ ] Create `lib/calculations/epic-calculations.ts`
  ```typescript
  filterTimesheets(timesheets, { team?, dateFrom?, dateTo? }): OATimesheet[]
  calcEpicBudget(epics, allIssues, timesheets, warningMarginPct): EpicBudgetRow[]
  calcEpicTileSummary(rows): EpicBudgetSummary
  ```
  - Aggregation chain: `ticketRef` → Story (`issueKey`) → `epic` (= Epic Issue Key) → Epic → `tShirtDays`
  - Conversion: `bookedDays = bookedHours / 8`
  - Status logic: red ≥ 100 %, yellow ≥ (100 - warningMargin) %, green below, unknown if no `plannedDays`
  - Sort result descending by `usagePct` (nulls last)

### 2.3 Jira parser update
- [ ] Add `COL_TSHIRT = ["t-shirt", "t shirt", "tshirt"]` to `lib/parsers/jira-parser.ts`
- [ ] In `parseIssuesSheet`: read T-Shirt column, `parseInt()` the value; `NaN` or absent → `null`
- [ ] Only set `tShirtDays` on rows where `issueType` matches "epic" (case-insensitive)
- [ ] Map `tShirtDays` in the import route (`app/api/projects/[id]/import/route.ts`) when writing to DB
- [ ] Extend `tests/parsers/jira-parser.test.ts`:
  - Epic row with T-Shirt = "25" → `tShirtDays = 25`
  - Epic row with T-Shirt = "abc" → `tShirtDays = null`
  - Epic row with T-Shirt empty → `tShirtDays = null`
  - Story row → `tShirtDays` not set (undefined)

---

## Phase 3 — Threshold Extension (FEAT-007)

- [ ] `lib/validations/thresholds.schema.ts`: add `epicWarningMarginPct: z.coerce.number().min(1).max(99).default(10)`
- [ ] `lib/actions/threshold.actions.ts`: read/write `epic_warning_margin_pct` from DB
- [ ] `components/dashboard/thresholds-form.tsx`: add "Epic warning margin %" input field (single value, no red/yellow pair)
- [ ] `tests/validations/thresholds.schema.test.ts`: add cases for new field (valid, below min, above max)

---

## Phase 4 — Dashboard Tile

- [ ] **Fix bug:** add `ticketRef: r.ticket_ref ?? undefined` to OA mapping in `app/(dashboard)/projects/[id]/page.tsx:152-161`
- [ ] Extend `rawThresholds` mapping to include `epicWarningMarginPct: rawThresholds.epic_warning_margin_pct`
- [ ] Compute epic tile data in dashboard page (re-uses already-loaded `allIssues` + `allTimesheets`):
  - Apply active team/sprint/date filters via `filterTimesheets()` before calling `calcEpicBudget()`
  - Call `calcEpicTileSummary()` for badge counts
- [ ] Create `components/dashboard/epic-budget-card.tsx`
  - Props: `projectId`, `overbooked`, `nearLimit`, `hasJiraData`, active filter params (for forwarding)
  - Link to `/projects/[id]/epics?<active-params>`
  - Red badge + yellow badge, tile color reflects worst status
  - Shows "—" when `hasJiraData = false`
- [ ] Add `<EpicBudgetCard>` to tile grid in `app/(dashboard)/projects/[id]/page.tsx`

---

## Phase 5 — Epic Detail Page

- [ ] Create `app/(dashboard)/projects/[id]/epics/page.tsx` (Server Component)
  - `searchParams`: `period?: string`, `team?: string | string[]`, `sprint?: string | string[]`
  - Data load (parallel `Promise.all`):
    1. Epics from `jira_issues` where `issue_type ILIKE 'epic'`
    2. All issues with `epic_link IS NOT NULL` (Stories)
    3. All timesheets `status IN ('submitted','approved')`
    4. `project_sprints` (to resolve sprint name → date range)
    5. `project_thresholds.epic_warning_margin_pct`
  - Default period: none (all-time) — unlike time page which defaults to current month
  - Sprint filter: resolve names to date ranges, union of windows, AND with month filter
  - Reuse `SprintFilter` component and team select from `time/page.tsx`
  - Table: Epic Key | Epic Name | Planned (PT) | Booked (h) | Booked (PT) | Usage % | Status
  - Status shown as coloured dot / badge (green / yellow / red / —)
  - Empty states: no Jira data, no OA data
  - Back link to dashboard

---

## Phase 6 — Fixtures & Tests

- [ ] `tests/fixtures/generate-fixtures.ts`: add "T-Shirt" column to `jira-sample.xlsx` (mix of numeric values, one empty, one non-numeric)
- [ ] Regenerate fixtures: `npx tsx tests/fixtures/generate-fixtures.ts`
- [ ] Add E2E golden path to `e2e/project-flow.spec.ts`:
  - Epic Budget tile visible after Jira + OA import
  - Click tile → lands on `/projects/[id]/epics`
  - Table shows at least one Epic row

---

## Dependency order

```
Phase 1 (Migration + Types)
  └─ Phase 2 (Tests → epic-calculations.ts → jira-parser.ts)
       └─ Phase 3 (Thresholds schema + form)
            └─ Phase 4 (Dashboard tile — needs ticketRef fix + threshold value)
                 └─ Phase 5 (Detail page — reuses filterTimesheets from Phase 2)
                      └─ Phase 6 (Fixtures + E2E)
```

---

## Files touched summary

| File | Change |
|---|---|
| `supabase/migrations/YYYYMMDD_add_epic_budget_fields.sql` | new |
| `types/domain.types.ts` | extend JiraIssue, ProjectThresholds; add EpicBudgetRow, EpicBudgetSummary |
| `lib/calculations/epic-calculations.ts` | new |
| `lib/parsers/jira-parser.ts` | add T-Shirt column parsing |
| `app/api/projects/[id]/import/route.ts` | map t_shirt_days when writing jira_issues |
| `lib/validations/thresholds.schema.ts` | add epicWarningMarginPct |
| `lib/actions/threshold.actions.ts` | read/write epic_warning_margin_pct |
| `components/dashboard/thresholds-form.tsx` | add Epic warning margin field |
| `components/dashboard/epic-budget-card.tsx` | new |
| `app/(dashboard)/projects/[id]/page.tsx` | fix ticketRef bug; add epic tile; extend thresholds mapping |
| `app/(dashboard)/projects/[id]/epics/page.tsx` | new |
| `tests/calculations/epic-calculations.test.ts` | new |
| `tests/parsers/jira-parser.test.ts` | extend with T-Shirt cases |
| `tests/validations/thresholds.schema.test.ts` | extend with epicWarningMarginPct cases |
| `tests/fixtures/generate-fixtures.ts` | add T-Shirt column |
| `e2e/project-flow.spec.ts` | add Epic Budget golden path |
