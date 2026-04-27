# ADR-006: E2E Test Isolation Strategy for Supabase SSR Sessions

**Status:** Accepted  
**Date:** 2026-04-27

## Context

The project uses Playwright for end-to-end tests. The Next.js App Router uses `@supabase/ssr` for server-side session management, which has two behaviours that conflict with standard Playwright test patterns:

1. **Refresh token rotation.** Every time `supabase.auth.getUser()` is called server-side and the access token is near expiry, Supabase issues a new access+refresh token pair and marks the old refresh token as permanently invalid. The new tokens are set as cookies in the HTTP response.

2. **Cookie write restriction.** Next.js 14 prohibits setting cookies during Server Component rendering. The `@supabase/ssr` client's `setAll` callback throws `"Cookies can only be modified in a Server Action or Route Handler"` when called from a Server Component. Middleware is the intended place for session refresh in the App Router.

### Problem 1: Token rotation across test contexts

Playwright's default behaviour creates a **new browser context** for each test (even within `test.describe.serial`). Each new context is initialised from the static `e2e/.auth/user.json` file captured at setup time.

When test N triggers a server-side `getUser()` that rotates the refresh token, the new token lands in test N's browser context. Test N+1 starts a fresh context from the old `user.json` — Supabase rejects the already-rotated refresh token and returns `null` for `getUser()`, causing the middleware to redirect to `/login`.

### Problem 2: Cross-file session invalidation

`supabase.auth.signOut()` (default `scope: "global"`) sends a server-side API call that invalidates the session for all devices. With `workers: 2`, `auth.spec.ts` (which has a logout test) and `project-flow.spec.ts` can run in parallel. The global signout in `auth.spec.ts` invalidates the session used by `project-flow.spec.ts` mid-run.

### Problem 3: Server Component cookie write error

Without a guard, `supabase.auth.getUser()` in a Server Component throws when it tries to write refreshed tokens, crashing the page with an unhandled runtime error.

## Decision

Three complementary changes were made:

**1. Shared browser context within serial test groups (`e2e/*.spec.ts`)**  
Each `test.describe.serial` group creates one browser context in `beforeAll` (initialised from `user.json`) and shares a single `page` across all tests. Token rotations that occur during the run are preserved in the shared context; no test re-reads the stale `user.json`.

```typescript
test.describe.serial("flow", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    page = await ctx.newPage();
  });
  test.afterAll(() => page.context().close());
});
```

**2. `workers: 1` in `playwright.config.ts`**  
Ensures spec files run sequentially in a single worker. This prevents `auth.spec.ts` and `project-flow.spec.ts` from running simultaneously and competing on the same Supabase user session.

**3. `scope: "local"` for `supabase.auth.signOut()`**  
Changed in `lib/actions/auth.actions.ts`. Local signout deletes only the browser's own session cookies without making a server-side API call, so no other active session is invalidated. This is also the semantically correct behaviour for a "sign out of this browser" action.

**4. `try/catch` in `setAll` of the Server Component Supabase client**  
Changed in `lib/supabase/server.ts`. The middleware handles session refresh on every request and writes the new tokens to the response. The Server Component client's `setAll` is therefore redundant and safe to silence. Swallowing the error here prevents the "Cookies can only be modified in a Server Action or Route Handler" crash while keeping the middleware as the authoritative refresh mechanism.

## Consequences

**Positive:**
- E2E tests are stable across all user flows regardless of token rotation timing
- No test-credential management overhead — a single `user.json` suffices
- The `scope: "local"` logout is correct product behaviour for a single-device sign-out

**Negative:**
- `workers: 1` means the E2E suite is strictly sequential; total runtime grows linearly with the number of spec files. Acceptable for the current suite size (~40 tests, ~30 s)
- If the `user.json` session expires between the `auth.setup` run and the first test (> 1 hour gap), all tests fail. Re-running `npx playwright test --project=setup` regenerates the file
- `scope: "local"` means a compromised session is not revoked on all devices. A "sign out everywhere" feature would require a separate server action using `scope: "global"`
