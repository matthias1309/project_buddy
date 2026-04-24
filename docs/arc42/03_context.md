# Chapter 3: Context and Scope

## Business Context

The PM-Dashboard sits at the intersection of three external systems. It consumes data from Jira and OpenAir via Excel file uploads and persists it in Supabase. Project managers interact with the system through a web browser.

```mermaid
graph TD
    PM["👤 Project Manager\n(Browser)"]
    DASH["PM-Dashboard\n(Next.js / Docker)"]
    JIRA["Jira\n(Issue Tracker)"]
    OA["OpenAir\n(Resource & Budget)"]
    SB["Supabase\n(PostgreSQL + Auth)"]

    PM -- "Login / Manage projects\nUpload Excel files\nView dashboard" --> DASH
    JIRA -- "Excel Export (.xlsx)\nIssues, Sprints, Epics" --> PM
    PM -- "Upload Jira export" --> DASH
    OA -- "Excel Export (.xlsx)\nTimesheets, Budget, Milestones" --> PM
    PM -- "Upload OpenAir export" --> DASH
    DASH -- "Read / write project data\nAuthenticate users" --> SB
```

## External Interfaces

### Jira (source system)

| Property | Detail |
|---|---|
| Integration type | Manual file upload (no API) |
| File format | `.xlsx` / `.xls` |
| Initiated by | Project manager downloads export from Jira, then uploads via dashboard UI |
| Key data | Issue Key, Summary, Issue Type, Status, Story Points, Sprint, Epic, Assignee, Created, Resolved |
| Column names | English and German column headers are both supported |
| Maximum file size | 10 MB |

### OpenAir (source system)

| Property | Detail |
|---|---|
| Integration type | Manual file upload (no API) |
| File format | `.xlsx` / `.xls` |
| Initiated by | Project manager downloads export from OpenAir, then uploads via dashboard UI |
| Key data | Employee, Role, Phase, Planned Hours, Actual Hours, Budget, Milestones |
| Column names | English and German column headers are both supported |
| Maximum file size | 10 MB |

### Supabase (persistence and auth)

| Property | Detail |
|---|---|
| Role | Managed PostgreSQL database + Supabase Auth |
| Access | Server-side only (via `@supabase/ssr`); the anon key is never used for write operations |
| Security | Row Level Security enforces that each user can only access their own projects |
| Hosted | Supabase Cloud (MVP) or Supabase Self-Hosted (future intranet deployment) |

## Technical Context

```mermaid
graph LR
    subgraph Browser
        UI["Next.js Pages\n(React Server + Client Components)"]
    end

    subgraph "Docker Container (Intranet)"
        APP["Next.js App Server\n(Node.js)"]
        PARSER["Excel Parsers\n(Server-side only)"]
        CALC["KPI Calculations\n(Pure functions)"]
    end

    subgraph "Supabase (external)"
        PG["PostgreSQL"]
        AUTH["Auth Service"]
    end

    UI -- "HTTP / RSC streaming" --> APP
    APP --> PARSER
    APP --> CALC
    APP -- "Supabase JS client (server)" --> PG
    APP -- "Supabase Auth (server)" --> AUTH
```

The Next.js application server handles all communication with Supabase. The browser never connects to Supabase directly for data reads or writes — only the server-side Supabase client is used for mutations. Client components that trigger actions do so via Next.js Server Actions.
