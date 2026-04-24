# Chapter 4: Solution Strategy

## Core Decisions

### 1. React Server Components as the primary data-loading pattern

All dashboard pages are React Server Components (RSC). They fetch data from Supabase on the server, compute KPIs, and render the full HTML before sending it to the browser. Client components (`"use client"`) are used only where interactivity is required (forms, file upload, charts).

**Consequences:**
- No loading spinners on the dashboard — data is ready before the page is painted
- No risk of leaking database credentials to the browser
- KPI calculations happen server-side, keeping the client bundle small
- Revalidation uses Next.js `router.refresh()` after mutations rather than client-side re-fetching

### 2. Supabase Row Level Security as the sole authorisation boundary

Every table in the database has RLS enabled. All policies follow one pattern: a user may only read or write rows that belong to projects they own (`auth.uid() = projects.owner_id`). The application layer does not implement a separate permission check for reads — the database enforces it.

**Consequences:**
- Even if a bug in the application exposes a query, the database rejects cross-user access
- Adding a new table requires adding RLS policies before any application code touches it
- The RLS pattern is extensible: future roles (PO, Programme Manager) require only additional policies, not schema changes

### 3. Pure functions for KPI calculations and stability logic

`lib/calculations/kpi-calculations.ts` and `lib/calculations/stability-index.ts` contain only pure functions. They accept plain data arrays and threshold values as input, return plain result objects, and have no side effects (no database calls, no date mutations).

**Consequences:**
- All calculation logic is independently testable without mocking Supabase
- The same functions run server-side during dashboard rendering and are reused wherever KPI data is needed
- Coverage targets of ≥ 95% for stability logic are achievable

### 4. Zod as the single validation library

Zod schemas are defined once and used at every validation boundary: form input in Server Actions, API route payloads, and Excel column mapping. The same schema that validates a form value also validates the parsed Excel row.

**Consequences:**
- Type inference from Zod eliminates duplicated TypeScript interface definitions for input shapes
- Validation error messages are centralised in `lib/errors.ts`; no hardcoded strings in components

### 5. Server-side-only Excel parsing

The `xlsx` (SheetJS) library is only imported in API routes (`app/api/.../route.ts`). It never appears in Server Components or client components. File uploads are sent as multipart form data directly to the API route, which receives the buffer, passes it to the parser, and writes the result to Supabase.

**Consequences:**
- The SheetJS binary does not appear in the client bundle
- The 10 MB file size limit is enforced at the API route level before parsing begins

## Technology Mapping

| Concern | Solution |
|---|---|
| UI components | shadcn/ui (pre-built accessible components) |
| Styling | Tailwind CSS utility classes |
| Charts | Recharts with `ResponsiveContainer` |
| Auth session | Supabase Auth via `@supabase/ssr` (cookie-based, SSR-compatible) |
| Server mutations | Next.js Server Actions (`"use server"`) |
| Form state | `useFormState` from `react-dom` (bound Server Actions) |
| Testing | Vitest (unit + integration), React Testing Library (critical components) |
| Deployment | Docker multi-stage build with `output: 'standalone'` |
