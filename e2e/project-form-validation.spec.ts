import { test, expect, Page } from "@playwright/test";

// Shared helpers
const VALID = {
  name: "Validation Test Project",
  project_number: "VAL-001",
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  total_budget_eur: "50000",
} as const;

async function openDialog(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New Project" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillAll(page: Page, overrides: Partial<typeof VALID> = {}) {
  const values = { ...VALID, ...overrides };
  if (values.name !== undefined)
    await page.fill('input[name="name"]', values.name);
  if (values.project_number !== undefined)
    await page.fill('input[name="project_number"]', values.project_number);
  if (values.start_date !== undefined)
    await page.fill('input[name="start_date"]', values.start_date);
  if (values.end_date !== undefined)
    await page.fill('input[name="end_date"]', values.end_date);
  if (values.total_budget_eur !== undefined)
    await page.fill('input[name="total_budget_eur"]', values.total_budget_eur);
}

test.describe.serial("project creation form validation", () => {
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
  // 1. Dialog lifecycle
  // ───────────────────────────────────────────────────────────

  test("dialog opens on 'New Project' and closes on Cancel without redirecting", async () => {
    await openDialog(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page).toHaveURL("/");
  });

  // ───────────────────────────────────────────────────────────
  // 2. Required-field errors
  // ───────────────────────────────────────────────────────────

  test("shows error when name is missing", async () => {
    await openDialog(page);
    await fillAll(page, { name: "" });
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(page.getByText("Name is required")).toBeVisible({ timeout: 8_000 });
    // Dialog must stay open — no redirect happened
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("shows error when project number is missing", async () => {
    await openDialog(page);
    await fillAll(page, { project_number: "" });
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(page.getByText("Project number is required")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("shows error when budget field is empty", async () => {
    await openDialog(page);
    await fillAll(page, { total_budget_eur: "" });
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(page.getByText("Budget must be greater than 0")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("submitting a completely empty form shows name and project number errors simultaneously", async () => {
    await openDialog(page);
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(page.getByText("Name is required")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText("Project number is required")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // 3. Date validation
  // ───────────────────────────────────────────────────────────

  test("shows error when end date is before start date", async () => {
    await openDialog(page);
    await fillAll(page, { start_date: "2024-12-31", end_date: "2024-01-01" });
    await page.getByRole("button", { name: "Create Project" }).click();

    await expect(
      page.getByText("End date must be on or after start date")
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("accepts equal start and end dates", async () => {
    await openDialog(page);
    await fillAll(page, { start_date: "2024-06-15", end_date: "2024-06-15" });
    await page.getByRole("button", { name: "Create Project" }).click();

    // No date error — redirect to import page signals success
    await page.waitForURL(/\/projects\/[^/]+\/import/, { timeout: 15_000 });
  });
});
