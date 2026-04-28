import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllTimesheets } from "@/lib/supabase/paginate";
import {
  calcOpenBugsByPriority,
  calcAvgHoursByPriority,
  calcBugLeadTimes,
} from "@/lib/calculations/quality-calculations";
import { SprintFilter } from "@/components/shared/sprint-filter";
import { TeamFilter } from "@/components/shared/team-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JiraIssue, OATimesheet, ProjectSprint, QualityThresholds } from "@/types/domain.types";

interface Props {
  params: { id: string };
  searchParams: { team?: string | string[]; sprint?: string | string[] };
}

const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  criticalDays: 5,
  majorDays: 10,
  minorDays: 20,
  trivialDays: 50,
};

const PRIORITY_ORDER = ["Critical", "Major", "Minor", "Trivial", "—"] as const;

function priorityBadgeClass(priority: string | null): string {
  switch (priority) {
    case "Critical": return "bg-red-100 text-red-800";
    case "Major":    return "bg-orange-100 text-orange-800";
    case "Minor":    return "bg-yellow-100 text-yellow-800";
    case "Trivial":  return "bg-slate-100 text-slate-700";
    default:         return "bg-gray-100 text-gray-600";
  }
}

function leadStatusClass(status: "red" | "green" | "none"): string {
  if (status === "red")   return "bg-red-100 text-red-800";
  if (status === "green") return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-500";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-DE");
}

