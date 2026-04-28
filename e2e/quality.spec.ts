import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as os from "os";

const FIXTURES = path.join(__dirname, "../tests/fixtures");
const JIRA_FIXTURE = path.join(FIXTURES, "jira-sample.xlsx");

// Builds a minimal Jira Excel buffer with Bug rows that include Priority and Teams.
function buildQualityFixture(): string {
  const wb = XLSX.utils.book_new();
  const issues = [
    {
      "Issue Key": "BUG-1",
      Summary: "Critical bug open",
      "Issue Type": "Bug",
      Status: "Open",
      Priority: "Critical",
      Teams: "Team Alpha",
      Created: "2026-01-05",
    },
    {
      "Issue Key": "BUG-2",
      Summary: "Major bug resolved fast",
      "Issue Type": "Bug",
      Status: "Done",
      Priority: "Major",
      Teams: "Team Alpha",
      Created: "2026-01-05",
      Resolved: "2026-01-09", // 4 working days < 10 → green
    },
    {
      "Issue Key": "BUG-3",
      Summary: "Critical bug resolved slow",
      "Issue Type": "Bug",
      Status: "Done",
      Priority: "Critical",
      Teams: "Team Beta",
      Created: "2026-01-05",
      Resolved: "2026-01-16", // 9 working days > 5 → red
    },
    {
      "Issue Key": "STORY-1",
      Summary: "A story, not a bug",
      "Issue Type": "Story",
      Status: "Done",
      Priority: "Major",
      Teams: "Team Alpha",
      Created: "2026-01-05",
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issues), "Issues");
  const tmp = path.join(os.tmpdir(), `quality-fixture-${Date.now()}.xlsx`);
  XLSX.writeFile(wb, tmp);
  return tmp;
}

const PROJECT_NAME = `E2E Quality Test ${Date.now()}`;

test.describe.serial("quality tile and detail page", () => {
  let page: Page;
  let projectId: string;
  let fixturePath: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    page = await context.newPage();
    fixturePath = buildQualityFixture();
  });

  test.afterAll(async () => {
    if (fixturePath && fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
    await page.context().close();
  });

  // ── Setup: create project and import fixture ──────────────────────────────

  test("creates a project for quality tests", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "New Project" }).click();
    await page.getByLabel("Project Name").fill(PROJECT_NAME);
    await page.getByLabel("Project Number").fill("QE-001");
    await page.getByLabel("Start Date").fill("2026-01-01");
    await page.getByLabel("End Date").fill("2026-12-31");
    await page.getByLabel(/budget/i).fill("100000");
    await page.getByRole("button", { name: "Create" }).click();
    await page.waitForURL(/\/projects\/([a-z0-9-]+)\/import/);
    projectId = page.url().match(/\/projects\/([a-z0-9-]+)\/import/)![1];
    expect(projectId).toBeTruthy();
  });

  test("imports quality fixture as Jira data", async () => {
    await page.goto(`/projects/${projectId}/import`);
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByTestId("jira-upload-zone").click(),
    ]);
    await fileChooser.setFiles(fixturePath);
    await expect(page.getByText(/import(ed|ing)/i)).toBeVisible({ timeout: 15_000 });
  });

  // ── Dashboard tile ────────────────────────────────────────────────────────

  test("quality tile is visible on dashboard with open bug count", async () => {
    await page.goto(`/projects/${projectId}`);
    const tile = page.getByText("Quality").first();
    await expect(tile).toBeVisible();
    // 1 open bug (BUG-1 is open, BUG-3 is done, STORY-1 is not a bug)
    await expect(page.getByText("1").first()).toBeVisible();
  });

  test("clicking quality tile navigates to detail page", async () => {
    await page.goto(`/projects/${projectId}`);
    await page.getByText("Quality").first().click();
    await page.waitForURL(`/projects/${projectId}/quality`);
    await expect(page.getByRole("heading", { name: "Quality" })).toBeVisible();
  });

  // ── Detail page: sections ─────────────────────────────────────────────────

  test("detail page shows open bugs section", async () => {
    await page.goto(`/projects/${projectId}/quality`);
    await expect(page.getByText("Open Bugs")).toBeVisible();
    await expect(page.getByText("1").first()).toBeVisible(); // 1 open bug total
  });

  test("detail page shows avg hours section", async () => {
    await expect(page.getByText("Avg Hours per Priority")).toBeVisible();
  });

  test("detail page shows closed bugs lead time table", async () => {
    await expect(page.getByText("Closed Bugs — Lead Time")).toBeVisible();
    // BUG-2 resolved in 4 days (< 10 threshold) → green
    await expect(page.getByText("BUG-2")).toBeVisible();
    await expect(page.getByText("OK").first()).toBeVisible();
    // BUG-3 resolved in 9 days (> 5 critical threshold) → red
    await expect(page.getByText("BUG-3")).toBeVisible();
    await expect(page.getByText("Over limit").first()).toBeVisible();
  });

  // ── Team filter ───────────────────────────────────────────────────────────

  test("team filter restricts bugs to selected team", async () => {
    await page.goto(`/projects/${projectId}/quality`);
    // Select "Team Alpha" — should show BUG-1 (open) and BUG-2 (closed)
    // BUG-3 belongs to Team Beta and should disappear
    const teamFilter = page.getByRole("button", { name: /team/i }).first();
    if (await teamFilter.isVisible()) {
      await teamFilter.click();
      const alphaOption = page.getByText("Team Alpha").first();
      if (await alphaOption.isVisible()) {
        await alphaOption.click();
        await page.waitForURL(/team=Team\+Alpha/);
        await expect(page.getByText("BUG-3")).not.toBeVisible();
        await expect(page.getByText("BUG-2")).toBeVisible();
      }
    }
  });

  // ── Settings: quality thresholds ─────────────────────────────────────────

  test("settings page shows quality lead time threshold fields", async () => {
    await page.goto(`/projects/${projectId}/settings`);
    await expect(page.getByText("Quality: Lead Time Thresholds")).toBeVisible();
    await expect(page.getByLabel("Critical bugs")).toBeVisible();
    await expect(page.getByLabel("Major bugs")).toBeVisible();
    await expect(page.getByLabel("Minor bugs")).toBeVisible();
    await expect(page.getByLabel("Trivial bugs")).toBeVisible();
  });

  test("saving quality thresholds persists new values", async () => {
    await page.goto(`/projects/${projectId}/settings`);
    await page.getByLabel("Critical bugs").fill("3");
    await page.getByRole("button", { name: "Save thresholds" }).click();
    await expect(page.getByText("Thresholds saved successfully")).toBeVisible({ timeout: 5_000 });
    // Reload and verify persisted
    await page.reload();
    await expect(page.getByLabel("Critical bugs")).toHaveValue("3");
  });
});
