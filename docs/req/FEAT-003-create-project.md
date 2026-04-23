# FEAT-003: Create Project

## User Story

**As a** project manager  
**I want to** create a new project with its master data  
**so that** I can assign imports and track KPIs for it.

---

## Background

A project is the central entity in the dashboard. Before any data can be imported, the project must exist with at least its mandatory attributes. Default thresholds are created automatically so the dashboard works immediately after project creation. The user is taken directly to the import page after creation to encourage the next step.

---

## Acceptance Criteria

```gherkin
Feature: Create Project

  Background:
    Given the user is authenticated
    And the user is on the project overview page "/"

  Scenario: Opening the create dialog
    When the user clicks "New Project"
    Then a dialog opens with a form for project master data

  Scenario: Successful project creation
    Given the dialog is open
    When the user fills in Name, Project Number, Start Date, End Date, and Budget
    And submits the form
    Then a new project row is inserted in the database
    And a project_thresholds row with default values is created for the project
    And the user is redirected to "/projects/<newId>/import"

  Scenario: Validation — missing required fields
    Given the dialog is open
    When the user submits the form without filling in required fields
    Then inline error messages appear beneath each invalid field
    And no database insert is performed

  Scenario: Validation — end date before start date
    Given the dialog is open
    When the user sets an end date earlier than the start date
    And submits the form
    Then an error appears on the end date field
    And no database insert is performed

  Scenario: Validation — non-positive budget
    Given the dialog is open
    When the user enters 0 or a negative number for the budget
    And submits the form
    Then an error appears on the budget field
    And no database insert is performed

  Scenario: Optional fields
    Given the dialog is open
    When the user leaves Description and Customer empty
    And fills in all required fields
    And submits the form
    Then the project is created successfully with null values for those fields

  Scenario: Empty state — create first project button
    Given the user has no projects
    When the user clicks "Create First Project"
    Then the same dialog opens as for "New Project"
```

---

## Notes

- The dialog is a **client component** (`'use client'`) — it manages open/close state and wraps the form.
- The form submission calls a **Server Action** (`createProject`) — no API route needed.
- After `redirect()` in the Server Action, Next.js triggers client-side navigation; the dialog closes naturally as the page changes.
- `project_thresholds` is inserted with the same transaction-equivalent as the project — use separate inserts with the new project ID.
- Default threshold values: `budget_yellow_pct=15`, `budget_red_pct=25`, `schedule_yellow_days=5`, `schedule_red_days=15`, `resource_yellow_pct=85`, `resource_red_pct=100`, `scope_yellow_pct=10`, `scope_red_pct=20`.
- The Zod schema validates server-side in the Server Action. The same schema is used for the test suite (TDD).
- Date fields are rendered as `<input type="date">` — no external date picker library needed.
