import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Database } from "@/types/database.types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ getAll: () => [], set: vi.fn() })),
}));

vi.mock("@/lib/supabase/paginate", () => ({
  fetchAllTimesheetsForProjects: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/dashboard/create-project-dialog", () => ({
  CreateProjectDialog: ({ label = "New Project" }: { label?: string }) => (
    <button>{label}</button>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { createClient } from "@/lib/supabase/server";
import { fetchAllTimesheetsForProjects } from "@/lib/supabase/paginate";
import ProjectsPage from "@/app/(dashboard)/page";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const mockUser = { id: "user-1", email: "pm@example.com" };

const baseProject: Project = {
  id: "proj-1",
  owner_id: "user-1",
  name: "Alpha Project",
  project_number: "PRJ-001",
  description: null,
  client: null,
  start_date: "2024-01-01",
  end_date: "2024-12-31",
  total_budget_eur: 100000,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function queryChain(data: unknown) {
  const promise = Promise.resolve({ data, error: null });
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] ?? null : data, error: null });
  chain.then = promise.then.bind(promise);
  chain.catch = promise.catch.bind(promise);
  chain.finally = promise.finally.bind(promise);
  return chain;
}

type BudgetEntryRow = { project_id: string; category?: string | null; planned_eur?: number | null; actual_eur?: number | null; period_date?: string | null };
type MilestoneRow = { project_id: string; name: string; planned_date?: string | null; actual_date?: string | null; status?: string | null };
type ThresholdRow = { project_id: string; budget_yellow_pct: number; budget_red_pct: number; schedule_yellow_days: number; schedule_red_days: number; resource_yellow_pct: number; resource_red_pct: number; scope_yellow_pct: number; scope_red_pct: number };
type TimesheetRow = { project_id: string; employee_name?: string | null; role?: string | null; phase?: string | null; planned_hours?: number | null; booked_hours?: number | null; period_date?: string | null };
type JiraIssueRow = { project_id: string; issue_key: string; status: string; story_points?: number | null; issue_type?: string | null; summary?: string | null; sprint?: string | null; epic?: string | null; assignee?: string | null; created_date?: string | null; resolved_date?: string | null };
type JiraSprintRow = { project_id: string; sprint_name: string; state?: string | null; start_date?: string | null; end_date?: string | null; completed_points?: number | null; planned_points?: number | null };

function setupClient({
  projects = [] as Project[],
  importLogs = [] as { project_id: string; imported_at: string }[],
  budgetEntries = [] as BudgetEntryRow[],
  milestones = [] as MilestoneRow[],
  thresholds = [] as ThresholdRow[],
  timesheets = [] as TimesheetRow[],
  jiraIssues = [] as JiraIssueRow[],
  jiraSprints = [] as JiraSprintRow[],
} = {}) {
  vi.mocked(fetchAllTimesheetsForProjects).mockResolvedValue(
    timesheets as unknown as Awaited<ReturnType<typeof fetchAllTimesheetsForProjects>>
  );
  vi.mocked(createClient).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "projects") return queryChain(projects);
      if (table === "import_logs") return queryChain(importLogs);
      if (table === "jira_issues") return queryChain(jiraIssues);
      if (table === "jira_sprints") return queryChain(jiraSprints);
      if (table === "oa_milestones") return queryChain(milestones);
      if (table === "oa_budget_entries") return queryChain(budgetEntries);
      if (table === "project_thresholds") return queryChain(thresholds);
      return queryChain([]);
    }),
  } as unknown as ReturnType<typeof createClient>);
}

describe("ProjectsPage — FEAT-002 project list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a card for each project the user owns", async () => {
    setupClient({
      projects: [
        baseProject,
        { ...baseProject, id: "proj-2", name: "Beta Project" },
      ],
    });

    render(await ProjectsPage());

    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("Beta Project")).toBeInTheDocument();
  });

  it("shows the last import date when import logs exist", async () => {
    setupClient({
      projects: [baseProject],
      importLogs: [
        { project_id: "proj-1", imported_at: "2024-06-15T10:00:00Z" },
      ],
    });

    render(await ProjectsPage());

    expect(screen.getByText(/Last import:/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 2024/)).toBeInTheDocument();
  });

  it('shows "No data imported yet" when a project has no import logs', async () => {
    setupClient({ projects: [baseProject], importLogs: [] });

    render(await ProjectsPage());

    expect(screen.getByText("No data imported yet")).toBeInTheDocument();
  });

  it('shows "New Project" button in the header regardless of project count', async () => {
    setupClient({ projects: [baseProject] });

    render(await ProjectsPage());

    expect(
      screen.getByRole("button", { name: "New Project" })
    ).toBeInTheDocument();
  });
});

