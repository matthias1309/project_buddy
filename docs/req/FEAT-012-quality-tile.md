# FEAT-012: Quality Tile & Bug Lead Time Analysis

**As a** project manager
**I want to** see the quality state of my project at a glance on the dashboard and drill into detailed bug metrics
**so that** I can identify priority bugs that are taking too long to resolve and understand the effort cost per bug priority.

---

## Background

Bug data comes from the Jira Excel import (`jira_issues` table, `issue_type = 'Bug'`).
Each bug carries a **Priority** column (Critical / Major / Minor / Trivial) which is not yet parsed.
Each bug also carries a **Teams** column (custom Jira field) which is used for filtering.

OA timesheets reference Jira tickets via `ticket_ref`; this enables computing average hours booked per bug.

Lead time is calculated as the number of **German working days** (Mon–Fri, excluding German federal public holidays) between `created_date` and `resolved_date`. Bugs with no `resolved_date` are considered **open**.

---

## Acceptance Criteria

### Parser — Jira (`lib/parsers/jira-parser.ts`)

```gherkin
Given a Jira Excel row with a "Priority" column value of "Critical"
When parseJiraExcel() processes the row
Then jira_issues.priority = "Critical"

Given a Jira Excel row with Priority = "Major" | "Minor" | "Trivial"
When parseJiraExcel() processes the row
Then jira_issues.priority = that exact value

Given a Jira Excel row with no "Priority" column or empty value
When parseJiraExcel() processes the row
Then jira_issues.priority = null

Given a Jira Excel row with a "Teams" column value of "Team Alpha"
When parseJiraExcel() processes the row
Then jira_issues.team = "Team Alpha"

Given a Jira Excel row with no "Teams" column or empty value
When parseJiraExcel() processes the row
Then jira_issues.team = null
```

### Working Day Calculation (`lib/calculations/quality-calculations.ts`)

German federal holidays applied (fixed-date + Easter-relative):
- New Year's Day: 1 Jan
- Good Friday: Easter − 2 days
- Easter Monday: Easter + 1 day
- Labour Day: 1 May
- Ascension Thursday: Easter + 39 days
- Whit Monday: Easter + 50 days
- German Unity Day: 3 Oct
- Christmas Day: 25 Dec
- Boxing Day: 26 Dec

```gherkin
Given created_date = Monday 2026-01-05 and resolved_date = Friday 2026-01-09
When calcWorkingDays() is called
Then result = 4 (Mon to Fri exclusive of start, inclusive of end)

Given created_date = Thursday 2026-04-02 and resolved_date = Wednesday 2026-04-08
When calcWorkingDays() is called
Then result = 2 (Good Friday 2026-04-03 and Easter Monday 2026-04-06 are excluded, weekend excluded)

Given created_date = resolved_date (same day)
When calcWorkingDays() is called
Then result = 0

Given resolved_date < created_date
When calcWorkingDays() is called
Then result = 0
```

### Quality KPI Calculations (`lib/calculations/quality-calculations.ts`)

```gherkin
Given a set of jira_issues with issue_type = "Bug" and mixed priorities
When calcOpenBugsByPriority() is called with those issues
Then it returns { critical: N, major: N, minor: N, trivial: N, unknown: N }
And only issues with no resolved_date are counted

Given a set of bugs and OA timesheets with matching ticket_ref entries
When calcAvgHoursByPriority() is called
Then it returns the mean booked hours across all bugs (open and closed) grouped by priority
And bugs with no OA bookings still count toward the group (0 h contribution)
And bugs with no priority are grouped under "unknown"

Given a closed bug (has resolved_date) with priority = "Critical"
And the configured threshold for Critical is 5 working days
And the calculated lead time is 6 working days
When calcBugLeadTimes() is called
Then the bug's leadTimeStatus = "red"

Given a closed bug with priority = "Major" and lead time = 10 working days
And the configured threshold for Major is 10 working days
When calcBugLeadTimes() is called
Then the bug's leadTimeStatus = "green" (exactly at threshold = on time)

Given a closed bug with no priority set (null)
When calcBugLeadTimes() is called
Then the bug is included with leadTimeStatus = "none" (no threshold applicable)
```

### Dashboard Tile (`/projects/[id]`)