function fmtH(n: number | null): string {
  if (n === null) return "—";
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`;
}

export default async function QualityPage({ params, searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .single();
  if (!project) redirect("/");

  const [
    { data: rawIssues },
    rawTimesheets,
    { data: rawThresholds },
    { data: rawProjectSprints },
  ] = await Promise.all([
    supabase
      .from("jira_issues")
      .select("*")
      .eq("project_id", params.id)
      .eq("issue_type", "Bug"),
    fetchAllTimesheets(supabase, params.id),
    supabase
      .from("project_thresholds")
      .select("quality_lead_critical_days, quality_lead_major_days, quality_lead_minor_days, quality_lead_trivial_days")
      .eq("project_id", params.id)
      .single(),
    supabase
      .from("project_sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", params.id)
      .order("start_date", { ascending: true }),
  ]);

  const allProjectSprints = (rawProjectSprints ?? []) as Pick<
    ProjectSprint,
    "id" | "name" | "start_date" | "end_date"
  >[];

  const selectedSprintNames: string[] = Array.isArray(searchParams.sprint)
    ? searchParams.sprint
    : searchParams.sprint ? [searchParams.sprint] : [];

  const selectedTeamNames: string[] = Array.isArray(searchParams.team)
    ? searchParams.team
    : searchParams.team ? [searchParams.team] : [];

  const allBugs: JiraIssue[] = (rawIssues ?? []).map((r) => ({
    issueKey: r.issue_key,
    summary: r.summary ?? undefined,
    issueType: r.issue_type ?? undefined,
    status: r.status ?? "",
    priority: r.priority ?? undefined,
    team: r.team ?? undefined,
    storyPoints: r.story_points ?? undefined,
    sprint: r.sprint ?? undefined,
    epic: r.epic ?? undefined,
    assignee: r.assignee ?? undefined,
    createdDate: r.created_date ? new Date(r.created_date) : undefined,
    resolvedDate: r.resolved_date ? new Date(r.resolved_date) : undefined,
  }));

  const allTeams = [...new Set(allBugs.map((b) => b.team).filter((t): t is string => !!t))].sort();

  // Apply filters
  let bugs = allBugs;
  if (selectedSprintNames.length > 0) {
    bugs = bugs.filter(
      (b) => b.sprint && selectedSprintNames.some((name) => b.sprint!.includes(name)),
    );
  }
  if (selectedTeamNames.length > 0) {
    bugs = bugs.filter((b) => b.team && selectedTeamNames.includes(b.team));
  }

  const timesheets: OATimesheet[] = rawTimesheets.map((r) => ({
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

  const thresholds: QualityThresholds = rawThresholds
    ? {
        criticalDays: rawThresholds.quality_lead_critical_days,
        majorDays:    rawThresholds.quality_lead_major_days,
        minorDays:    rawThresholds.quality_lead_minor_days,
        trivialDays:  rawThresholds.quality_lead_trivial_days,
      }
    : DEFAULT_QUALITY_THRESHOLDS;

  const openByPriority  = calcOpenBugsByPriority(bugs);
  const avgHours        = calcAvgHoursByPriority(bugs, timesheets);
  const leadTimeRows    = calcBugLeadTimes(bugs, thresholds);

  const totalOpen = openByPriority.critical + openByPriority.major + openByPriority.minor + openByPriority.trivial + openByPriority.unknown;

  const PRIORITY_DISPLAY: Array<{ key: keyof typeof openByPriority; label: string; avgKey: keyof typeof avgHours }> = [
    { key: "critical", label: "Critical", avgKey: "critical" },
    { key: "major",    label: "Major",    avgKey: "major" },
    { key: "minor",    label: "Minor",    avgKey: "minor" },
    { key: "trivial",  label: "Trivial",  avgKey: "trivial" },
    { key: "unknown",  label: "Unknown",  avgKey: "unknown" },
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/projects/${params.id}`} className="text-sm text-muted-foreground hover:underline">
            ← {project.name}
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Quality</h1>
        </div>
        <Link href={`/projects/${params.id}/settings`}>
          <Button variant="outline" size="sm">Settings</Button>
        </Link>
      </div>

      {/* Filter bar */}
      {(allProjectSprints.length > 0 || allTeams.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {allProjectSprints.length > 0 && <SprintFilter sprints={allProjectSprints} />}
          {allTeams.length > 0 && <TeamFilter teams={allTeams} />}
        </div>
      )}

      {allBugs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No bug data found. Import Jira data to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Open Bugs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open Bugs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-bold">{totalOpen}</span>
                <span className="ml-2 text-sm text-muted-foreground">open bugs</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {PRIORITY_DISPLAY.map(({ key, label }) => {
                  const count = openByPriority[key];
                  return (
                    <div key={key} className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Avg Hours per Priority */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avg Hours per Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRIORITY_DISPLAY.filter((p) => p.key !== "unknown").map(({ label, avgKey }) => (
                  <div key={label} className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{fmtH(avgHours[avgKey])}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Mean OA hours booked per bug (open and closed). Bugs with no bookings count as 0 h.
              </p>
            </CardContent>
          </Card>

          {/* Section 3: Closed Bugs — Lead Time */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Closed Bugs — Lead Time</CardTitle>
                <div className="text-xs text-muted-foreground">
                  Thresholds: Critical {thresholds.criticalDays} d · Major {thresholds.majorDays} d · Minor {thresholds.minorDays} d · Trivial {thresholds.trivialDays} d
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {leadTimeRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No closed bugs in the current selection.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Issue Key</th>
                        <th className="pb-2 pr-4 font-medium">Summary</th>
                        <th className="pb-2 pr-4 font-medium">Priority</th>
                        <th className="pb-2 pr-4 font-medium">Created</th>
                        <th className="pb-2 pr-4 font-medium">Resolved</th>
                        <th className="pb-2 pr-4 font-medium">Lead Time</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadTimeRows.map((row) => (
                        <tr key={row.issueKey} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{row.issueKey}</td>
                          <td className="max-w-[200px] truncate py-2 pr-4 text-muted-foreground">
                            {row.summary ?? "—"}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${priorityBadgeClass(row.priority)}`}>
                              {row.priority ?? "—"}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-xs">{fmtDate(row.createdDate)}</td>
                          <td className="py-2 pr-4 text-xs">{fmtDate(row.resolvedDate)}</td>
                          <td className="py-2 pr-4 text-xs font-medium">{row.leadTimeDays} d</td>
                          <td className="py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${leadStatusClass(row.leadTimeStatus)}`}>
                              {row.leadTimeStatus === "red" ? "Over limit" : row.leadTimeStatus === "green" ? "OK" : "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
