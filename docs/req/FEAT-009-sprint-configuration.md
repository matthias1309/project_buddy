# FEAT-009: Sprint Configuration & Filter

**As a** project manager  
**I want to** define sprints for my project and filter all views by sprint  
**so that** I can analyse delivery data within a specific sprint context.

---

## Background

Sprints are defined manually by the project manager — they are not derived from the Jira
import. The sprint name must exactly match the sprint value that appears in the Jira Excel
export (e.g. `CPI26.2.1 CW13/14 Oolong`), because it is used as the join key to filter
`jira_issues` rows.

A Jira issue's `sprint` column may contain multiple sprint names (comma-separated) when a
story was carried over across sprints. The filter treats an issue as belonging to a sprint
when the sprint name appears **anywhere** in the `sprint` text field (substring match).

OpenAir timesheet entries carry no sprint reference — they are filtered by the sprint's
date range (start ≤ booking date ≤ end).

When a sprint filter and a date filter are both active they are combined with **AND**:
only data matching both conditions is shown.

---

## Acceptance Criteria

### Part 1 — Sprint Configuration (Settings Page)

```gherkin
Given the user is on /projects/[id]/settings
When the page renders
Then a "Sprints" section is visible below the existing threshold settings
And the section shows a list of all configured sprints for the project, ordered by start_date ascending
And each sprint row displays: name, start date, end date, and Edit / Delete actions
And an "Add Sprint" button is visible

Given the user clicks "Add Sprint"
When the sprint form opens
Then fields for Name, Start Date, and End Date are shown
And all three fields are required

Given the user submits the sprint form with a valid name, start date, and end date
When the Server Action completes
Then the new sprint appears in the list ordered by start_date
And a success toast is shown

Given the user submits the sprint form with an empty Name field
When validation runs
Then the form shows the error "Sprint name is required" and does not save

Given the user submits the sprint form with end_date before start_date
When validation runs
Then the form shows the error "End date must be after start date" and does not save

Given the user submits the sprint form with end_date equal to start_date
When validation runs
Then the form shows the error "End date must be after start date" and does not save

Given the user clicks "Edit" on an existing sprint
When the sprint form opens pre-filled
Then the user can update name, start date, or end date
And saving applies the changes immediately in the list

Given the user clicks "Delete" on an existing sprint
When the confirmation dialog is accepted
Then the sprint is removed from the list
And a success toast is shown

Given the user clicks "Delete" on an existing sprint
When the confirmation dialog is dismissed
Then no change occurs
```

### Part 2 — Sprint Filter Component

```gherkin
Given a project has at least one configured sprint
When a page with the sprint filter renders
Then a "Sprint" multi-select dropdown is visible in the filter bar
And each configured sprint appears as a selectable option showing: name and date range (e.g. "CPI26.2.1 CW13/14 Oolong · 31 Mar – 11 Apr")

Given a project has no configured sprints
When a page with the sprint filter renders
Then the Sprint filter is not rendered

Given the user selects one or more sprints in the filter
When the filter is applied
Then the selected sprint names are added to the URL as repeated `sprint` query parameters
And the page re-renders with filtered data
And the browser URL is bookmarkable and shareable

Given the user clears all sprint selections
When the filter is applied
Then the `sprint` query parameter is removed from the URL
And the page shows unfiltered data

Given sprint filter and date filter are both active
When data is loaded
Then only records matching BOTH the sprint condition AND the date condition are shown
```

### Part 3 — Sprint Filter on Time Analysis Page (FEAT-008)

```gherkin
Given the user is on /projects/[id]/time
When the page renders
Then the Sprint filter appears alongside the existing month picker and team filter

Given the user selects sprint "CPI26.2.1 CW13/14 Oolong" (start: 2026-03-30, end: 2026-04-11)
When the filter is applied
Then all four sections (Hours by Team, Category Breakdown, Epic Hours Table, Bug Cost)
     show only OpenAir entries where booking date is between 2026-03-30 and 2026-04-11 inclusive

Given the user selects two sprints with non-overlapping date ranges
When the filter is applied
Then entries from EITHER sprint's date range are included (union of date ranges)

Given sprint filter (date range: 2026-03-30–2026-04-11) and month filter (April 2026) are both active
When the filter is applied
Then only OpenAir entries with booking date between 2026-04-01 and 2026-04-11 are shown
     (intersection of sprint range and month)

Given sprint filter is active and no OpenAir entries exist in the resulting date range
When the page renders
Then each section shows its standard empty state ("0 h" / "No data")
```

