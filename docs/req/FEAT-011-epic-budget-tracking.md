# FEAT-011: Epic Budget Tracking

**As a** project manager
**I want to** compare booked hours against the planned effort per Epic
**so that** I can identify early which Epics are running over budget or approaching their limit.

---

## Background

Effort planning in Jira happens at the Epic level via the **T-Shirt** column (numeric, unit = person-days).
Time is booked in OpenAir at Story level; each Story carries an **Epic Link** that references the parent Epic's Issue Key.

The aggregation chain is:
```
OA timesheet row
  → ticket_ref  (from Notes, e.g. "ABC-123")
  → jira_issues.issue_key  (Story)
  → jira_issues.epic_link  (Story → Epic Issue Key)
  → jira_issues.issue_key  (Epic)
  → jira_issues.t_shirt_days  (planned effort in PT)
```

Conversion factor: **1 person-day (PT) = 8 hours** (fixed, not configurable).

The warning threshold (how close to 100 % triggers yellow) is configurable per project in FEAT-007 settings (default: 10 %).

---

## Acceptance Criteria

### Parser — Jira (`lib/parsers/jira-parser.ts`)

```gherkin
Given a Jira Excel row with Issue Type = "Epic" and a numeric "T-Shirt" column value of "25"
When parseJiraExcel() processes the row
Then jira_issues.t_shirt_days = 25

Given a Jira Excel row with Issue Type = "Epic" and T-Shirt = "abc" (non-numeric)
When parseJiraExcel() processes the row
Then jira_issues.t_shirt_days = null

Given a Jira Excel row with Issue Type = "Epic" and T-Shirt column is empty
When parseJiraExcel() processes the row
Then jira_issues.t_shirt_days = null

Given a Jira Excel row with Issue Type = "Story" and Epic Link = "PROJ-12"
When parseJiraExcel() processes the row
Then jira_issues.epic_link = "PROJ-12"

Given a Jira Excel row with Issue Type = "Story" and no "Epic Link" column value
When parseJiraExcel() processes the row
Then jira_issues.epic_link = null

Given a Jira Excel row with Issue Type = "Epic"
When parseJiraExcel() processes the row
Then jira_issues.epic_link = null  # Epics do not have an Epic Link
```

### Dashboard Tile (project detail dashboard `/projects/[id]`)

```gherkin
Given a project with Jira and OpenAir data and at least one Epic approaching its T-Shirt budget
When the project detail dashboard renders with no active filters
Then an "Epic Budget" tile is visible showing:
  - count of overbooked Epics (bookedPT ≥ plannedPT) with red badge
  - count of near-limit Epics (bookedPT ≥ plannedPT × (1 - epicWarningMargin / 100) AND bookedPT < plannedPT) with yellow badge
  - both counts are based on all-time OA bookings (no date restriction when no filter active)

Given all Epics are within budget (below the warning threshold)
When the dashboard tile renders
Then both badge counts show 0 and the tile uses a neutral/green color

Given no Jira import has been performed for the project
When the dashboard tile renders
Then the tile shows "—" and no badge counts

Given the user clicks the Epic Budget tile
When the navigation resolves
Then the user lands on /projects/[id]/epics
And any currently active dashboard filters (team, sprint, date) are forwarded as URL params
```

### Dashboard Tile — Filter Behaviour

```gherkin
Given the dashboard has team filter "Team Alpha" active
When the Epic Budget tile renders
Then only OA timesheet entries with team = "Team Alpha" are counted as booked hours per Epic
And the badge counts reflect the filtered totals

Given the dashboard has sprint filter "CPI26.2.1 CW13/14 Oolong" active (start: 2026-03-30, end: 2026-04-11)
When the Epic Budget tile renders
Then only OA timesheet entries with booking_date between 2026-03-30 and 2026-04-11 inclusive are counted
And the badge counts reflect only hours booked within that sprint's date range

Given the dashboard has both team filter "Team Alpha" and sprint filter "CPI26.2.1 CW13/14 Oolong" active
When the Epic Budget tile renders
Then only OA entries matching BOTH conditions (team AND date range) are counted
(AND combination, consistent with FEAT-009)

Given the dashboard has a date filter for month "March 2026" active
When the Epic Budget tile renders
Then only OA entries with booking_date in March 2026 are counted per Epic
```

### Epic Detail Page `/projects/[id]/epics`

