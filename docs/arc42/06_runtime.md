# Chapter 6: Runtime View

## Scenario 1 — Excel Import Flow

A project manager uploads a Jira Excel export. The sequence shows the full server-side processing path.

```mermaid
sequenceDiagram
    actor PM as Project Manager
    participant UI as Import Page<br/>(Client Component)
    participant API as /api/projects/[id]/import<br/>(API Route)
    participant Parser as jira-parser.ts
    participant DB as Supabase (PostgreSQL)

    PM->>UI: Select .xlsx file, click Upload
    UI->>API: POST multipart/form-data<br/>(file, source="jira")
    API->>API: Verify auth session
    API->>DB: SELECT project WHERE id=? AND owner_id=?
    DB-->>API: project row (or 404)
    API->>API: Check file size ≤ 10 MB
    API->>API: Check file extension (.xlsx / .xls)
    API->>Parser: parseJiraExcel(buffer)
    Parser->>Parser: Read workbook with SheetJS<br/>Normalize dash variants in headers (en-dash → hyphen)<br/>Map columns case-insensitively<br/>Skip empty rows<br/>Parse T-Shirt column → t_shirt_days (Epic rows only)<br/>Collect ParseErrors by row
    Parser-->>API: JiraParseResult { issues, sprints, errors, warnings }
    API->>DB: DELETE jira_issues WHERE project_id=?
    API->>DB: DELETE jira_sprints WHERE project_id=?
    API->>DB: INSERT jira_issues incl. t_shirt_days (batches of 500)
    API->>DB: INSERT jira_sprints (batches of 500)
    API->>DB: INSERT import_log { status, records_imported, … }
    API-->>UI: { success, recordsImported, errors, warnings }
    UI->>PM: Show success message + error list (if any)
```

**Key invariants:**
- The delete-then-insert pattern guarantees that re-importing the same file produces the same result (idempotent for the dataset)
- If the parser returns hard errors (missing Issue Key), the import still proceeds for valid rows; errors are surfaced in the response, not as an HTTP 4xx
- A hard database error on insert causes the API to return `success: false` and writes a `status: 'error'` import log entry

---

## Scenario 2 — Dashboard Page Load

A project manager navigates to a project dashboard. All data fetching and computation happens server-side.

```mermaid
sequenceDiagram
    actor PM as Project Manager
    participant Browser
    participant RSC as ProjectDashboardPage<br/>(React Server Component)
    participant DB as Supabase (PostgreSQL)
    participant Calc as kpi-calculations.ts<br/>stability-index.ts

    PM->>Browser: Navigate to /projects/[id]
    Browser->>RSC: HTTP GET (SSR request)
    RSC->>DB: getUser() — verify session
    DB-->>RSC: user or null
    Note over RSC: Redirect to /login if no session
    RSC->>DB: SELECT project, jira_issues (incl. t_shirt_days), jira_sprints,<br/>oa_milestones, oa_budget_entries, project_thresholds,<br/>import_logs (last OA import), project_sprints (parallel Promise.all)
    RSC->>DB: fetchAllTimesheets() — paginated (see ADR-005)
    DB-->>RSC: All rows (RLS enforced)
    RSC->>Calc: calcBudgetKPIs(budgetEntries, totalBudget)
    RSC->>Calc: calcScheduleKPIs(milestones, today)
    RSC->>Calc: calcResourceKPIs(timesheets)
    RSC->>Calc: calcScopeKPIs(issues, sprints)
    RSC->>Calc: calcStabilityIndex(kpis, thresholds)
    Calc-->>RSC: StabilityResult + KPI objects
    RSC->>RSC: Sum booked_hours for current calendar month (from timesheets)
    RSC->>Calc: filterTimesheets(allTimesheets, activeFilters)
    RSC->>Calc: calcEpicBudget(epics, allIssues, filtered, warningMarginPct)
    RSC->>Calc: calcEpicTileSummary(epicRows)
    Calc-->>RSC: EpicBudgetSummary { overbooked, nearLimit }
    RSC->>Browser: Full HTML (KPI cards + Time Analysis tile + Epic Budget tile, stability badge)
    Browser->>PM: Rendered dashboard (target: < 2 s)
```

**Key invariants:**
- All nine database queries (including `project_sprints` for sprint-filter resolution and `import_logs` for the Time Analysis tile) run in a single `Promise.all` — no sequential round-trips
- KPI computation is synchronous and happens in the same server request; no separate API call is needed
- RLS ensures that even if the wrong `[id]` is requested, Supabase returns empty results rather than another user's data
- The Time Analysis tile is always rendered; it shows `—` when no OpenAir import exists and `0 h` when imported but no bookings fall in the current month
- If no KPI data exists, the dashboard renders an empty-state prompt instead of the four KPI cards, but the Time Analysis tile remains visible

---

## Scenario 3 — Time Analysis Page Load

A project manager navigates to the Time Analysis page and applies a team filter. All data fetching and computation happens server-side; the filter is a plain HTML GET form (no client-side requests).

