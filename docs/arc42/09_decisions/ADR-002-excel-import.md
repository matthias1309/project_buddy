# ADR-002: Excel File Import Instead of Direct API Integration

**Status:** Accepted  
**Date:** 2024-01-01

## Context

The PM-Dashboard needs data from Jira and OpenAir. There are two general approaches to getting that data:

1. **Direct API integration** — authenticate against Jira REST API and OpenAir API, pull data on demand or on a schedule
2. **Manual Excel import** — project managers export data as `.xlsx` files from each tool and upload them via the dashboard UI

## Decision

Use **manual Excel file upload** as the sole data ingestion mechanism for the MVP.

## Rationale

- **No API credentials available in the MVP timeline.** Both Jira and OpenAir require API tokens or OAuth configuration that involves coordination with IT and the respective tool administrators. This would block the MVP by weeks.
- **Excel export is already part of the workflow.** Project managers regularly export reports from both tools for other purposes. The upload step adds minimal friction compared to what they already do.
- **Scope control.** A robust API integration must handle pagination, rate limits, token refresh, error retry, and delta sync. An Excel parser handles a file at a time and can be built and tested in isolation.
- **SheetJS (xlsx library) is mature and well-supported** for reading `.xlsx` and `.xls` files server-side without spawning external processes.

## Consequences

**Positive:**
- No dependency on external API availability or credentials for the MVP
- The import pipeline is testable with synthetic fixture files
- Easy to reason about: one upload → one consistent snapshot of project state

**Negative:**
- Data freshness depends on how often project managers run exports and upload them (no real-time sync)
- Column names in Jira/OpenAir exports can change between versions; the parser must be maintained when export formats change
- The parser must handle both English and German column headers (both are observed in practice)
