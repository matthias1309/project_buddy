# Chapter 1: Introduction and Goals

## Purpose

The PM-Dashboard is an internal web application for a mid-sized consulting and software company. It gives project managers a consolidated view of project health by combining data from two separate tools:

- **Jira** — technical delivery tracking (stories, bugs, sprints, epics)
- **OpenAir** — commercial and resource planning (time, budget, milestones)

Without this system, project managers must switch between two disconnected tools and reconcile data manually. The PM-Dashboard eliminates this friction by importing Excel exports from both systems, mapping them to a unified data model, and presenting aggregated status information on four stability dimensions.

The application runs inside the company intranet and is not publicly accessible.

## Requirements Overview

### MVP Scope (implemented)

| Feature | Description |
|---|---|
| Authentication | Email/password login via Supabase Auth, session-persistent |
| Project management | Create projects with master data (name, number, dates, budget) |
| Jira import | Upload Jira Excel export → parse → store issues and sprints |
| OpenAir import | Upload OpenAir Excel export → parse → store timesheets, milestones, budget |
| Import log | Every import is recorded with date, filename, status, and record count |
| Project overview | List of all projects with traffic-light stability indicator |
| Project dashboard | Four KPI cards (Budget, Schedule, Resources, Scope) with per-dimension traffic light |
| Threshold configuration | Per-project yellow/red thresholds for all four KPI dimensions |

### Future Scope (not in MVP)

- Role-based views (Product Owner, Programme Manager, Consultant)
- Time-series trending across imports
- Email notifications on threshold breaches
- PDF export of dashboard reports
- Direct API integration with Jira and OpenAir

## Quality Goals

| Priority | Quality Goal | Scenario |
|---|---|---|
| 1 | **Correctness** | KPI calculations and traffic-light logic produce the same result as manual calculation for any given dataset. No silent data loss during import. |
| 2 | **Performance** | The project dashboard loads within 2 seconds for a project with up to 500 Jira issues and 200 timesheet rows on a standard intranet connection. |
| 3 | **Role extensibility** | The data model and RLS policies can be extended with additional roles (PO, Programme Manager) without breaking existing project manager access. |
| 4 | **Maintainability** | A new developer can understand the import pipeline and add support for a new Excel column mapping within one working day. |

## Stakeholders

| Role | Expectation |
|---|---|
| Project Manager | Accurate, up-to-date project health at a glance; quick import workflow |
| Development Team | Clear conventions, testable logic, low coupling between UI and calculations |
| Company IT | Docker-based deployment on an internal server; Supabase as managed database |
