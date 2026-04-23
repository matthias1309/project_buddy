# PM Dashboard

An internal web application for project managers to consolidate delivery data from **Jira** and resource/budget data from **OpenAir** into a single, actionable dashboard with a traffic-light stability indicator.

---

## Overview

Project managers typically work across at least two separate tools — Jira for technical delivery tracking and OpenAir for time, budget, and resource planning. PM Dashboard bridges this gap by importing Excel exports from both systems, merging them into a unified data model, and aggregating the result into four stability dimensions with configurable alert thresholds.

The application runs on-premise (company intranet) and is not publicly accessible.

---

## Key Features (MVP)

| Feature | Description |
|---|---|
| Authentication | Email/password login via Supabase Auth, session persistence |
| Project management | Create and manage projects with master data |
| Jira import | Upload Jira Excel exports; parses issues and sprints |
| OpenAir import | Upload OpenAir Excel exports; parses timesheets, milestones, budget |
| Import log | Timestamp, filename, status, and error details per import |
| Project overview | All projects at a glance with stability traffic light |
| Project dashboard | Four KPI tiles: Budget, Schedule, Resources, Scope |
| Threshold configuration | Per-project yellow/red thresholds for all four dimensions |

---

## Stability Dimensions

The dashboard evaluates project health across four dimensions:

| Dimension | Primary Source | Key Indicators |
|---|---|---|
| **Budget** | OpenAir | Actual vs. planned (€), burn rate, EAC |
| **Schedule** | OpenAir + Jira | Milestone delay, sprint velocity trend |
| **Resources** | OpenAir | Utilisation % per role, overbooking risk |
| **Scope** | Jira | Story point delta, open change requests, bug rate |

An overall **Stability Index** (green / yellow / red) aggregates the four dimensions using configurable thresholds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript |
| UI components | shadcn/ui, Tailwind CSS |
| Charts | Recharts |
| Database / Auth | Supabase (PostgreSQL + Row Level Security) |
| Excel parsing | xlsx (SheetJS) — server-side via Next.js API Routes |
| Validation | Zod |
| Testing | Vitest, React Testing Library |
| Deployment | Docker (multi-stage), Intranet server |

---

## Project Structure

```
/app
  /(auth)/login              # Login page
  /(dashboard)
    /layout.tsx              # Auth guard + navigation
    /page.tsx                # Project overview
    /projects/[id]
      /page.tsx              # Project dashboard
      /import/page.tsx       # Import UI (Jira + OpenAir)
      /settings/page.tsx     # Threshold configuration
/components
  /ui                        # shadcn components (do not edit)
  /dashboard                 # Dashboard-specific components
  /import                    # Import components
  /shared                    # Reusable custom components
/lib
  /supabase                  # Supabase server + browser clients
  /parsers                   # jira-parser.ts, openair-parser.ts
  /calculations              # stability-index.ts, kpi-calculations.ts
  /validations               # Zod schemas
  /errors.ts                 # Centralised error definitions
/types
  /database.types.ts         # Supabase-generated types (do not edit manually)
  /domain.types.ts           # Business domain types
/supabase/migrations         # SQL migration files
/tests
  /fixtures                  # Synthetic Excel test files
/docs/arc42                  # Architecture documentation (arc42)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (cloud or self-hosted)

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in your Supabase credentials
cp .env.local.example .env.local

# Apply database migrations
npx supabase db push

# Generate synthetic test fixtures
npm run fixtures:generate

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

---

## Testing

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage
```

Coverage targets: Parser ≥ 90% · Calculations / stability logic ≥ 95% · API routes ≥ 80% · UI components ≥ 60%

---

## Deployment (Docker)

```bash
# Build the image
docker build -t pm-dashboard .

# Run with environment file
docker run -p 3000:3000 --env-file .env.production pm-dashboard

# Or with docker-compose
docker-compose up -d
```

A health check endpoint is available at `GET /api/health`.

> Supabase runs externally (Supabase Cloud or a separate self-hosted instance). See the [Supabase self-hosting guide](https://supabase.com/docs/guides/self-hosting/docker) for an on-premise setup.

---

## Architecture

Architecture documentation follows the [arc42](https://arc42.org) template and lives in [`/docs/arc42/`](docs/arc42/). Key architecture decisions (ADRs):

| ADR | Decision |
|---|---|
| ADR-001 | Supabase instead of a custom backend (speed, Auth, RLS out of the box) |
| ADR-002 | Excel import instead of direct API integration (MVP pragmatism, no API credentials needed) |
| ADR-003 | shadcn/ui instead of a custom design system (productivity, consistency) |
| ADR-004 | Next.js 14 App Router instead of Pages Router (future-proof, Server Components) |

---

## Roadmap

### Phase 2
- Role-based access (Product Owner, Programme Manager, Consultant)
- Import history with trend analysis
- Email notifications on threshold breaches
- Dashboard PDF export

### Phase 3
- Direct Jira API integration
- Direct OpenAir API integration
- Per-project comments
- Multilingual support (DE / EN)

---

## Out of Scope

- Time tracking (use OpenAir directly)
- Ticket / task management (use Jira directly)
- Public access
- Native mobile app (responsive web is sufficient)