```mermaid
sequenceDiagram
    actor PM as Project Manager
    participant Browser
    participant RSC as TimeAnalysisPage<br/>(React Server Component)
    participant Paginate as paginate.ts
    participant DB as Supabase (PostgreSQL)
    participant Calc as time-calculations.ts

    PM->>Browser: Navigate to /projects/[id]/time?period=2026-01&team=Team+Panda
    Browser->>RSC: HTTP GET (SSR request)
    RSC->>DB: getUser() — verify session
    RSC->>DB: SELECT project WHERE id=? AND owner_id=?
    DB-->>RSC: project row
    RSC->>Paginate: fetchAllTimesheets(supabase, projectId)
    loop until all pages fetched
        Paginate->>DB: SELECT * FROM oa_timesheets<br/>WHERE project_id=?<br/>RANGE [0..999], [1000..1999], …
        DB-->>Paginate: up to 1000 rows per page
    end
    Paginate-->>RSC: all timesheet rows (e.g. 2700 rows)
    RSC->>DB: SELECT * FROM jira_issues WHERE project_id=?
    DB-->>RSC: jira_issues rows
    RSC->>RSC: filterByPeriod(timesheets, "2026-01")
    RSC->>RSC: filter by team = "Team Panda"
    RSC->>Calc: calcHoursByTeam(filtered)
    RSC->>Calc: calcHoursByCategory(filtered)
    RSC->>Calc: calcEpicHours(filtered, issues)
    RSC->>Calc: calcBugCost(filtered, issues)
    Calc-->>RSC: chart data + table data
    RSC->>Browser: Full HTML (4 sections + filter form)
    Browser->>PM: Rendered page
```

**Key invariants:**
- `fetchAllTimesheets` paginates automatically (1000 rows/page) to bypass Supabase's `max_rows` server cap — results are identical regardless of the row insertion order in the database (see ADR-005)
- The filter form uses GET parameters — the URL is bookmarkable and the page works without JavaScript
- Period filter supports both `YYYY-MM` (calendar month) and `7d` (rolling 7 days)
- All four calculation functions receive only the already-filtered subset; no data from other periods or teams reaches the chart layer

---

## Scenario 4 — Threshold Update

A project manager saves new threshold values on the settings page.

```mermaid
sequenceDiagram
    actor PM as Project Manager
    participant Form as ThresholdsForm<br/>(Client Component)
    participant SA as updateThresholds()<br/>(Server Action)
    participant DB as Supabase (PostgreSQL)

    PM->>Form: Edit threshold values, click Save
    Form->>SA: formAction(formData)
    SA->>SA: ThresholdsSchema.safeParse(formData)<br/>Validate all 9 fields + 4 refinements (incl. epic_warning_margin_pct)
    alt Validation fails
        SA-->>Form: { errors: { budget_red_pct: "…" } }
        Form->>PM: Inline error messages per field
    else Validation passes
        SA->>DB: getUser() — verify session
        SA->>DB: SELECT project WHERE owner_id=user.id
        SA->>DB: UPDATE project_thresholds SET … WHERE project_id=?
        DB-->>SA: OK
        SA-->>Form: { success: true }
        Form->>Form: router.refresh() — reload page data
        Form->>PM: "Thresholds saved successfully" banner
    end
```

---

## Scenario 5 — Epic Budget Page Load

A project manager navigates to the Epic Budget detail page with an optional team/sprint/month filter. All data fetching and computation happens server-side.

```mermaid
sequenceDiagram
    actor PM as Project Manager
    participant Browser
    participant RSC as EpicBudgetPage<br/>(React Server Component)
    participant Paginate as paginate.ts
    participant DB as Supabase (PostgreSQL)
    participant Calc as epic-calculations.ts

    PM->>Browser: Navigate to /projects/[id]/epics?team=Team+Alpha
    Browser->>RSC: HTTP GET (SSR request)
    RSC->>DB: getUser() — verify session
    RSC->>DB: SELECT project, jira_issues (all),<br/>project_sprints, project_thresholds.epic_warning_margin_pct<br/>(parallel Promise.all)
    RSC->>Paginate: fetchAllTimesheets(supabase, projectId)
    DB-->>RSC: All rows (RLS enforced)
    RSC->>RSC: Split issues: epics (issue_type = 'Epic') / allIssues
    RSC->>RSC: Resolve sprint filter → date range (union of selected sprints)
    RSC->>RSC: Intersect sprint range with month filter (if both active)
    RSC->>Calc: filterTimesheets(allTimesheets, { team, dateFrom, dateTo })
    Calc-->>RSC: filtered timesheets
    RSC->>Calc: calcEpicBudget(epics, allIssues, filtered, warningMarginPct)
    Calc-->>RSC: EpicBudgetRow[] sorted by usagePct desc (nulls last)
    RSC->>Browser: Full HTML (filter form + epic table with status dots)
    Browser->>PM: Rendered page
```

**Key invariants:**
- A single `Promise.all` loads all DB data; `fetchAllTimesheets` runs in parallel via pagination
- `filterTimesheets` is a pure function — filtering happens in the calculation layer, not in the DB query
- Sprint filter uses the union of selected sprint date ranges (min start → max end); when combined with a month filter, the intersection is computed before passing `dateFrom`/`dateTo`
- Rows with `t_shirt_days = null` receive `status = 'unknown'` and are sorted to the bottom of the table
- The page works without JavaScript (GET form for filters, bookmarkable URLs)