describe("ProjectsPage — stability calculation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a budget hint when the budget dimension is red", async () => {
    setupClient({
      projects: [baseProject],
      // planned=50 000, actual=80 000 → differencePct=60 % > red threshold 25 % → RED
      budgetEntries: [
        { project_id: "proj-1", category: "Personnel", planned_eur: 50000, actual_eur: 80000, period_date: null },
      ],
    });
    render(await ProjectsPage());
    expect(screen.getByText("+60.0%")).toBeInTheDocument();
    expect(screen.getByText(/Budget:/)).toBeInTheDocument();
  });

  it("shows no hint when all dimensions are green", async () => {
    setupClient({
      projects: [baseProject],
      // 1 % over budget → well below yellow threshold → all green → critDim = null
      budgetEntries: [
        { project_id: "proj-1", category: "Personnel", planned_eur: 100000, actual_eur: 101000, period_date: null },
      ],
    });
    render(await ProjectsPage());
    expect(screen.queryByText(/Budget:/)).not.toBeInTheDocument();
  });

  it("applies custom thresholds when the project has threshold settings", async () => {
    setupClient({
      projects: [baseProject],
      // 20 % over — yellow with default thresholds, RED with tighter custom thresholds
      budgetEntries: [
        { project_id: "proj-1", category: "Personnel", planned_eur: 50000, actual_eur: 60000, period_date: null },
      ],
      thresholds: [
        {
          project_id: "proj-1",
          budget_yellow_pct: 5,
          budget_red_pct: 10,
          schedule_yellow_days: 5,
          schedule_red_days: 15,
          resource_yellow_pct: 85,
          resource_red_pct: 100,
          scope_yellow_pct: 10,
          scope_red_pct: 20,
        },
      ],
    });
    render(await ProjectsPage());
    expect(screen.getByText("+20.0%")).toBeInTheDocument();
  });

  it("shows a resource utilization hint when resources are overloaded", async () => {
    setupClient({
      projects: [baseProject],
      // planned=100 h, booked=150 h → 150 % utilisation > red threshold 100 % → RED
      timesheets: [
        { project_id: "proj-1", role: "Developer", planned_hours: 100, booked_hours: 150, period_date: "2024-01-31" },
      ],
    });
    render(await ProjectsPage());
    expect(screen.getByText(/% utilization/)).toBeInTheDocument();
  });

  it("shows a scope growth hint when story points exceed the sprint plan", async () => {
    setupClient({
      projects: [baseProject],
      // totalStoryPoints=70, plannedPoints=50 → scopeGrowthPct=40 % > red threshold 20 % → RED
      jiraIssues: [
        { project_id: "proj-1", issue_key: "PRJ-1", status: "open", story_points: 35 },
        { project_id: "proj-1", issue_key: "PRJ-2", status: "open", story_points: 35 },
      ],
      jiraSprints: [
        { project_id: "proj-1", sprint_name: "Sprint 1", planned_points: 50, completed_points: 0 },
      ],
    });
    render(await ProjectsPage());
    expect(screen.getByText(/% growth/)).toBeInTheDocument();
  });

  it("shows a schedule delay hint when a milestone is overdue", async () => {
    setupClient({
      projects: [baseProject],
      milestones: [
        {
          project_id: "proj-1",
          name: "Go-Live",
          planned_date: "2024-01-01",
          actual_date: "2024-03-15", // ~74 days late > schedule_red_days 15 → RED
          status: "completed",
        },
      ],
    });
    render(await ProjectsPage());
    expect(screen.getByText(/day delay/)).toBeInTheDocument();
  });
});

describe("ProjectsPage — FEAT-002 empty state", () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "No projects yet" heading when user has no projects', async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it('shows "Create First Project" button in the empty state', async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(
      screen.getByRole("button", { name: "Create First Project" })
    ).toBeInTheDocument();
  });

  it("does not render any project cards in the empty state", async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it('shows "New Project" button in the empty state too', async () => {
    setupClient({ projects: [] });

    render(await ProjectsPage());

    expect(
      screen.getByRole("button", { name: "New Project" })
    ).toBeInTheDocument();
  });
});
