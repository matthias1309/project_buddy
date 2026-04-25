import { createClient } from "@/lib/supabase/server";
import { fetchAllTimesheetsForProjects } from "@/lib/supabase/paginate";
import { ProjectCard } from "@/components/dashboard/project-card";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { calcBudgetKPIs } from "@/lib/calculations/kpi-calculations";
import { calcScheduleKPIs } from "@/lib/calculations/kpi-calculations";
import { calcResourceKPIs } from "@/lib/calculations/kpi-calculations";
import { calcScopeKPIs } from "@/lib/calculations/kpi-calculations";
import { calcStabilityIndex } from "@/lib/calculations/stability-index";
import type {
  StabilityStatus,
  StabilityDimension,
  ProjectThresholds,
  JiraIssue,
  JiraSprint,
  OATimesheet,
  OAMilestone,
  OABudgetEntry,
} from "@/types/domain.types";

const DEFAULT_THRESHOLDS: ProjectThresholds = {
  budgetYellowPct: 15,
  budgetRedPct: 25,
  scheduleYellowDays: 5,
  scheduleRedDays: 15,
  resourceYellowPct: 85,
  resourceRedPct: 100,
  scopeYellowPct: 10,
  scopeRedPct: 20,
};

interface ProjectStability {
  status: StabilityStatus;
  criticalDimension: StabilityDimension | null;
  hint: string | null;
}

