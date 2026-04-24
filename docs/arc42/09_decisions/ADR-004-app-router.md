# ADR-004: Use Next.js App Router Instead of Pages Router

**Status:** Accepted  
**Date:** 2024-01-01

## Context

Next.js 14 supports two routing paradigms:

1. **Pages Router** — the original Next.js routing model (`/pages` directory, `getServerSideProps`, client-side data fetching patterns)
2. **App Router** — introduced in Next.js 13, uses the `/app` directory and React Server Components (RSC)

## Decision

Use the **App Router** (`/app` directory) exclusively. No Pages Router patterns.

## Rationale

- **React Server Components eliminate the data-fetching problem.** With RSC, the dashboard page fetches all data from Supabase directly in the component without `useEffect`, SWR, or a separate API route for reads. This reduces the round-trip count and removes loading-spinner boilerplate.
- **Server Actions simplify mutations.** Form submissions call a `"use server"` function directly instead of building a full REST endpoint for every write operation. This halves the amount of code needed for project creation and threshold updates.
- **Future-proof.** The App Router is Next.js's strategic direction. Pages Router is maintained but receives no new features. Starting on App Router avoids a migration later.
- **Better auth integration.** `@supabase/ssr` is designed for App Router and middleware-based session handling. The Pages Router equivalent (`@supabase/auth-helpers-nextjs`) is in maintenance mode.

## Consequences

**Positive:**
- Fewer abstraction layers between data and UI — Server Components fetch and render in one step
- Smaller client bundle — only components that need interactivity are client components
- `loading.tsx` and `error.tsx` conventions provide built-in Suspense and error boundary patterns

**Negative:**
- Server Components are async and cannot use React hooks — component boundaries must be planned (server for data, client for interaction)
- Mocking async Server Components in tests is complex; the convention is to test them after implementation rather than TDD (see `CLAUDE.md` section 4)
- The App Router ecosystem (third-party libraries, documentation) is less mature than Pages Router for some edge cases