```gherkin
Given the user navigates to the Epic detail page with no active filters
When the page loads
Then a table is shown with one row per Epic found in the latest Jira import
And rows are sorted descending by Usage % by default
And booked hours reflect all-time OA bookings (no date restriction)

Given an Epic with t_shirt_days = 10 and 6.5 PT of booked effort (52 h via OA)
When the table renders
Then the row shows:
  - Epic Key: e.g. "PROJ-12"
  - Epic Name: the issue summary
  - Planned (PT): 10
  - Booked (h): 52.0
  - Booked (PT): 6.5
  - Usage %: 65 %
  - Status: green (below warning threshold assuming default 10 %)

Given an Epic with t_shirt_days = 10 and 9.2 PT booked (73.6 h)
When the table renders (default epicWarningMargin = 10 %)
Then Usage % = 92 %
And Status = yellow (≥ 90 % but < 100 %)

Given an Epic with t_shirt_days = 10 and 11 PT booked (88 h)
When the table renders
Then Usage % = 110 %
And Status = red (≥ 100 %)

Given an Epic with t_shirt_days = null (T-Shirt not set)
When the table renders
Then Planned (PT) shows "—"
And Booked (h) and Booked (PT) still show actual bookings
And Usage % shows "—"
And Status shows "—"

Given an Epic with no OA bookings linked to it
When the table renders
Then Booked (h) = 0 h, Booked (PT) = 0.0, Usage % = 0 %
And the Epic is still shown in the table

Given no OpenAir import has been performed
When the Epic detail page renders
Then the Booked (h) and Booked (PT) columns show "—" for all rows
And a notice "OpenAir import required for booking data" is displayed above the table

Given no OpenAir import has been performed
When the Epic detail page renders
Then the Booked (h) and Booked (PT) columns show "—" for all rows
And a notice "OpenAir import required for booking data" is displayed above the table

Given no Jira import has been performed
When the user navigates to /projects/[id]/epics
Then the page shows "Jira import required to display Epic data"
```

### Epic Detail Page — Filter Behaviour

```gherkin
Given the user is on /projects/[id]/epics
When the page first loads (no URL params)
Then no date filter is pre-selected (all-time view is the default)
And a filter bar is visible with: month picker, team filter, sprint filter

Given the user selects month "April 2026" in the month picker
When the filter is applied
Then only OA timesheet entries with booking_date in April 2026 count toward booked hours
And the URL reflects ?month=2026-04
And the table and usage percentages update accordingly

Given the user selects sprint "CPI26.2.1 CW13/14 Oolong" (start: 2026-03-30, end: 2026-04-11)
When the filter is applied
Then only OA entries with booking_date between 2026-03-30 and 2026-04-11 are counted
And the URL reflects ?sprint=CPI26.2.1+CW13%2F14+Oolong

Given the user selects two sprints with non-overlapping date ranges
When the filter is applied
Then OA entries from EITHER sprint's date range are counted (union, consistent with FEAT-009)

Given sprint filter (2026-03-30–2026-04-11) and month filter (April 2026) are both active
When the filter is applied
Then only OA entries with booking_date between 2026-04-01 and 2026-04-11 are counted
(intersection of both ranges, consistent with FEAT-009)

Given the user selects team filter "Team Alpha"
When the filter is applied
Then only OA entries with team = "Team Alpha" count toward booked hours
And the URL reflects ?team=Team+Alpha

Given team, sprint, and month filters are all active simultaneously
When the filter is applied
Then all three conditions are combined with AND
(consistent with existing filter behaviour across FEAT-008 and FEAT-009)

Given the user arrived via a click on the dashboard tile with active team filter "Team Alpha"
When the Epic detail page loads
Then the team filter is pre-set to "Team Alpha" (forwarded URL param)
And the table shows only bookings from Team Alpha
```

---

## Technical Notes

### Database migration

Add two columns to `jira_issues`:

```sql
ALTER TABLE jira_issues
  ADD COLUMN epic_link   text,       -- Issue Key of the parent Epic (set on Stories)
  ADD COLUMN t_shirt_days integer;   -- Planned effort in PT (set on Epics, null if unset/non-numeric)
```

Add one column to `project_thresholds` (see FEAT-007 extension):

```sql
ALTER TABLE project_thresholds
  ADD COLUMN epic_warning_margin_pct integer NOT NULL DEFAULT 10;
```

Migration file: `/supabase/migrations/YYYYMMDD_add_epic_budget_fields.sql`

### Parser changes (`lib/parsers/jira-parser.ts`)

- Parse `"T-Shirt"` column on rows where `issue_type = 'Epic'`:
  - Coerce value to integer via `parseInt()`.
  - If result is `NaN` or column is absent → store `null`.
  - **Column name matching is dash-agnostic:** Excel auto-correct can replace the
    hyphen in "T-Shirt" with an en-dash (–, U+2013) or em-dash (—, U+2014).
    `findColumnIndex` normalizes all dash variants to `-` before comparing, so
    "T–Shirt", "T—Shirt", and "T-Shirt" all match.
