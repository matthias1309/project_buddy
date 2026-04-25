# ADR-005: Paginated Fetch for Large Timesheet Queries

**Status:** Accepted  
**Date:** 2026-04-25

## Context

Supabase (PostgREST) enforces a server-side `max_rows` limit on all REST API queries. The default is **1000 rows**. This cap cannot be overridden from the client side via `.limit()` — the server applies `MIN(client_limit, max_rows)`.

`oa_timesheets` can easily exceed 1000 rows per project (real-world exports contain 2,500–18,000+ rows per month). Without mitigation, queries silently truncate results, causing:

- Incomplete team lists in the Time Analysis page
- Wrong hour totals on the dashboard
- Results that vary depending on the row insertion order (i.e. the sort order of the imported Excel file)

## Decision

1. **`supabase/config.toml`**: raise `max_rows` from 1000 to 50000 for local development.
2. **`lib/supabase/paginate.ts`**: introduce `fetchAllTimesheets` and `fetchAllTimesheetsForProjects` — server-side helpers that paginate automatically using `.range()` until all rows are retrieved.
3. All pages that query `oa_timesheets` use these helpers instead of a plain `.select()`.

**For cloud (Vercel + Supabase Cloud):** raise `max_rows` in the Supabase dashboard under *Settings → API → Max Rows*. The pagination helper provides a safety net even if this is not done, at the cost of multiple sequential requests.

## Consequences

**Positive:**
- Results are always complete regardless of row count or insertion order.
- Works for both local and cloud Supabase without code changes.
- Page size (1000) stays within PostgREST defaults, so no server configuration is required for correctness.

**Negative:**
- A project with N rows requires `ceil(N / 1000)` sequential DB round-trips instead of one. For 2500 rows: 3 requests (~600 ms extra at 200 ms per request).
- Only `oa_timesheets` is paginated for now. Other tables (`jira_issues`, `oa_milestones`) remain on a single query but are less likely to exceed 1000 rows in practice.
