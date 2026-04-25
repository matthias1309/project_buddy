import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type OATimesheetRow = Database["public"]["Tables"]["oa_timesheets"]["Row"];

const PAGE_SIZE = 1000;

async function paginateTimesheets(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<OATimesheetRow[]> {
  const all: OATimesheetRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("oa_timesheets")
      .select("*")
      .eq("project_id", projectId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`[paginate] oa_timesheets: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/**
 * Fetches all oa_timesheets rows for one project, bypassing Supabase's
 * server-side max_rows cap via automatic pagination.
 */
export async function fetchAllTimesheets(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<OATimesheetRow[]> {
  return paginateTimesheets(supabase, projectId);
}

/**
 * Fetches all oa_timesheets rows for multiple projects in parallel.
 */
export async function fetchAllTimesheetsForProjects(
  supabase: SupabaseClient<Database>,
  projectIds: string[],
): Promise<OATimesheetRow[]> {
  if (projectIds.length === 0) return [];
  const pages = await Promise.all(projectIds.map((id) => paginateTimesheets(supabase, id)));
  return pages.flat();
}
