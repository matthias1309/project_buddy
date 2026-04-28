import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseJiraExcel } from "@/lib/parsers/jira-parser";
import { parseOpenAirExcel } from "@/lib/parsers/openair-parser";
import { ERRORS } from "@/lib/errors";
import type { JiraParseResult, OpenAirParseResult } from "@/types/domain.types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const BATCH_SIZE = 2000;

function errJson(
  key: keyof typeof ERRORS,
  status: number,
  message?: string,
): NextResponse {
  return NextResponse.json(
    { error: key, message: message ?? ERRORS[key] },
    { status },
  );
}

function toDateStr(date: Date | undefined): string | null {
  if (!date) return null;
  return date.toISOString().split("T")[0];
}

async function insertJira(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  logId: string,
  result: JiraParseResult,
): Promise<number> {
  const issueRows = result.issues.map((i) => ({
    project_id: projectId,
    issue_key: i.issueKey,
    summary: i.summary ?? null,
    issue_type: i.issueType ?? null,
    status: i.status,
    priority: i.priority ?? null,
    team: i.team ?? null,
    story_points: i.storyPoints ?? null,
    t_shirt_days: i.tShirtDays ?? null,
    sprint: i.sprint ?? null,
    epic: i.epic ?? null,
    assignee: i.assignee ?? null,
    created_date: toDateStr(i.createdDate),
    resolved_date: toDateStr(i.resolvedDate),
    import_log_id: logId,
  }));

  for (let i = 0; i < issueRows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("jira_issues")
      .insert(issueRows.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(error.message);
  }

  const sprintRows = result.sprints.map((s) => ({
    project_id: projectId,
    sprint_name: s.sprintName,
    state: s.state ?? null,
    start_date: toDateStr(s.startDate),
    end_date: toDateStr(s.endDate),
    completed_points: s.completedPoints ?? null,
    planned_points: s.plannedPoints ?? null,
    import_log_id: logId,
  }));

  for (let i = 0; i < sprintRows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("jira_sprints")
      .insert(sprintRows.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(error.message);
  }

  return result.issues.length + result.sprints.length;
}

async function insertOpenAir(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  logId: string,
  result: OpenAirParseResult,
): Promise<number> {
  const timesheetRows = result.timesheets.map((t) => ({
    project_id: projectId,
    employee_name: t.employeeName ?? null,
    role: t.role ?? null,
    phase: t.phase ?? null,
    planned_hours: t.plannedHours ?? null,
    booked_hours: t.bookedHours ?? null,
    period_date: toDateStr(t.periodDate),
    import_log_id: logId,
    team: t.team ?? null,
    ticket_ref: t.ticketRef ?? null,
    task_category: t.taskCategory ?? null,
  }));

  for (let i = 0; i < timesheetRows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("oa_timesheets")
      .insert(timesheetRows.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(error.message);
  }

  const milestoneRows = result.milestones.map((m) => ({
    project_id: projectId,
    name: m.name,
    planned_date: toDateStr(m.plannedDate),
    actual_date: toDateStr(m.actualDate),
    status: m.status ?? null,
    import_log_id: logId,
  }));

  for (let i = 0; i < milestoneRows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("oa_milestones")
      .insert(milestoneRows.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(error.message);
  }

  const budgetRows = result.budgetEntries.map((b) => ({
    project_id: projectId,
    category: b.category ?? null,
    planned_eur: b.plannedEur ?? null,
    actual_eur: b.actualEur ?? null,
    period_date: toDateStr(b.periodDate),
    import_log_id: logId,
  }));

  for (let i = 0; i < budgetRows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("oa_budget_entries")
      .insert(budgetRows.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(error.message);
  }

  return (
    result.timesheets.length +
    result.milestones.length +
    result.budgetEntries.length
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const supabase = createClient();

    // 1. Auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errJson("AUTH_UNAUTHORIZED", 401);

    // 2. Project access (RLS ensures owner_id match)
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single();
    if (!project) return errJson("PROJECT_ACCESS_DENIED", 403);

    // 3. Parse multipart form
    const formData = await request.formData();
    const file = formData.get("file");
    const source = formData.get("source");

    if (!(file instanceof File)) {
      return errJson("IMPORT_PARSE_ERROR", 400, "No file provided");
    }
    if (source !== "jira" && source !== "openair") {
      return errJson("IMPORT_PARSE_ERROR", 400, 'source must be "jira" or "openair"');
    }

    // 4. File validation
    if (file.size > MAX_FILE_SIZE) return errJson("IMPORT_FILE_TOO_LARGE", 413);
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return errJson("IMPORT_INVALID_FILE_TYPE", 422);
    }

    // 5. Parse
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult =
      source === "jira" ? parseJiraExcel(buffer) : parseOpenAirExcel(buffer);

    // 6. Create import_log (count updated after insertion)
    const { data: importLog, error: logError } = await supabase
      .from("import_logs")
      .insert({
        project_id: params.id,
        source,
        filename: file.name,
        status: parseResult.errors.length > 0 ? "partial" : "success",
        records_imported: 0,
        error_message:
          parseResult.errors.length > 0
            ? JSON.stringify(parseResult.errors)
            : null,
      })
      .select()
      .single();

    if (logError || !importLog) {
      console.error("[import] failed to create import_log", logError);
      return errJson("GENERIC", 500);
    }

    // 7. Replace existing data and insert new
    let recordsImported = 0;

    if (source === "jira") {
      await supabase.from("jira_issues").delete().eq("project_id", params.id);
      await supabase.from("jira_sprints").delete().eq("project_id", params.id);
      recordsImported = await insertJira(
        supabase,
        params.id,
        importLog.id,
        parseResult as JiraParseResult,
      );
    } else {
      await supabase
        .from("oa_timesheets")
        .delete()
        .eq("project_id", params.id);
      await supabase
        .from("oa_milestones")
        .delete()
        .eq("project_id", params.id);
      await supabase
        .from("oa_budget_entries")
        .delete()
        .eq("project_id", params.id);
      recordsImported = await insertOpenAir(
        supabase,
        params.id,
        importLog.id,
        parseResult as OpenAirParseResult,
      );
    }

    // 8. Update final record count
    await supabase
      .from("import_logs")
      .update({ records_imported: recordsImported })
      .eq("id", importLog.id);

    return NextResponse.json({
      success: true,
      recordsImported,
      errors: parseResult.errors,
      warnings: parseResult.warnings,
      importLogId: importLog.id,
    });
  } catch (err) {
    console.error("[import] unexpected error", err);
    return errJson("GENERIC", 500);
  }
}
