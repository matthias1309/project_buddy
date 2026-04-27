import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllTimesheets } from "@/lib/supabase/paginate";
import {
  filterTimesheets,
  calcEpicBudget,
} from "@/lib/calculations/epic-calculations";
import { SprintFilter } from "@/components/shared/sprint-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JiraIssue, OATimesheet, ProjectSprint, EpicBudgetStatus } from "@/types/domain.types";

interface Props {
  params: { id: string };
  searchParams: {
    period?: string;
    team?: string | string[];
    sprint?: string | string[];
  };
}

function recentMonthOptions(count: number): { label: string; value: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    };
  });
}

function fmtH(n: number): string {
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`;
}

function fmtPt(days: number): string {
  return days % 1 === 0 ? String(days) : days.toFixed(1);
}

const statusDotClass: Record<EpicBudgetStatus, string> = {
  green:   "bg-green-500",
  yellow:  "bg-yellow-500",
  red:     "bg-red-500",
  unknown: "bg-muted-foreground",
};

const statusLabel: Record<EpicBudgetStatus, string> = {
  green:   "OK",
  yellow:  "Near limit",
  red:     "Overbooked",
  unknown: "—",
};

export default async function EpicBudgetPage({ params, searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: project },
    { data: rawIssues },
    rawTimesheets,
    { data: rawSprints },
    { data: rawThresholds },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, project_number")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single(),
    supabase.from("jira_issues").select("*").eq("project_id", params.id),
    fetchAllTimesheets(supabase, params.id),
    supabase
      .from("project_sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", params.id)
      .order("start_date", { ascending: true }),
    supabase
      .from("project_thresholds")
      .select("epic_warning_margin_pct")
      .eq("project_id", params.id)
      .single(),
  ]);

  if (!project) redirect("/");

  const period = typeof searchParams.period === "string" ? searchParams.period : "all";
  const selectedTeam = typeof searchParams.team === "string" ? searchParams.team : "";
  const selectedSprintNames: string[] = Array.isArray(searchParams.sprint)
    ? searchParams.sprint
    : searchParams.sprint
      ? [searchParams.sprint]
      : [];

  const allSprints = (rawSprints ?? []) as Pick<
    ProjectSprint,
    "id" | "name" | "start_date" | "end_date"
  >[];

  const warningMarginPct = rawThresholds?.epic_warning_margin_pct ?? 10;

  // Map DB rows to domain types
  const allIssues: JiraIssue[] = (rawIssues ?? []).map((r) => ({
    issueKey: r.issue_key,
    summary: r.summary ?? undefined,
    issueType: r.issue_type ?? undefined,
    status: r.status ?? "",
    storyPoints: r.story_points ?? undefined,
    sprint: r.sprint ?? undefined,
    epic: r.epic ?? undefined,
    tShirtDays: r.t_shirt_days ?? undefined,
    assignee: r.assignee ?? undefined,
  }));

  const allTimesheets: OATimesheet[] = rawTimesheets.map((r) => ({
    employeeName: r.employee_name ?? undefined,
    role: r.role ?? undefined,
    phase: r.phase ?? undefined,
    plannedHours: r.planned_hours ?? undefined,
    bookedHours: r.booked_hours ?? undefined,
    periodDate: r.period_date ? new Date(r.period_date) : undefined,
    team: r.team ?? undefined,
    ticketRef: r.ticket_ref ?? undefined,
    taskCategory: r.task_category ?? undefined,
  }));

  const allTeams = [
    ...new Set(allTimesheets.map((t) => t.team).filter((t): t is string => !!t)),
  ].sort();

  // Resolve combined date range (sprint union ∩ month filter)
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (selectedSprintNames.length > 0) {
    const matched = allSprints.filter((s) => selectedSprintNames.includes(s.name));
    const starts = matched
      .map((s) => new Date(s.start_date))
      .filter((d) => !isNaN(d.getTime()));
    const ends = matched
      .map((s) => new Date(s.end_date))
      .filter((d) => !isNaN(d.getTime()));
    if (starts.length > 0)
      dateFrom = new Date(Math.min(...starts.map((d) => d.getTime())));
    if (ends.length > 0)
      dateTo = new Date(Math.max(...ends.map((d) => d.getTime())));
  }

  if (period !== "all") {
    const [y, m] = period.split("-").map(Number);
    const monthFrom = new Date(y, m - 1, 1);
    const monthTo = new Date(y, m, 0);
    monthTo.setHours(23, 59, 59, 999);
    dateFrom = dateFrom
      ? new Date(Math.max(dateFrom.getTime(), monthFrom.getTime()))
      : monthFrom;
    dateTo = dateTo
      ? new Date(Math.min(dateTo.getTime(), monthTo.getTime()))
      : monthTo;
  }

  const filtered = filterTimesheets(allTimesheets, {
    team: selectedTeam || undefined,
    dateFrom,
    dateTo,
  });

  const epics = allIssues.filter((i) => i.issueType?.toLowerCase() === "epic");
  const epicRows = calcEpicBudget(epics, allIssues, filtered, warningMarginPct);

  const hasJiraData = allIssues.length > 0;
  const hasOAData = allTimesheets.length > 0;
  const monthOptions = recentMonthOptions(6);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {project.project_number ?? params.id}
          </p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Epic Budget</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${params.id}`}>
            <Button variant="outline" size="sm">
              Dashboard
            </Button>
          </Link>
          <Link href={`/projects/${params.id}/import`}>
            <Button variant="outline" size="sm">
              Import
            </Button>
          </Link>
        </div>
      </div>

      {/* No Jira data state */}
      {!hasJiraData && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">
            No Jira data yet.{" "}
            <Link
              href={`/projects/${params.id}/import`}
              className="text-primary underline underline-offset-2"
            >
              Import a Jira export to get started
            </Link>
            .
          </p>
        </div>
      )}

      {hasJiraData && (
        <>
          {/* Filter bar */}
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="period" className="text-sm font-medium">
                Period
              </label>
              <select
                id="period"
                name="period"
                defaultValue={period}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="all">All time</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {allTeams.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="team" className="text-sm font-medium">
                  Team
                </label>
                <select
                  id="team"
                  name="team"
                  defaultValue={selectedTeam}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">All teams</option>
                  {allTeams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button type="submit" size="sm" variant="secondary">
              Apply
            </Button>
          </form>

          {allSprints.length > 0 && <SprintFilter sprints={allSprints} />}

          {/* No OA data hint */}
          {!hasOAData && (
            <p className="text-sm text-muted-foreground">
              No timesheet data yet — booked hours will show as 0.{" "}
              <Link
                href={`/projects/${params.id}/import`}
                className="text-primary underline underline-offset-2"
              >
                Import an OpenAir export
              </Link>
              .
            </p>
          )}

          {/* Epic table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Epics ({epicRows.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {epicRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No epics found in Jira data.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Epic</th>
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 text-right font-medium">Planned (PT)</th>
                        <th className="pb-2 text-right font-medium">Booked (h)</th>
                        <th className="pb-2 text-right font-medium">Booked (PT)</th>
                        <th className="pb-2 text-right font-medium">Usage %</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {epicRows.map((row) => (
                        <tr key={row.epicKey}>
                          <td className="py-2 font-mono text-xs">{row.epicKey}</td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {row.epicName ?? "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {row.plannedDays !== null ? fmtPt(row.plannedDays) : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {fmtH(row.bookedHours)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {fmtPt(row.bookedDays)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {row.usagePct !== null ? `${row.usagePct.toFixed(1)} %` : "—"}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 rounded-full ${statusDotClass[row.status]}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                {statusLabel[row.status]}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
