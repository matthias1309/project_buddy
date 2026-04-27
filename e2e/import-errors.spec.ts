import { test, expect, Page } from "@playwright/test";
import * as path from "path";

const FIXTURES = path.join(__dirname, "../tests/fixtures");

// Error strings from lib/errors.ts
const ERR_TOO_LARGE = "File exceeds the 10 MB limit.";
const ERR_WRONG_TYPE = "Only .xlsx and .xls files are accepted.";

test.describe.serial("import error handling", () => {
  let page: Page;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    page = await context.newPage();

    // Create a dedicated project so error tests don't pollute other projects
    await page.goto("/");
    await page.getByRole("button", { name: "New Project" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.fill('input[name="name"]', `Import Error Test ${Date.now()}`);
    await page.fill('input[name="project_number"]', "ERR-001");
    await page.fill('input[name="start_date"]', "2024-01-01");
    await page.fill('input[name="end_date"]', "2024-12-31");
    await page.fill('input[name="total_budget_eur"]', "50000");
    await page.getByRole("button", { name: "Create Project" }).click();
    await page.waitForURL(/\/projects\/[^/]+\/import/, { timeout: 15_000 });
    const match = page.url().match(/\/projects\/([^/]+)\/import/);
    projectId = match![1];
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ───────────────────────────────────────────────────────────
  // File validation errors (checked server-side before parsing)
  // ───────────────────────────────────────────────────────────

  test("rejects a Jira file exceeding 10 MB", async () => {
    await page.goto(`/projects/${projectId}/import`);
    const input = page
      .getByRole("button", { name: /Upload Jira Excel export/ })
      .locator('input[type="file"]');

    // 11 MB buffer named .xlsx so size check fires before extension check
    await input.setInputFiles({
      name: "oversize.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.alloc(11 * 1024 * 1024),
    });

    await expect(page.getByText(ERR_TOO_LARGE)).toBeVisible({ timeout: 10_000 });
  });

  test("rejects a non-Excel file type for Jira upload", async () => {
    await page.goto(`/projects/${projectId}/import`);
    const input = page
      .getByRole("button", { name: /Upload Jira Excel export/ })
      .locator('input[type="file"]');

    await input.setInputFiles({
      name: "data.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("issue_key,status\nJIRA-1,Open"),
    });

    await expect(page.getByText(ERR_WRONG_TYPE)).toBeVisible({ timeout: 10_000 });
  });

  test("rejects a non-Excel file type for OpenAir upload", async () => {
    await page.goto(`/projects/${projectId}/import`);
    const input = page
      .getByRole("button", { name: /Upload OpenAir Excel export/ })
      .locator('input[type="file"]');

    await input.setInputFiles({
      name: "report.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake content"),
    });

    await expect(page.getByText(ERR_WRONG_TYPE)).toBeVisible({ timeout: 10_000 });
  });

  // ───────────────────────────────────────────────────────────
  // Parse-level issues (API returns 200 with partial data)
  // ───────────────────────────────────────────────────────────

  test("Jira file with missing Issue Key — skips invalid row and shows record count", async () => {
    await page.goto(`/projects/${projectId}/import`);
    const input = page
      .getByRole("button", { name: /Upload Jira Excel export/ })
      .locator('input[type="file"]');

    await input.setInputFiles(path.join(FIXTURES, "jira-missing-key.xlsx"));

    // Partial import still succeeds: valid rows are imported, invalid row is skipped
    await expect(page.getByText(/\d+ records imported/)).toBeVisible({ timeout: 20_000 });
  });

  test("OpenAir partial file — imports successfully and shows budget warnings", async () => {
    await page.goto(`/projects/${projectId}/import`);
    const input = page
      .getByRole("button", { name: /Upload OpenAir Excel export/ })
      .locator('input[type="file"]');

    await input.setInputFiles(path.join(FIXTURES, "openair-partial.xlsx"));

    await expect(page.getByText(/\d+ records imported/)).toBeVisible({ timeout: 20_000 });
    // Missing budget fields produce amber warnings in the success state
    await expect(page.locator(".text-amber-600")).toBeVisible();
  });
});
