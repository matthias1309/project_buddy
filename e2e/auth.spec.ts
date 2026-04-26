import { test, expect } from "@playwright/test";

// All tests in this file start without any stored session
test.use({ storageState: { cookies: [], origins: [] } });

test("redirects unauthenticated user from / to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("redirects unauthenticated user from a project URL to /login", async ({ page }) => {
  await page.goto("/projects/nonexistent-id");
  await expect(page).toHaveURL(/\/login/);
});

test("login page is accessible and shows the Sign in button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("shows an error message for invalid credentials", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "wrong@example.com");
  await page.fill('input[name="password"]', "wrongpassword");
  await page.click('button[type="submit"]');

  // Stay on login page with an error
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("p.text-destructive, [role='alert']")).toBeVisible({ timeout: 10_000 });
});

test("successful login redirects to the projects dashboard", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, "E2E credentials not configured");

  await page.goto("/login");
  await page.fill('input[name="email"]', email!);
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');

  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});

test("authenticated user visiting /login is redirected to /", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, "E2E credentials not configured");

  // Log in first
  await page.goto("/login");
  await page.fill('input[name="email"]', email!);
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });

  // Navigating back to /login should redirect to /
  await page.goto("/login");
  await expect(page).toHaveURL("/");
});

test("logout returns user to /login", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  test.skip(!email || !password, "E2E credentials not configured");

  // Log in
  await page.goto("/login");
  await page.fill('input[name="email"]', email!);
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15_000 });

  // Logout via the Sign out button in the nav
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});