```gherkin
Given a project with Jira data containing Bug issues with priorities
When the project dashboard renders
Then a "Quality" tile is visible showing:
  - Total count of open bugs (no resolved_date)
  - Breakdown: Critical X · Major X · Minor X · Trivial X
  - No ampel/status color on the tile

Given no Jira import exists
When the dashboard renders
Then the Quality tile shows "—" and no counts

Given the user clicks the Quality tile
When navigation resolves
Then the user lands on /projects/[id]/quality
And any active sprint and team filter params are forwarded as URL params
```

### Quality Detail Page (`/projects/[id]/quality`)

```gherkin
Given the user is on the quality detail page with no active filters
When the page loads
Then three sections are visible:
  1. "Open Bugs" — count by priority (Critical / Major / Minor / Trivial)
  2. "Avg Hours per Priority" — mean OA hours booked per bug, grouped by priority
  3. "Closed Bugs — Lead Time" — table of all closed bugs with columns:
       Issue Key | Summary | Priority | Created | Resolved | Lead Time (working days) | Status

Given a closed bug with lead time = 8 working days and priority = Critical (threshold = 5)
When the table renders
Then the row's Status cell shows a red badge and lead time "8 d"

Given a closed bug with lead time = 4 working days and priority = Critical (threshold = 5)
When the table renders
Then the row's Status cell shows a green badge and lead time "4 d"

Given a closed bug with no priority
When the table renders
Then Priority shows "—" and Status shows "—"
```

### Quality Detail Page — Filter Behaviour

```gherkin
Given the user selects team filter "Team Alpha" (Jira Teams column)
When the filter is applied
Then all three sections (open bugs, avg hours, lead time table) show only bugs where jira_issues.team = "Team Alpha"
And the URL reflects ?team=Team+Alpha

Given the user selects sprint filter "Sprint 5"
When the filter is applied
Then all three sections show only bugs where jira_issues.sprint contains "Sprint 5"
And the URL reflects ?sprint=Sprint+5

Given both team filter "Team Alpha" and sprint filter "Sprint 5" are active
When the filter is applied
Then only bugs matching BOTH conditions are shown (AND combination)

Given the user navigated here from the dashboard tile with ?team=Team+Alpha active
When the page first loads
Then the team filter is pre-set to "Team Alpha"
```

### FEAT-007 Extension — Quality Lead Time Thresholds (`/projects/[id]/settings`)

```gherkin
Given the user opens the project settings page
When the page loads
Then a new "Quality: Lead Time Thresholds" section is visible with four fields:
  - Critical bugs (working days): default 5
  - Major bugs (working days): default 10
  - Minor bugs (working days): default 20
  - Trivial bugs (working days): default 50

Given the user changes Critical threshold to 3 and saves
When the quality detail page re-renders
Then bugs with priority Critical and lead time > 3 are shown as red
```

---

## Technical Notes

### Database Migration

```sql
-- Extend jira_issues
ALTER TABLE jira_issues
  ADD COLUMN priority text,   -- "Critical" | "Major" | "Minor" | "Trivial" | null
  ADD COLUMN team     text;   -- value from "Teams" custom column in Jira Excel

-- Extend project_thresholds
ALTER TABLE project_thresholds
  ADD COLUMN quality_lead_critical_days integer NOT NULL DEFAULT 5,
  ADD COLUMN quality_lead_major_days    integer NOT NULL DEFAULT 10,
  ADD COLUMN quality_lead_minor_days    integer NOT NULL DEFAULT 20,
  ADD COLUMN quality_lead_trivial_days  integer NOT NULL DEFAULT 50;
```

Migration file: `/supabase/migrations/YYYYMMDD_add_quality_fields.sql`

No new RLS policies required — `jira_issues` inherits existing row-level security.

### Parser Changes (`lib/parsers/jira-parser.ts`)

Column name candidates (case-insensitive, first match wins):
- Priority: `["priority", "priorität", "prioritaet"]`
- Teams: `["teams", "team"]`

Parse for all issue types (not restricted to Bug).
If column absent or cell empty → `null`.

Include both fields in the `INSERT` mapping in `app/api/projects/[id]/import/route.ts`.

### Calculation Module (`lib/calculations/quality-calculations.ts`)

New file with pure functions — no DB calls:

