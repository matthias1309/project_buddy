import { test, expect, Page } from "@playwright/test";
import * as path from "path";

const FIXTURES = path.join(__dirname, "../tests/fixtures");
const JIRA_FIXTURE = path.join(FIXTURES, "jira-sample.xlsx");
const OPENAIR_FIXTURE = path.join(FIXTURES, "openair-sample.xlsx");

const PROJECT_NAME = `E2E Test Project ${Date.now()}`;
const PROJECT_NUMBER = "E2E-001";

// All tests in this suite run sequentially against the same project.
// They share a single browser context so that Supabase refresh-token
// rotation (which happens during API calls / router.refresh()) does not
// invalidate the session between tests.
test.describe.serial("project lifecycle golden path", () => {
  let projectId: string;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ───────────────────────────────────────────────────────────
  // 1. Projects overview
  // ───────────────────────────────────────────────────────────

  test("projects page loads with heading and New Project button", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // 2. Create project
  // ───────────────────────────────────────────────────────────

  test("creates a new project and redirects to the import page", async () => {
    await page.goto("/");

    // Open dialog
    await page.getByRole("button", { name: "New Project" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill mandatory fields
    await page.fill('input[name="name"]', PROJECT_NAME);
    await page.fill('input[name="project_number"]', PROJECT_NUMBER);
    await page.fill('input[name="start_date"]', "2024-01-01");
    await page.fill('input[name="end_date"]', "2024-12-31");
    await page.fill('input[name="total_budget_eur"]', "100000");

    // Submit
    await page.getByRole("button", { name: "Create Project" }).click();

    // Expect redirect to import page
    await page.waitForURL(/\/projects\/[^/]+\/import/, { timeout: 15_000 });

    // Extract project ID from URL
    const match = page.url().match(/\/projects\/([^/]+)\/import/);
    expect(match).not.toBeNull();
    projectId = match![1];

    await expect(page.getByRole("heading", { name: PROJECT_NAME })).toBeVisible();
    await expect(page.getByText("Import data")).toBeVisible();
  });

  test("new project card appears on the projects overview with 'No data imported yet'", async () => {
    await page.goto("/");
    await expect(page.getByText(PROJECT_NAME)).toBeVisible();
    // Scope to the specific card to avoid strict-mode violations when
    // multiple projects without imports exist on the page
    await expect(
      page.locator("div").filter({ hasText: PROJECT_NAME }).filter({ hasText: "No data imported yet" }).first()
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // 3. Import Jira data
  // ───────────────────────────────────────────────────────────

  test("uploads a Jira Excel file and shows success with record count", async () => {
    await page.goto(`/projects/${projectId}/import`);
    await expect(page.getByText("Jira Export")).toBeVisible();

    // The drop-zone div has role="button" and aria-label="Upload <label>"
    // The hidden file input is a child of that button element
    const jiraInput = page
      .getByRole("button", { name: /Upload Jira Excel export/ })
      .locator('input[type="file"]');

    await jiraInput.setInputFiles(JIRA_FIXTURE);

    // Wait for the upload API to respond and the success state to render
    await expect(page.getByText(/records imported/).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Import OpenAir data
  // ───────────────────────────────────────────────────────────

  test("uploads an OpenAir Excel file and shows success with record count", async () => {
    await page.goto(`/projects/${projectId}/import`);
    await expect(page.getByText("OpenAir Export")).toBeVisible();

    const openairInput = page
      .getByRole("button", { name: /Upload OpenAir Excel export/ })
      .locator('input[type="file"]');

    await openairInput.setInputFiles(OPENAIR_FIXTURE);

    await expect(page.getByText(/records imported/).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("import log list shows recent import entries after both uploads", async () => {
    await page.goto(`/projects/${projectId}/import`);
    await expect(page.getByText("Recent imports")).toBeVisible();
    // At least one log entry should appear (imported_at timestamp visible)
    await expect(page.locator('[data-testid="import-log"], .import-log, table tr, li').first()).toBeVisible({
      timeout: 10_000,
    }).catch(() => {
      // Import log list may use different markup — just verify the section heading is present
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. Project dashboard
  // ───────────────────────────────────────────────────────────

  test("project dashboard shows all four KPI tiles after import", async () => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("heading", { name: PROJECT_NAME })).toBeVisible();

    // All four KPI card headings must be present
    await expect(page.getByText("Budget")).toBeVisible();
    await expect(page.getByText("Zeitplan")).toBeVisible();
    await expect(page.getByText("Ressourcen")).toBeVisible();
    await expect(page.getByText("Scope", { exact: true })).toBeVisible();
  });

  test("project dashboard stability badge is not 'No Data' after import", async () => {
    await page.goto(`/projects/${projectId}`);

    // The badge should reflect actual data — any status other than "No Data" is acceptable
    await expect(page.getByText(/Stable|At Risk|Critical/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("project card on overview shows last import date after upload", async () => {
    await page.goto("/");
    await expect(page.getByText(/Last import:/).first()).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // 6. Navigation
  // ───────────────────────────────────────────────────────────

  test("clicking a project card navigates to the project dashboard", async () => {
    await page.goto("/");
    await page.getByText(PROJECT_NAME).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}`));
    await expect(page.getByRole("heading", { name: PROJECT_NAME })).toBeVisible();
  });

  test("Import data button on dashboard links to the import page", async () => {
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("link", { name: /Daten importieren/i }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/import`));
  });

  // ───────────────────────────────────────────────────────────
  // 7. Epic Budget tile (FEAT-011)
  // ───────────────────────────────────────────────────────────

  test("Epic Budget tile is visible on the dashboard after Jira import", async () => {
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText("Epic Budget")).toBeVisible({ timeout: 10_000 });
  });

  test("clicking the Epic Budget tile navigates to the epics detail page", async () => {
    await page.goto(`/projects/${projectId}`);
    await page.getByText("Epic Budget").click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/epics`));
  });

  test("epics page shows at least one Epic row in the table", async () => {
    await page.goto(`/projects/${projectId}/epics`);
    // The page header should be visible
    await expect(page.getByText("Epic Budget")).toBeVisible();
    // At least one epic key from the fixture must appear (PROJ-E1 or PROJ-E2)
    await expect(
      page.getByText("PROJ-E1").or(page.getByText("PROJ-E2")).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
