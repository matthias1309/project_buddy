import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllTimesheets } from "@/lib/supabase/paginate";
import { calcBudgetKPIs } from "@/lib/calculations/kpi-calculations";
import { calcScheduleKPIs } from "@/lib/calculations/kpi-calculations";
import { calcResourceKPIs } from "@/lib/calculations/kpi-calculations";
import { calcScopeKPIs } from "@/lib/calculations/kpi-calculations";
import { calcStabilityIndex } from "@/lib/calculations/stability-index";
import { StabilityBadge } from "@/components/shared/stability-badge";
import { SprintFilter } from "@/components/shared/sprint-filter";
import { TeamFilter } from "@/components/shared/team-filter";
import { BudgetCard } from "@/components/dashboard/budget-card";
import { ScheduleCard } from "@/components/dashboard/schedule-card";
import { ResourceCard } from "@/components/dashboard/resource-card";
import { ScopeCard } from "@/components/dashboard/scope-card";
import { TimeAnalysisCard } from "@/components/dashboard/time-analysis-card";
import { Button } from "@/components/ui/button";
import type {
  JiraIssue,
  JiraSprint,
  OATimesheet,
  OAMilestone,
  OABudgetEntry,
  ProjectSprint,
  ProjectThresholds,
} from "@/types/domain.types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

const DEFAULT_THRESHOLDS: ProjectThresholds = {
  budgetYellowPct: 15,
  budgetRedPct: 25,
  scheduleYellowDays: 5,
  scheduleRedDays: 15,
  resourceYellowPct: 85,
  resourceRedPct: 100,
  scopeYellowPct: 10,
  scopeRedPct: 20,
  epicWarningMarginPct: 10,
};

interface Props {
  params: { id: string };
  searchParams: { sprint?: string | string[]; team?: string | string[] };
}

