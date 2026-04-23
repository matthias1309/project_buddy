# FEAT-002: Project Overview

## User Story

**As a** project manager  
**I want to** see all my projects at a glance  
**so that** I can immediately identify which projects need attention.

---

## Background

Project managers are responsible for multiple concurrent projects. The overview is their entry point after login. It must communicate project health at a glance without requiring them to open each project individually. In this phase the stability status is a placeholder (always green) and will be replaced with real KPI-driven logic in Phase 5.

---

## Acceptance Criteria

```gherkin
Feature: Project Overview

  Background:
    Given the user is authenticated
    And the user is on the project overview page "/"

  Scenario: Viewing the project list
    Given the user has at least one project
    When the overview loads
    Then each project is displayed as a card
    And each card shows the project name
    And each card shows the project number (if set)
    And each card shows a stability badge
    And each card shows the date of the most recent import

  Scenario: Stability badge placeholder
    Given the user has projects with or without import data
    When the overview loads
    Then every stability badge is displayed as "Stable" (green)

  Scenario: Project with no imports
    Given a project has no import log entries
    When the overview loads
    Then the card shows "No data imported yet" instead of an import date

  Scenario: Navigating to a project
    Given a project card is visible
    When the user clicks the card
    Then the user is taken to "/projects/<id>"

  Scenario: Empty state — no projects
    Given the user has no projects
    When the overview loads
    Then the text "No projects yet" is shown
    And a "Create First Project" button is visible
    And no project cards are rendered

  Scenario: New project button
    Given the overview has loaded
    When the user looks at the top-right area
    Then a "New Project" button is visible
```

---

## Notes

- **Stability badge** is a placeholder in this phase — the value is hardcoded to `green`. Real computation is introduced in FEAT-006 / Phase 5.2.
- **Last import date** is derived from `import_logs.imported_at` (most recent entry per project). The query uses a single `.in()` call to avoid N+1 round-trips.
- The "New Project" button and "Create First Project" button open a dialog that is implemented in FEAT-003 / Phase 2.2 and will be wired up there.
- The page is a **Next.js Server Component** — no client-side data fetching, no loading states.
- The `Relationships` field was missing from all entries in `database.types.ts`, which caused TypeScript to resolve Supabase query result types as `never`. This was fixed as part of this feature.
