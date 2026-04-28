# ADR-007: Explicit `project_sprints` Table for Sprint Window Configuration

**Status:** Accepted  
**Date:** 2026-04-27

## Context

The dashboard needs to filter Jira issues and OpenAir timesheets by sprint. Two approaches were considered:

**Option A — Derive sprint windows from Jira sprint data.**  
The `jira_sprints` table already contains `start_date` and `end_date` per sprint, imported from the Jira Excel export. Sprint filter UI could use these rows directly.

**Option B — Maintain an app-level `project_sprints` configuration table.**  
Project managers define sprint windows explicitly in the Settings page. These windows are then used to resolve sprint names → date ranges for all filter operations.

The problem with Option A is that Jira sprint dates are often unreliable or absent in Excel exports: start/end dates may be missing, use inconsistent formats, or reflect sprint planning rather than actual delivery windows. Additionally, OpenAir does not know about Jira sprints at all — filtering OA timesheets by sprint requires a date range, not a sprint name.

## Decision

Introduce a dedicated `project_sprints` table (Option B). Project managers configure sprint windows manually in the Settings page. These windows serve as the authoritative source for:

1. **Sprint filter UI** — the `SprintFilter` component reads from `project_sprints`, not from `jira_sprints`
2. **Jira issue filtering** — the sprint name in `jira_issues.sprint` is matched via substring against the selected sprint names (e.g. `sprint ILIKE '%Sprint 5%'`)
3. **OA timesheet filtering** — the selected sprint's `start_date`/`end_date` is used as a date-range window for `oa_timesheets.period_date`

```sql
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
```

## Consequences

**Positive:**
- Sprint windows are reliable and accurate regardless of Jira export quality
- A single `project_sprints` row resolves to a date range that works uniformly for both Jira and OpenAir filtering
- Sprint names in `project_sprints` can be kept in sync with Jira sprint names, making the substring match on `jira_issues.sprint` predictable
- Multiple sprints selected → union of their date ranges (consistent behaviour across all pages)

**Negative:**
- Project managers must enter sprint windows manually; initial setup effort per project
- If Jira sprint names change after import, the substring match may need the `project_sprints.name` to be updated accordingly
- `jira_sprints` (from Jira export) and `project_sprints` (app config) coexist — two sprint-related tables with different purposes, which can cause confusion
