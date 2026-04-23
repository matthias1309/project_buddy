# FEAT-001: Authentication

## User Story

**As a** project manager  
**I want to** sign in with my email and password  
**so that** only authorised users can access the dashboard.

---

## Background

The dashboard contains sensitive project and budget data. Access must be restricted to authenticated users. Authentication is handled entirely by Supabase Auth — no custom credential storage. The login page is the only public route; all other routes are protected by a middleware auth guard. Sessions persist across browser restarts using Supabase's default cookie-based session management.

---

## Acceptance Criteria

```gherkin
Feature: Authentication

  Scenario: Successful login
    Given the user is on the login page "/login"
    When the user enters a valid email and password
    And submits the form
    Then the user is redirected to the project overview "/"
    And a valid session cookie is set

  Scenario: Login with wrong credentials
    Given the user is on the login page "/login"
    When the user enters an invalid email or password
    And submits the form
    Then an error message is shown
    And the message does not reveal whether the email or password was wrong
    And the user remains on the login page

  Scenario: Auth guard — unauthenticated access
    Given the user is not logged in
    When the user navigates to any dashboard route (e.g. "/")
    Then the user is redirected to "/login"

  Scenario: Auth guard — authenticated access
    Given the user has a valid session
    When the user navigates to a dashboard route
    Then the page renders normally without redirect

  Scenario: Redirect away from login when already authenticated
    Given the user has a valid session
    When the user navigates to "/login"
    Then the user is redirected to "/"

  Scenario: Session persistence
    Given the user has logged in successfully
    When the user closes and reopens the browser
    Then the session is still active
    And the user does not need to log in again

  Scenario: Logout
    Given the user is logged in and on any dashboard page
    When the user clicks "Sign out" in the navigation
    Then the session is invalidated
    And the user is redirected to "/login"
    And the navigation no longer shows the user's email

  Scenario: Navigation shows current user
    Given the user is logged in
    When any dashboard page is displayed
    Then the navigation bar shows the user's email address
```

---

## Notes

- The login form uses a **Server Action** — no client-side Supabase calls. This keeps credentials off the client and aligns with the Next.js App Router pattern.
- Error messaging is intentionally generic (`"Invalid email or password"`) to avoid user enumeration.
- The **auth guard is implemented in `middleware.ts`** (not in individual page layouts) so it runs on the Edge before any rendering.
- The dashboard layout (`/app/(dashboard)/layout.tsx`) performs a secondary server-side session check and redirects if no session is found — this is a defence-in-depth measure alongside the middleware.
- Logout is a **Server Action** to ensure the session cookie is cleared server-side.
- Session storage uses Supabase's default cookie strategy via `@supabase/ssr`. No custom token handling is required.