export default async function ProjectDashboardPage({ params, searchParams }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load all project data in parallel
  const [
    { data: project },
    { data: rawIssues },
    { data: rawSprints },
    rawTimesheets,
    { data: rawMilestones },
    { data: rawBudget },
    { data: rawThresholds },
    { data: rawLastOAImport },
    { data: rawProjectSprints },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, project_number, total_budget_eur")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single(),
    supabase.from("jira_issues").select("*").eq("project_id", params.id),
    supabase.from("jira_sprints").select("*").eq("project_id", params.id),
    fetchAllTimesheets(supabase, params.id),
    supabase.from("oa_milestones").select("*").eq("project_id", params.id),
    supabase.from("oa_budget_entries").select("*").eq("project_id", params.id),
    supabase
      .from("project_thresholds")
      .select("*")
      .eq("project_id", params.id)
      .single(),
    supabase
      .from("import_logs")
      .select("imported_at")
      .eq("project_id", params.id)
      .eq("source", "openair")
      .order("imported_at", { ascending: false })
      .limit(1),
    supabase
      .from("project_sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", params.id)
      .order("start_date", { ascending: true }),
  ]);

  if (!project) redirect("/");

  const allProjectSprints = (rawProjectSprints ?? []) as Pick<
    ProjectSprint,
    "id" | "name" | "start_date" | "end_date"
  >[];
  const selectedSprintNames: string[] = Array.isArray(searchParams.sprint)
    ? searchParams.sprint
    : searchParams.sprint
      ? [searchParams.sprint]
      : [];

  const hasData =
    (rawIssues?.length ?? 0) +
      rawTimesheets.length +
      (rawMilestones?.length ?? 0) +
      (rawBudget?.length ?? 0) >
    0;

  // Map DB rows to domain types
  const allIssues: JiraIssue[] = (rawIssues ?? []).map((r) => ({
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

  const issues: JiraIssue[] =
    selectedSprintNames.length > 0
      ? allIssues.filter(
          (issue) =>
            issue.sprint &&
            selectedSprintNames.some((name) => issue.sprint!.includes(name)),
        )
      : allIssues;

  const sprints: JiraSprint[] = (rawSprints ?? []).map((r) => ({
    sprintName: r.sprint_name,
    state: r.state ?? undefined,
    startDate: r.start_date ? new Date(r.start_date) : undefined,
    endDate: r.end_date ? new Date(r.end_date) : undefined,
    completedPoints: r.completed_points ?? undefined,
    plannedPoints: r.planned_points ?? undefined,
  }));

  const allTimesheets: OATimesheet[] = rawTimesheets.map((r) => ({
    employeeName: r.employee_name ?? undefined,
    role:         r.role ?? undefined,
    phase:        r.phase ?? undefined,
    plannedHours: r.planned_hours ?? undefined,
    bookedHours:  r.booked_hours ?? undefined,
    periodDate:   r.period_date ? new Date(r.period_date) : undefined,
    team:         r.team ?? undefined,
  }));

  const allTeams = [
    ...new Set(allTimesheets.map((t) => t.team).filter((t): t is string => !!t)),
  ].sort();

  const selectedTeamNames: string[] = Array.isArray(searchParams.team)
    ? searchParams.team
    : searchParams.team
      ? [searchParams.team]
      : [];

  const timesheets =
    selectedTeamNames.length > 0
      ? allTimesheets.filter((t) => t.team && selectedTeamNames.includes(t.team))
      : allTimesheets;

  // Time Analysis tile data
  const lastOARow = rawLastOAImport?.[0] ?? null;
  const lastImportDateStr = lastOARow
    ? new Date(lastOARow.imported_at).toLocaleDateString("de-DE")
    : null;
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthHours = lastOARow
    ? allTimesheets.reduce(
        (sum, t) => {
          if (!t.periodDate) return sum;
          const ym = `${t.periodDate.getFullYear()}-${String(t.periodDate.getMonth() + 1).padStart(2, "0")}`;
          if (ym !== currentYM) return sum;
          if (selectedTeamNames.length > 0 && (!t.team || !selectedTeamNames.includes(t.team))) return sum;
          return sum + (t.bookedHours ?? 0);
        },
        0,
      )
    : null;

  const milestones: OAMilestone[] = (rawMilestones ?? []).map((r) => ({
    name: r.name,
    plannedDate: r.planned_date ? new Date(r.planned_date) : undefined,
    actualDate: r.actual_date ? new Date(r.actual_date) : undefined,
    status: r.status ?? undefined,
  }));

  const budgetEntries: OABudgetEntry[] = (rawBudget ?? []).map((r) => ({
    category: r.category ?? undefined,
    plannedEur: r.planned_eur ?? undefined,
    actualEur: r.actual_eur ?? undefined,
    periodDate: r.period_date ? new Date(r.period_date) : undefined,
  }));

  const thresholds: ProjectThresholds = rawThresholds
    ? {
        budgetYellowPct: rawThresholds.budget_yellow_pct,
        budgetRedPct: rawThresholds.budget_red_pct,
        scheduleYellowDays: rawThresholds.schedule_yellow_days,
        scheduleRedDays: rawThresholds.schedule_red_days,
        resourceYellowPct: rawThresholds.resource_yellow_pct,
        resourceRedPct: rawThresholds.resource_red_pct,
        scopeYellowPct: rawThresholds.scope_yellow_pct,
        scopeRedPct: rawThresholds.scope_red_pct,
        epicWarningMarginPct: rawThresholds.epic_warning_margin_pct ?? 10,
      }
    : DEFAULT_THRESHOLDS;

  // Compute KPIs server-side
  const budgetKPIs = calcBudgetKPIs(budgetEntries, project.total_budget_eur);
  const scheduleKPIs = calcScheduleKPIs(milestones);
  const resourceKPIs = calcResourceKPIs(timesheets);
  const scopeKPIs = calcScopeKPIs(issues, sprints);
  const stability = calcStabilityIndex(
    { budget: budgetKPIs, schedule: scheduleKPIs, resource: resourceKPIs, scope: scopeKPIs },
    thresholds,
  );

  const dim = (name: string) =>
    stability.dimensions.find((d) => d.dimension === name)!;

  // Pre-compute serialisable props for ScheduleCard
  const delayedMilestones = milestones
    .filter(
      (m) => m.actualDate && m.plannedDate && m.actualDate > m.plannedDate,
    )
    .map((m) => ({
      name: m.name,
      delayDays: daysBetween(m.plannedDate!, m.actualDate!),
    }))
    .sort((a, b) => b.delayDays - a.delayDays)
    .slice(0, 3);

  const nextMs = scheduleKPIs.nextMilestone;
  const nextMilestone = nextMs
    ? {
        name: nextMs.name,
        plannedDateStr: nextMs.plannedDate
          ? nextMs.plannedDate.toLocaleDateString("de-DE")
          : null,
        delayDays:
          nextMs.actualDate && nextMs.plannedDate && nextMs.actualDate > nextMs.plannedDate
            ? daysBetween(nextMs.plannedDate, nextMs.actualDate)
            : 0,
      }
    : null;

  const statusBreakdown = {
    completed: milestones.filter((m) => m.status === "completed").length,
    delayed: delayedMilestones.length,
    planned: milestones.filter(
      (m) =>
        m.status !== "completed" &&
        !(m.actualDate && m.plannedDate && m.actualDate > m.plannedDate),
    ).length,
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {project.project_number ?? params.id}
          </p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Score {stability.score}
            </span>
            <StabilityBadge status={stability.status} />
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/projects/${params.id}/import`}>
              <Button variant="outline" size="sm">
                Daten importieren
              </Button>
            </Link>
            <Link href={`/projects/${params.id}/settings`}>
              <Button variant="outline" size="sm">
                Einstellungen
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* No data state for KPI tiles */}
      {!hasData && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">
            Noch keine Daten vorhanden.{" "}
            <Link
              href={`/projects/${params.id}/import`}
              className="text-primary underline underline-offset-2"
            >
              Daten importieren um zu starten
            </Link>
            .
          </p>
        </div>
      )}

      {/* Filter bar — only shown when data exists */}
      {hasData && (allProjectSprints.length > 0 || allTeams.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {allProjectSprints.length > 0 && (
            <SprintFilter sprints={allProjectSprints} />
          )}
          {allTeams.length > 0 && (
            <TeamFilter teams={allTeams} />
          )}
        </div>
      )}

      {/* Tile grid — KPI cards only when data exists, Time Analysis always */}
      <div className="grid gap-6 md:grid-cols-2">
        {hasData && (
          <>
            <BudgetCard
              plannedEur={budgetKPIs.plannedEur}
              actualEur={budgetKPIs.actualEur}
              differenceEur={budgetKPIs.differenceEur}
              differencePct={budgetKPIs.differencePct}
              burnRate={budgetKPIs.burnRate}
              status={dim("budget").status}
            />

            <ScheduleCard
              totalMilestones={scheduleKPIs.totalMilestones}
              delayedMilestones={scheduleKPIs.delayedMilestones}
              maxDelayDays={scheduleKPIs.maxDelayDays}
              nextMilestone={nextMilestone}
              delayedList={delayedMilestones}
              statusBreakdown={statusBreakdown}
              status={dim("schedule").status}
            />

            <ResourceCard
              byRole={resourceKPIs.byRole}
              overallUtilizationPct={resourceKPIs.overallUtilizationPct}
              status={dim("resource").status}
              yellowThreshold={thresholds.resourceYellowPct}
              redThreshold={thresholds.resourceRedPct}
            />

            <ScopeCard
              totalStoryPoints={scopeKPIs.totalStoryPoints}
              completedStoryPoints={scopeKPIs.completedStoryPoints}
              completionPct={scopeKPIs.completionPct}
              openIssues={scopeKPIs.openIssues}
              totalIssues={scopeKPIs.totalIssues}
              bugRate={scopeKPIs.bugRate}
              velocityTrend={scopeKPIs.velocityTrend}
              scopeGrowthPct={scopeKPIs.scopeGrowthPct}
              status={dim("scope").status}
            />
          </>
        )}

        <TimeAnalysisCard
          projectId={params.id}
          lastImportDate={lastImportDateStr}
          currentMonthHours={currentMonthHours}
        />
      </div>
    </main>
  );
}
