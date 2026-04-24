# FEAT-008: Team & Time Analysis

**As a** project manager  
**I want to** see how hours from OpenAir are distributed across teams, task categories, and Jira epics  
**so that** I can identify where effort is concentrated and whether it aligns with planned work.

---

## Background

OpenAir exports contain one row per time booking with the columns:
`Date`, `Client`, `Project`, `Task`, `Hours`, `Notes`, `Status`

The `Project` column encodes the team name as a suffix: `"<ProjectName> - Team <X>"`.  
The `Notes` column contains free text that may include a Jira ticket reference (e.g. `"worked on ABC-123"`).  
The `Task` column uses exactly four categories: `Regular Meeting`, `Development`, `Steuerung`, `Organization`.

Only entries with `Status = submitted` or `Status = approved` count as billable/relevant.

---

## Acceptance Criteria

### Parser

```gherkin
Given an OpenAir Excel row with Project = "Acme Rollout - Team Alpha"
When parseOpenAirExcel() processes the row
Then oa_timesheets.team = "Alpha"

Given a Project value without a "- Team X" suffix
When parseOpenAirExcel() processes the row
Then oa_timesheets.team = null

Given a Notes value of "fixed bug, see ABC-123 for details"
When parseOpenAirExcel() extracts the ticket reference
Then oa_timesheets.ticket_ref = "ABC-123"

Given a Notes value with no ticket reference
When parseOpenAirExcel() processes the row
Then oa_timesheets.ticket_ref = null

Given an entry with Status = "rejected"
When the import pipeline processes the row
Then the row is excluded from all time analysis calculations

Given an entry with Status = "open"
When the import pipeline processes the row
Then the row is excluded from all time analysis calculations
```

### Dashboard Summary Card (main dashboard `/`)

```gherkin
Given a project with at least one approved or submitted timesheet entry
When the project overview page renders
Then each project card shows a "Time" section with total hours for the current month

Given the current month has no submitted/approved entries for a project
When the project overview page renders
Then the Time section shows 0 h

Given the user clicks the Time section of a project card
When the navigation resolves
Then the user lands on /projects/[id]/time
```

### Time Analysis Page `/projects/[id]/time`

```gherkin
Given the user is on the time analysis page
When the page first loads
Then the default time filter shows the current calendar month

Given the user selects "Last 7 days" in the time filter
When the filter is applied
Then all four sections update to show only data from the last 7 days

Given the user selects a specific month (e.g. "March 2026") in the month picker
When the filter is applied
Then all four sections update to show data from that month only

Given a project has bookings across multiple teams
When the team filter shows "All teams"
Then charts and tables aggregate data across all teams

Given the user selects a specific team in the team filter
When the filter is applied
Then all four sections show data for that team only
```

#### Section 1 — Hours by Team (bar chart)

```gherkin
Given filtered timesheet data
When the Hours by Team chart renders
Then each bar represents one team
And the bar height represents total approved/submitted hours in the selected period
And teams are sorted descending by hours
```

#### Section 2 — Category Breakdown (stacked bar or donut)

```gherkin
Given filtered timesheet data
When the Category Breakdown chart renders
Then it shows hours split by: Regular Meeting, Development, Steuerung, Organization
And the breakdown is shown per team when a specific team is selected
And totals are shown when "All teams" is selected
```

#### Section 3 — Epic Hours Table (requires both OpenAir + Jira data)

```gherkin
Given timesheet entries with a ticket_ref and matching jira_issues rows
When the Epic Hours table renders
Then each row shows: Epic / Ticket, Booked Hours (OA), Story Points (Jira)

Given no Jira data is available
When the Epic Hours table renders
Then the table shows a hint "Jira import required for epic mapping"

Given a ticket_ref that matches no jira_issues row
When the Epic Hours table renders
Then the row appears with ticket_ref as label and "—" in the Story Points column
```

#### Section 4 — Bug Cost Indicator

```gherkin
Given timesheet entries linked to Jira issues of type "Bug"
When the Bug Cost indicator renders
Then it shows: total hours booked to bugs, hours per story point (total_bug_hours / total_sp)

Given no bug-type issues are linked
When the Bug Cost indicator renders
Then it shows 0 h and a "No bug bookings" note
```

---

## Technical Notes

### Parser changes (`lib/parsers/openair-parser.ts`)

- Extract `team`: apply regex `/- Team (.+)$/` on the `Project` column value. Group 1 = team name. If no match, set `null`.
- Extract `ticket_ref`: apply regex `/\b([A-Z]+-\d+)\b/` on the `Notes` column value. First match = ticket ref. If no match, set `null`.
- Map `task_category` directly from the `Task` column value. Accepted values: `Regular Meeting`, `Development`, `Steuerung`, `Organization`. Any other value → set `null` and emit a warning.
- Filter rows: only rows where `Status` is `"submitted"` or `"approved"` (case-insensitive) are written to the database. Rejected/open rows are counted in the import log as `skipped_rows`.

### Database migration

Add three columns to `oa_timesheets`:

```sql
ALTER TABLE oa_timesheets
  ADD COLUMN team           text,
  ADD COLUMN ticket_ref     text,
  ADD COLUMN task_category  text;
```

### New route

`/app/(dashboard)/projects/[id]/time/page.tsx` — Server Component.

- Query parameters: `month` (ISO `YYYY-MM`, default = current month) and `team` (team name string, default = all).
- All data fetched server-side; no client-side data requests.
- Filter UI (time + team) must work as a plain HTML form with GET parameters so it is bookmarkable and works without JS.

### Dashboard card addition (`app/(dashboard)/page.tsx`)

- Add a compact "Time" row to each project card showing `X h` for the current month (submitted + approved only).
- Clicking the row navigates to `/projects/[id]/time`.
- If no timesheet data exists for the project, show `—` instead of `0 h` to avoid confusion with "imported but zero hours".

### KPI / calculation module

- New file `lib/calculations/time-calculations.ts` with pure functions:
  - `calcHoursByTeam(entries)` → `{ team: string; hours: number }[]`
  - `calcHoursByCategory(entries)` → `{ category: string; hours: number }[]`
  - `calcEpicHours(timesheets, jiraIssues)` → `{ ref: string; hours: number; storyPoints: number | null }[]`
  - `calcBugCost(timesheets, jiraIssues)` → `{ totalHours: number; hoursPerSP: number | null }`
- All functions are pure (no DB calls, no side effects) and covered by unit tests ≥ 95%.

### RLS

No new RLS policies required — `oa_timesheets` already has a policy scoped to `projects.owner_id = auth.uid()`. The new columns inherit the existing row-level security.
