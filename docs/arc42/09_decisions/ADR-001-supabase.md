# ADR-001: Use Supabase Instead of a Custom Backend

**Status:** Accepted  
**Date:** 2024-01-01

## Context

The PM-Dashboard requires a persistent database, user authentication, and row-level access control. The team evaluated three options:

1. **Custom backend** — Node.js/Express API with a self-hosted PostgreSQL database, implementing auth and authorisation from scratch
2. **Supabase** — Managed PostgreSQL with built-in Auth, Row Level Security, and a JavaScript client
3. **Firebase** — Google-managed NoSQL database with auth

The project has a small initial team and a tight MVP timeline. Auth and authorisation are not differentiating features; they are table stakes.

## Decision

Use **Supabase** for the database, authentication, and row-level security.

## Rationale

- **Auth is ready out of the box.** Supabase Auth supports email/password login, session cookies (via `@supabase/ssr`), and integrates seamlessly with Next.js Server Components — no custom JWT logic needed.
- **Row Level Security is a first-class citizen.** PostgreSQL RLS lets the database enforce access control at the query level. This provides a security boundary independent of application code — a bug in the app layer cannot expose cross-user data.
- **SQL is the right model.** The KPI aggregations (group by role, sum hours, etc.) are relational queries. Supabase/PostgreSQL handles these natively without mapping logic.
- **Type generation.** Supabase CLI generates TypeScript types from the schema, keeping the application types in sync with the database without manual maintenance.
- **Firebase rejected** because its NoSQL model is a poor fit for relational aggregations and Supabase's RLS is more explicit and auditable than Firebase Security Rules.

## Consequences

**Positive:**
- Auth, sessions, and RLS are production-ready from day one
- No backend service to maintain; the Next.js app is the only deployment unit (besides Supabase)
- Easy path to Supabase Self-Hosted for intranet-only deployments

**Negative:**
- Vendor dependency on Supabase; migrating to a different database later requires re-implementing RLS policies and auth in a custom layer
- Supabase free tier has connection limits; a connection pool (e.g. PgBouncer) may be needed at scale