```typescript
type BugPriority = "Critical" | "Major" | "Minor" | "Trivial";

type OpenBugsByPriority = {
  critical: number; major: number; minor: number; trivial: number; unknown: number;
};

type AvgHoursByPriority = {
  critical: number | null; major: number | null;
  minor: number | null; trivial: number | null; unknown: number | null;
};

type BugLeadTimeRow = {
  issueKey: string;
  summary: string | undefined;
  priority: BugPriority | null;
  createdDate: Date;
  resolvedDate: Date;
  leadTimeDays: number;
  leadTimeStatus: "red" | "green" | "none";
};

type QualityThresholds = {
  criticalDays: number; majorDays: number;
  minorDays: number; trivialDays: number;
};

// Count of open bugs (no resolved_date) grouped by priority
function calcOpenBugsByPriority(bugs: JiraIssue[]): OpenBugsByPriority

// Mean OA hours per bug grouped by priority (bugs with no bookings contribute 0)
function calcAvgHoursByPriority(
  bugs: JiraIssue[],
  timesheets: OATimesheet[]
): AvgHoursByPriority

// Lead time rows for all closed bugs (resolved_date IS NOT NULL)
function calcBugLeadTimes(
  bugs: JiraIssue[],
  thresholds: QualityThresholds
): BugLeadTimeRow[]

// German working days between two dates (end exclusive of start, inclusive of end)
// Returns 0 when end <= start
function calcWorkingDays(start: Date, end: Date): number

// Returns array of German federal holiday dates for a given year
function germanHolidays(year: number): Date[]

// Easter Sunday for a given year (Anonymous Gregorian algorithm)
function easterSunday(year: number): Date
```

Unit tests ≥ 95 % coverage (see Testing section).

### New Page

`/app/(dashboard)/projects/[id]/quality/page.tsx` — Server Component.

URL parameters (all optional): `team` (repeated), `sprint` (repeated).
Consistent with filter conventions from FEAT-008 / FEAT-009.

Data fetched server-side:
1. Bugs: `jira_issues WHERE project_id = id AND issue_type = 'Bug'`
2. All timesheets for the project (for avg hours calculation)
3. `project_thresholds` for lead time threshold values
4. `project_sprints` for sprint filter UI

Filter application:
- Team filter → `bug.team === selectedTeam`
- Sprint filter → `bug.sprint` contains selected sprint name (same string-contains logic as main dashboard)

### Dashboard Tile (`components/dashboard/quality-card.tsx`)

Client Component (needs `Link` for navigation).

Props:
```typescript
{
  projectId: string;
  openByPriority: OpenBugsByPriority | null;  // null = no Jira data
  searchString: string;  // forwarded URL params for navigation
}
```

### FEAT-007 Extension (`lib/validations/thresholds.schema.ts`)

Add four fields to `ThresholdsSchema`:
```typescript
quality_lead_critical_days: z.coerce.number().int().min(1),
quality_lead_major_days:    z.coerce.number().int().min(1),
quality_lead_minor_days:    z.coerce.number().int().min(1),
quality_lead_trivial_days:  z.coerce.number().int().min(1),
```

Add to `DEFAULT_THRESHOLDS`:
```typescript
quality_lead_critical_days: 5,
quality_lead_major_days: 10,
quality_lead_minor_days: 20,
quality_lead_trivial_days: 50,
```

Add to `ProjectThresholds` domain type:
```typescript
qualityLeadCriticalDays: number;
qualityLeadMajorDays: number;
qualityLeadMinorDays: number;
qualityLeadTrivialDays: number;
```

### Testing

**Unit tests** (`tests/calculations/quality-calculations.test.ts`, ≥ 95 % coverage):
- `calcWorkingDays`: same-day (0), normal week, spans weekend, spans Good Friday, spans Easter Monday, spans Christmas, resolved before created (0)
- `germanHolidays`: at least verify 2026 Good Friday = Apr 3 and Easter Monday = Apr 6
- `calcOpenBugsByPriority`: all priorities present, some missing, no bugs
- `calcAvgHoursByPriority`: matching ticketRef, no match, multiple timesheets per bug
- `calcBugLeadTimes`: exactly at threshold (green), one over (red), no priority (none)

**Parser tests** (`tests/parsers/jira-parser.test.ts`, extend existing):
- Priority column present with known values
- Priority column absent → null
- Teams column present
- Teams column absent → null

**E2E** (`e2e/quality.spec.ts`):
- Golden path: dashboard shows Quality tile with bug counts, click navigates to detail page
- Detail page shows lead time table with correct coloring for a fixture bug
- Team filter applied on detail page filters table rows
- Settings page shows new quality threshold fields, save persists values
