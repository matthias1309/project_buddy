# FEAT-011: Epic Budget Tracking — Implementation Plan

**Status:** Complete ✓ (all 6 phases)  
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

### 2.1 Epic calculations — tests first ✓
- [x] Create `tests/calculations/epic-calculations.test.ts` (25 tests)

### 2.2 Epic calculations — implementation ✓
- [x] Create `lib/calculations/epic-calculations.ts`
  - `filterTimesheets`, `calcEpicBudget`, `calcEpicTileSummary`

### 2.3 Jira parser update ✓
- [x] `COL_TSHIRT = ["t-shirt", "t shirt", "tshirt"]` added
- [x] T-Shirt parsed for Epic rows only (case-insensitive); NaN/empty → `null`
- [x] `types/domain.types.ts`: `tShirtDays?: number | null` (null needed for "no value" case)
- [x] 7 new T-Shirt tests in `tests/parsers/jira-parser.test.ts`

---

## Phase 3 — Threshold Extension (FEAT-007) ✓

- [x] `lib/validations/thresholds.schema.ts`: `epicWarningMarginPct` field (done in Phase 1)
- [x] `lib/actions/threshold.actions.ts`: `epic_warning_margin_pct` read/write (done in Phase 1)
- [x] `components/dashboard/thresholds-form.tsx`: "Epic budget" card with single warning margin field
- [x] `tests/validations/thresholds.schema.test.ts`: new field cases (done in Phase 1)

---

## Phase 4 — Dashboard Tile ✓

- [x] **Bug fixed:** `ticketRef` + `taskCategory` added to OA mapping in `app/(dashboard)/projects/[id]/page.tsx`
- [x] `tShirtDays` added to Jira issue mapping
- [x] Epic budget computed with sprint date-range resolution + team filter via `filterTimesheets()`
- [x] Create `components/dashboard/epic-budget-card.tsx` (link, red/yellow counts, border color, "—" empty state)
- [x] `<EpicBudgetCard>` added to tile grid, active search params forwarded to epics link

---

## Phase 5 — Epic Detail Page ✓

- [x] Create `app/(dashboard)/projects/[id]/epics/page.tsx` (Server Component)
  - Period / team / sprint filters; sprint union ∩ month intersection logic
  - Table: Epic Key | Name | Planned (PT) | Booked (h) | Booked (PT) | Usage % | Status dot
  - Empty states for missing Jira data and missing OA data

---

## Phase 6 — Fixtures & Tests ✓

- [x] `tests/fixtures/generate-fixtures.ts`: T-Shirt column + PROJ-E1/PROJ-E2 Epic rows added to `jira-sample.xlsx`
- [x] Fixtures regenerated; `jira-sample.xlsx` now has 7 issues (5 + 2 epics)
- [x] `tests/parsers/jira-parser.test.ts`: length assertions updated, new fixture tShirtDays test
- [x] `e2e/project-flow.spec.ts`: 3 new E2E tests — tile visible, navigation, table row

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
