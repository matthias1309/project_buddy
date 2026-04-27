import { test, expect, Page } from "@playwright/test";

const ERR_INVALID_RANGE = "Red threshold must be stricter than yellow threshold.";

test.describe.serial("threshold settings (FEAT-007)", () => {
  let page: Page;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    page = await context.newPage();

    // Create a dedicated project for settings tests
    await page.goto("/");
    await page.getByRole("button", { name: "New Project" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.fill('input[name="name"]', `Settings Test ${Date.now()}`);
    await page.fill('input[name="project_number"]', "SET-001");
    await page.fill('input[name="start_date"]', "2024-01-01");
    await page.fill('input[name="end_date"]', "2024-12-31");
    await page.fill('input[name="total_budget_eur"]', "80000");
    await page.getByRole("button", { name: "Create Project" }).click();
    await page.waitForURL(/\/projects\/[^/]+\/import/, { timeout: 15_000 });
    const match = page.url().match(/\/projects\/([^/]+)\/import/);
    projectId = match![1];
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ───────────────────────────────────────────────────────────
  // 1. Page load
  // ───────────────────────────────────────────────────────────

  test("settings page loads with project heading and default threshold values", async () => {
    await page.goto(`/projects/${projectId}/settings`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save thresholds" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset to defaults" })).toBeVisible();

    // Default values pre-filled (budget yellow = 15, budget red = 25)
    await expect(page.locator("#budget_yellow_pct")).toHaveValue("15");
    await expect(page.locator("#budget_red_pct")).toHaveValue("25");
    await expect(page.locator("#schedule_yellow_days")).toHaveValue("5");
    await expect(page.locator("#schedule_red_days")).toHaveValue("15");
    await expect(page.locator("#resource_yellow_pct")).toHaveValue("85");
    await expect(page.locator("#resource_red_pct")).toHaveValue("100");
    await expect(page.locator("#scope_yellow_pct")).toHaveValue("10");
    await expect(page.locator("#scope_red_pct")).toHaveValue("20");
  });

  // ───────────────────────────────────────────────────────────
  // 2. Happy path: save custom values
  // ───────────────────────────────────────────────────────────

  test("saving custom thresholds shows success banner", async () => {
    await page.goto(`/projects/${projectId}/settings`);

    await page.locator("#budget_yellow_pct").fill("20");
    await page.locator("#budget_red_pct").fill("35");
    await page.getByRole("button", { name: "Save thresholds" }).click();

    await expect(page.getByText("Thresholds saved successfully.")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("custom threshold values persist after navigating away and back", async () => {
    // Navigate away and return to confirm the server persisted the values
    await page.goto(`/projects/${projectId}`);
    await page.goto(`/projects/${projectId}/settings`);

    await expect(page.locator("#budget_yellow_pct")).toHaveValue("20");
    await expect(page.locator("#budget_red_pct")).toHaveValue("35");
  });

  // ───────────────────────────────────────────────────────────
  // 3. Validation
  // ───────────────────────────────────────────────────────────

  test("shows validation error when red threshold is not stricter than yellow", async () => {
    await page.goto(`/projects/${projectId}/settings`);

    // Set yellow > red → violates the schema refine rule
    await page.locator("#budget_yellow_pct").fill("30");
    await page.locator("#budget_red_pct").fill("10");
    await page.getByRole("button", { name: "Save thresholds" }).click();

    await expect(page.getByText(ERR_INVALID_RANGE)).toBeVisible({ timeout: 10_000 });
    // Form should NOT show success banner on validation failure
    await expect(page.getByText("Thresholds saved successfully.")).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // 4. Reset to defaults
  // ───────────────────────────────────────────────────────────

  test("reset to defaults dialog appears and can be cancelled", async () => {
    await page.goto(`/projects/${projectId}/settings`);

    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Reset to default thresholds?")).toBeVisible();

    // Cancel returns to the form without any change
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("confirming reset restores default values", async () => {
    await page.goto(`/projects/${projectId}/settings`);

    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    // Dialog closes after successful reset
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });

    // Navigate away and back so the server-rendered defaults are loaded fresh
    await page.goto(`/projects/${projectId}`);
    await page.goto(`/projects/${projectId}/settings`);

    await expect(page.locator("#budget_yellow_pct")).toHaveValue("15");
    await expect(page.locator("#budget_red_pct")).toHaveValue("25");
    await expect(page.locator("#schedule_yellow_days")).toHaveValue("5");
    await expect(page.locator("#schedule_red_days")).toHaveValue("15");
  });

  // ───────────────────────────────────────────────────────────
  // 5. Navigation
  // ───────────────────────────────────────────────────────────

  test("'Back to dashboard' button navigates to the project dashboard", async () => {
    await page.goto(`/projects/${projectId}/settings`);
    await page.getByRole("link", { name: "Back to dashboard" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  });

  test("'Einstellungen' button on the dashboard links to the settings page", async () => {
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("link", { name: /Einstellungen/i }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/settings`));
  });
});