- Parse `"Epic Link"` column on rows where `issue_type = 'Story'` (and other non-Epic types):
  - Store trimmed string value.
  - If column absent or empty → store `null`.
- Epics themselves must not have `epic_link` set (leave `null`).
- `t_shirt_days` must be included in the `insertJira()` INSERT mapping in
  `app/api/projects/[id]/import/route.ts` — omitting it causes values to be parsed
  correctly but silently dropped before reaching the database.

### Calculation module (`lib/calculations/epic-calculations.ts`)

New file with pure functions — no DB calls:

```typescript
type EpicRow = {
  epicKey: string
  epicName: string
  plannedDays: number | null   // t_shirt_days
  bookedHours: number          // aggregated from OA
  bookedDays: number           // bookedHours / 8
  usagePct: number | null      // null when plannedDays is null
  status: 'red' | 'yellow' | 'green' | 'unknown'
}

// Aggregates OA hours to Epics via Story → Epic Link chain.
// timesheets must already be pre-filtered by the caller (date/team/sprint).
function calcEpicBudget(
  epics: JiraIssue[],          // issue_type = 'Epic'
  stories: JiraIssue[],        // issue_type = 'Story', has epic_link
  timesheets: OaTimesheet[],   // pre-filtered: only submitted/approved + active filters applied
  epicWarningMarginPct: number
): EpicRow[]

// Returns { overbooked, nearLimit } counts for the dashboard tile
function calcEpicTileSummary(rows: EpicRow[]): { overbooked: number; nearLimit: number }

// Applies date/team/sprint filters to a timesheet array (pure, no DB calls)
function filterTimesheets(
  timesheets: OaTimesheet[],
  filters: {
    team?: string[]
    dateFrom?: Date
    dateTo?: Date
  }
): OaTimesheet[]
```

Unit tests ≥ 95 % coverage, covering: no bookings, no T-Shirt, threshold boundary values (exactly at 90 %, exactly at 100 %), missing OA data.

### New route

`/app/(dashboard)/projects/[id]/epics/page.tsx` — Server Component.

URL parameters (all optional): `month` (ISO `YYYY-MM`), `team` (repeated), `sprint` (repeated).  
Consistent with the conventions established in FEAT-008 and FEAT-009.

All data fetched server-side in a single pass:
1. Load Epics from `jira_issues` where `project_id = id AND issue_type = 'Epic'`
2. Load Stories from `jira_issues` where `project_id = id AND epic_link IS NOT NULL`
3. Load **all** timesheets from `oa_timesheets` where `project_id = id AND status IN ('submitted','approved')` (filtering happens in the calculation layer via `filterTimesheets()`)
4. Load configured sprints from `project_sprints` for the project (needed to resolve sprint names → date ranges)
5. Load `project_thresholds.epic_warning_margin_pct`

Sprint name → date range resolution follows the same logic as FEAT-009: the union of selected sprints' date ranges forms a set of `[from, to]` windows; `filterTimesheets` applies them as an OR across windows, then ANDs the result with any active month filter.

Filter UI: plain HTML GET form (bookmarkable, works without JS). Reuses `SprintFilter` component from FEAT-009 and team filter component from FEAT-008.

### Epic Budget tile (`app/(dashboard)/projects/[id]/page.tsx`)

- Add "Epic Budget" tile to the project detail dashboard (alongside Budget, Zeitplan, Ressourcen, Scope, Time Analysis).
- Tile content:
  - **Red badge:** "{n} Epics over budget" — shown when `overbooked > 0`; badge hidden when 0.
  - **Yellow badge:** "{n} Epics near limit" — shown when `nearLimit > 0`; badge hidden when 0.
  - Overall tile color: red if any overbooked, yellow if any near-limit (but none overbooked), green/neutral otherwise.
  - Shows "—" when no Jira import exists.
- Clicking navigates to `/projects/[id]/epics` and **forwards all active filter URL params** (team, sprint, month) so the detail page opens pre-filtered to match what the tile is showing.
- The tile receives pre-filtered timesheets from the dashboard's server-side data load (the dashboard already resolves active filters before passing data to tiles — same pattern as Resources and Time Analysis tiles).

### RLS

No new RLS policies required — `jira_issues` already has a policy scoped to `projects.owner_id = auth.uid()`. New columns inherit existing row-level security.