### Part 4 — Sprint Filter on Project Detail Dashboard (FEAT-006)

```gherkin
Given the user is on /projects/[id]
When the page renders
Then a Sprint filter is visible in the filter bar above the dashboard tiles

Given the user selects sprint "CPI26.2.1 CW13/14 Oolong"
When the filter is applied
Then the Scope tile shows only jira_issues where sprint ILIKE '%CPI26.2.1 CW13/14 Oolong%'
And the Time Analysis tile continues to show the current-month summary (unaffected by sprint filter)

Given the user selects multiple sprints
When the filter is applied
Then the Scope tile shows issues that match ANY of the selected sprint names
     (issue sprint field contains at least one of the selected names)

Given sprint filter and a date filter are both active on the project detail dashboard
When data is loaded
Then jira_issues must satisfy both: sprint name match AND created_date / resolved_date within the date range
```

---

## Technical Notes

### Database migration

```sql
-- File: supabase/migrations/20260427_003_project_sprints.sql

CREATE TABLE project_sprints (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_sprints_end_after_start CHECK (end_date > start_date)
);

CREATE INDEX project_sprints_project_id_idx ON project_sprints (project_id);

ALTER TABLE project_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_sprints: owner full access"
  ON project_sprints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_sprints.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_sprints.project_id
        AND projects.owner_id = auth.uid()
    )
  );

CREATE TRIGGER set_project_sprints_updated_at
  BEFORE UPDATE ON project_sprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Zod validation schema (`lib/validations/sprint.ts`)

```typescript
export const sprintSchema = z.object({
  name:       z.string().min(1, 'Sprint name is required'),
  start_date: z.string().date(),
  end_date:   z.string().date(),
}).refine(d => d.end_date > d.start_date, {
  message: 'End date must be after start date',
  path: ['end_date'],
});
```

### Sprint filter URL parameter convention

Consistent with FEAT-008's approach (plain HTML GET form, bookmarkable):

- Parameter name: `sprint` (repeated for multi-select)
- Example: `?sprint=CPI26.2.1+CW13%2F14+Oolong&sprint=CPI26.2.1+CW15%2F16+Foo`
- Server Components read via `searchParams.getAll('sprint')`

### Filtering logic (server-side)

**Jira issues (FEAT-006 Scope tile):**

```typescript
// selectedSprints: string[]
// Each selected sprint name is checked via ILIKE for substring match.
// An issue matches if it contains ANY selected sprint name.
const conditions = selectedSprints.map(s =>
  `sprint ILIKE '%${s.replace(/'/g, "''")}%'`
).join(' OR ');
// Append as: AND (sprint ILIKE '...' OR sprint ILIKE '...')
```

Use parameterised Supabase `.or()` — never raw string interpolation in production code.
The pseudocode above is for illustration only.

**OpenAir timesheets (FEAT-008):**

```typescript
// Compute the union of all selected sprints' date ranges.
// Then filter: booking_date >= minStart AND booking_date <= maxEnd
// If multiple non-contiguous ranges, filter each range and union results.
```

### Settings page changes (`app/(dashboard)/projects/[id]/settings/page.tsx`)

- Add a `<SprintSettings projectId={id} />` Server Component below the existing threshold form.
- `SprintSettings` fetches `project_sprints` for the project and renders the list + "Add Sprint" button.
- CRUD operations are implemented as Server Actions in `app/(dashboard)/projects/[id]/settings/actions.ts`.

### Sprint filter component (`components/shared/SprintFilter.tsx`)

- `'use client'` — needs to read/write URL search params via `useRouter` / `useSearchParams`.
- Props: `sprints: { id: string; name: string; start_date: string; end_date: string }[]`
- Renders a shadcn `Popover` + `Command` multi-select (same pattern as team filter in FEAT-008).
- On change: updates URL via `router.push` with new `sprint` params, preserving other params.

### Future scope (not part of FEAT-009)

- Using sprint start/end dates for **timeline derivation** in the project detail dashboard
  (planned velocity, sprint burn-down) — deferred to a later feature.
- Sprint filter on other future pages (e.g. resource planning).
