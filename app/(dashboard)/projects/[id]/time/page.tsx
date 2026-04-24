import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  calcHoursByTeam,
  calcHoursByCategory,
  calcEpicHours,
  calcBugCost,
} from "@/lib/calculations/time-calculations";
import { TimeByTeamChart } from "@/components/dashboard/time-by-team-chart";
import { TimeByCategoryChart } from "@/components/dashboard/time-by-category-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OATimesheet, JiraIssue } from "@/types/domain.types";

interface Props {
  params: { id: string };
  searchParams: { period?: string | string[]; team?: string | string[] };
}

function currentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function filterByPeriod(timesheets: OATimesheet[], period: string): OATimesheet[] {
  if (period === "7d") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return timesheets.filter((t) => t.periodDate && t.periodDate >= cutoff);
  }
  // YYYY-MM
  return timesheets.filter((t) => {
    if (!t.periodDate) return false;
    const y = t.periodDate.getFullYear();
    const m = String(t.periodDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}` === period;
  });
}

function fmtH(n: number): string {
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`;
}

function periodLabel(period: string, months: { label: string; value: string }[]): string {
  if (period === "7d") return "Last 7 days";
  return months.find((m) => m.value === period)?.label ?? period;
}

export default async function TimeAnalysisPage({ params, searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: project }, { data: rawTimesheets }, { data: rawIssues }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, project_number")
        .eq("id", params.id)
        .eq("owner_id", user.id)
        .single(),
      supabase.from("oa_timesheets").select("*").eq("project_id", params.id),
      supabase.from("jira_issues").select("*").eq("project_id", params.id),
    ]);

  if (!project) redirect("/");

  const period =
    typeof searchParams.period === "string" ? searchParams.period : currentMonthPrefix();
  const selectedTeam =
    typeof searchParams.team === "string" ? searchParams.team : "";

  const allTimesheets: OATimesheet[] = (rawTimesheets ?? []).map((r) => ({
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

  const issues: JiraIssue[] = (rawIssues ?? []).map((r) => ({
    issueKey: r.issue_key,
    summary: r.summary ?? undefined,
    issueType: r.issue_type ?? undefined,
    status: r.status ?? "",
    storyPoints: r.story_points ?? undefined,
    sprint: r.sprint ?? undefined,
    epic: r.epic ?? undefined,
    assignee: r.assignee ?? undefined,
  }));

  const allTeams = [
    ...new Set(allTimesheets.map((t) => t.team).filter((t): t is string => !!t)),
  ].sort();

  let filtered = filterByPeriod(allTimesheets, period);
  if (selectedTeam) filtered = filtered.filter((t) => t.team === selectedTeam);

  const hoursByTeam = calcHoursByTeam(filtered);
  const hoursByCategory = calcHoursByCategory(filtered);
  const epicHours = calcEpicHours(filtered, issues);
  const bugCost = calcBugCost(filtered, issues);

  const monthOptions = recentMonthOptions(6);
  const totalHours = filtered.reduce((s, t) => s + (t.bookedHours ?? 0), 0);
  const hasTimesheetData = allTimesheets.length > 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {project.project_number ?? params.id}
          </p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Time Analysis</p>
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

      {/* No data state */}
      {!hasTimesheetData && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">
            No timesheet data yet.{" "}
            <Link
              href={`/projects/${params.id}/import`}
              className="text-primary underline underline-offset-2"
            >
              Import an OpenAir export to get started
            </Link>
            .
          </p>
        </div>
      )}

      {hasTimesheetData && (
        <>
          {/* Filter bar — plain GET form, works without JS */}
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
                <option value="7d">Last 7 days</option>
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

          {/* Summary line */}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {periodLabel(period, monthOptions)}
            </span>
            {selectedTeam && (
              <>
                {" · Team "}
                <span className="font-medium text-foreground">{selectedTeam}</span>
              </>
            )}
            {" · "}
            <span className="font-medium text-foreground">{fmtH(totalHours)}</span>
            {" total"}
          </p>

          {/* Section 1 — Hours by Team */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Hours by Team</CardTitle>
            </CardHeader>
            <CardContent>
              {hoursByTeam.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No team data in this period.
                </p>
              ) : (
                <TimeByTeamChart data={hoursByTeam} />
              )}
            </CardContent>
          </Card>

          {/* Section 2 — Category Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hoursByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No category data in this period.
                </p>
              ) : (
                <TimeByCategoryChart data={hoursByCategory} />
              )}
            </CardContent>
          </Card>

          {/* Section 3 — Epic Hours */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Epic Hours</CardTitle>
              {issues.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Jira import required for story point mapping
                </p>
              )}
            </CardHeader>
            <CardContent>
              {epicHours.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No ticket references found in this period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 font-medium">Ticket</th>
                        <th className="pb-2 text-right font-medium">Booked Hours</th>
                        <th className="pb-2 text-right font-medium">Story Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {epicHours.map((row) => (
                        <tr key={row.ref}>
                          <td className="py-1.5 font-mono text-xs">{row.ref}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {fmtH(row.hours)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                            {row.storyPoints !== null ? row.storyPoints : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4 — Bug Cost */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Bug Cost</CardTitle>
            </CardHeader>
            <CardContent>
              {bugCost.totalHours === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No bug bookings in this period.
                </p>
              ) : (
                <div className="flex gap-8">
                  <div>
                    <p className="text-2xl font-bold">{fmtH(bugCost.totalHours)}</p>
                    <p className="text-xs text-muted-foreground">Hours on bugs</p>
                  </div>
                  {bugCost.hoursPerSP !== null && (
                    <div>
                      <p className="text-2xl font-bold">
                        {bugCost.hoursPerSP.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">h / story point</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