function buildHint(dimension: StabilityDimension, value: number): string {
  switch (dimension) {
    case "budget":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "schedule":
      return `${Math.round(value)} day delay`;
    case "resource":
      return `${value.toFixed(0)}% utilization`;
    case "scope":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)}% growth`;
  }
}

export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  const projectList = projects ?? [];

  if (projectList.length === 0) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <CreateProjectDialog />
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="mb-2 text-lg font-medium">No projects yet</p>
          <p className="mb-6 text-sm text-muted-foreground">
            Create your first project to get started.
          </p>
          <CreateProjectDialog label="Create First Project" />
        </div>
      </div>
    );
  }

  const projectIds = projectList.map((p) => p.id);

  // Batch-load all data for all projects in parallel
  const [
    { data: importLogs },
    { data: rawIssues },
    { data: rawSprints },
    rawTimesheets,
    { data: rawMilestones },
    { data: rawBudget },
    { data: rawThresholds },
  ] = await Promise.all([
    supabase
      .from("import_logs")
      .select("project_id, imported_at")
      .in("project_id", projectIds)
      .order("imported_at", { ascending: false }),
    supabase.from("jira_issues").select("*").in("project_id", projectIds),
    supabase.from("jira_sprints").select("*").in("project_id", projectIds),
    fetchAllTimesheetsForProjects(supabase, projectIds),
    supabase.from("oa_milestones").select("*").in("project_id", projectIds),
    supabase.from("oa_budget_entries").select("*").in("project_id", projectIds),
    supabase
      .from("project_thresholds")
      .select("*")
      .in("project_id", projectIds),
  ]);

  // Last import date per project
  const latestImportByProject: Record<string, string> = {};
  for (const log of importLogs ?? []) {
    if (!latestImportByProject[log.project_id]) {
      latestImportByProject[log.project_id] = log.imported_at;
    }
  }

  // Group all DB rows by project_id
  const issuesByProject = groupBy(rawIssues ?? [], "project_id");
  const sprintsByProject = groupBy(rawSprints ?? [], "project_id");
  const timesheetsByProject = groupBy(rawTimesheets, "project_id");

  // Current-month hours per project (null = no OA import at all → show "—")
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyHoursByProject: Record<string, number | null> = {};
  for (const project of projectList) {
    const pid = project.id;
    const sheets = timesheetsByProject[pid];
    if (!sheets || sheets.length === 0) {
      monthlyHoursByProject[pid] = null;
    } else {
      monthlyHoursByProject[pid] = sheets
        .filter((t) => typeof t.period_date === "string" && t.period_date.startsWith(monthPrefix))
        .reduce((sum, t) => sum + (t.booked_hours ?? 0), 0);
    }
  }
  const milestonesByProject = groupBy(rawMilestones ?? [], "project_id");
  const budgetByProject = groupBy(rawBudget ?? [], "project_id");
  const thresholdsByProject: Record<string, NonNullable<typeof rawThresholds>[number]> = {};
  for (const t of rawThresholds ?? []) {
    thresholdsByProject[t.project_id] = t;
  }

  // Compute stability per project
  const stabilityByProject: Record<string, ProjectStability> = {};
  for (const project of projectList) {
    const pid = project.id;

    const hasData =
      (issuesByProject[pid]?.length ?? 0) +
        (timesheetsByProject[pid]?.length ?? 0) +
        (milestonesByProject[pid]?.length ?? 0) +
        (budgetByProject[pid]?.length ?? 0) >
      0;

    if (!hasData) {
      stabilityByProject[pid] = {
        status: "none",
        criticalDimension: null,
        hint: null,
      };
      continue;
    }

    const issues: JiraIssue[] = (issuesByProject[pid] ?? []).map((r) => ({
      issueKey: r.issue_key,
      summary: r.summary ?? undefined,
      issueType: r.issue_type ?? undefined,
      status: r.status ?? "",
      storyPoints: r.story_points ?? undefined,
      sprint: r.sprint ?? undefined,
      epic: r.epic ?? undefined,
      assignee: r.assignee ?? undefined,
      createdDate: r.created_date ? new Date(r.created_date) : undefined,
      resolvedDate: r.resolved_date ? new Date(r.resolved_date) : undefined,
    }));

    const sprints: JiraSprint[] = (sprintsByProject[pid] ?? []).map((r) => ({
      sprintName: r.sprint_name,
      state: r.state ?? undefined,
      startDate: r.start_date ? new Date(r.start_date) : undefined,
      endDate: r.end_date ? new Date(r.end_date) : undefined,
      completedPoints: r.completed_points ?? undefined,
      plannedPoints: r.planned_points ?? undefined,
    }));

    const timesheets: OATimesheet[] = (timesheetsByProject[pid] ?? []).map(
      (r) => ({
        employeeName: r.employee_name ?? undefined,
        role: r.role ?? undefined,
        phase: r.phase ?? undefined,
        plannedHours: r.planned_hours ?? undefined,
        bookedHours: r.booked_hours ?? undefined,
        periodDate: r.period_date ? new Date(r.period_date) : undefined,
      })
    );

    const milestones: OAMilestone[] = (milestonesByProject[pid] ?? []).map(
      (r) => ({
        name: r.name,
        plannedDate: r.planned_date ? new Date(r.planned_date) : undefined,
        actualDate: r.actual_date ? new Date(r.actual_date) : undefined,
        status: r.status ?? undefined,
      })
    );

    const budgetEntries: OABudgetEntry[] = (budgetByProject[pid] ?? []).map(
      (r) => ({
        category: r.category ?? undefined,
        plannedEur: r.planned_eur ?? undefined,
        actualEur: r.actual_eur ?? undefined,
        periodDate: r.period_date ? new Date(r.period_date) : undefined,
      })
    );

    const rawT = thresholdsByProject[pid];
    const thresholds: ProjectThresholds = rawT
      ? {
          budgetYellowPct: rawT.budget_yellow_pct,
          budgetRedPct: rawT.budget_red_pct,
          scheduleYellowDays: rawT.schedule_yellow_days,
          scheduleRedDays: rawT.schedule_red_days,
          resourceYellowPct: rawT.resource_yellow_pct,
          resourceRedPct: rawT.resource_red_pct,
          scopeYellowPct: rawT.scope_yellow_pct,
          scopeRedPct: rawT.scope_red_pct,
        }
      : DEFAULT_THRESHOLDS;

    const budgetKPIs = calcBudgetKPIs(budgetEntries, project.total_budget_eur);
    const scheduleKPIs = calcScheduleKPIs(milestones);
    const resourceKPIs = calcResourceKPIs(timesheets);
    const scopeKPIs = calcScopeKPIs(issues, sprints);
    const stability = calcStabilityIndex(
      {
        budget: budgetKPIs,
        schedule: scheduleKPIs,
        resource: resourceKPIs,
        scope: scopeKPIs,
      },
      thresholds
    );

    // Find most critical dimension (prefer red over yellow)
    const redDim = stability.dimensions.find((d) => d.status === "red");
    const yellowDim = stability.dimensions.find((d) => d.status === "yellow");
    const critDim = redDim ?? yellowDim ?? null;

    stabilityByProject[pid] = {
      status: stability.status,
      criticalDimension: critDim
        ? (critDim.dimension as StabilityDimension)
        : null,
      hint: critDim ? buildHint(critDim.dimension as StabilityDimension, critDim.value) : null,
    };
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <CreateProjectDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projectList.map((project) => {
          const s = stabilityByProject[project.id];
          return (
            <ProjectCard
              key={project.id}
              project={project}
              lastImportedAt={latestImportByProject[project.id] ?? null}
              stabilityStatus={s.status}
              criticalDimension={s.criticalDimension}
              hint={s.hint}
              monthlyHours={monthlyHoursByProject[project.id] ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}

function groupBy<T extends Record<string, unknown>>(
  items: T[],
  key: keyof T
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const k = String(item[key]);
    (result[k] ??= []).push(item);
  }
  return result;
}
