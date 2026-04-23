export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          project_number: string | null;
          description: string | null;
          client: string | null;
          start_date: string;
          end_date: string;
          total_budget_eur: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["projects"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      import_logs: {
        Row: {
          id: string;
          project_id: string;
          source: "jira" | "openair";
          filename: string;
          status: "success" | "error" | "partial";
          records_imported: number | null;
          error_message: string | null;
          imported_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["import_logs"]["Row"],
          "id" | "imported_at"
        >;
        Update: Partial<Database["public"]["Tables"]["import_logs"]["Insert"]>;
      };
      jira_issues: {
        Row: {
          id: string;
          project_id: string;
          issue_key: string;
          summary: string | null;
          issue_type: string | null;
          status: string | null;
          story_points: number | null;
          sprint: string | null;
          epic: string | null;
          assignee: string | null;
          created_date: string | null;
          resolved_date: string | null;
          import_log_id: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["jira_issues"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["jira_issues"]["Insert"]>;
      };
      jira_sprints: {
        Row: {
          id: string;
          project_id: string;
          sprint_name: string;
          state: string | null;
          start_date: string | null;
          end_date: string | null;
          completed_points: number | null;
          planned_points: number | null;
          import_log_id: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["jira_sprints"]["Row"],
          "id"
        >;
        Update: Partial<Database["public"]["Tables"]["jira_sprints"]["Insert"]>;
      };
      oa_timesheets: {
        Row: {
          id: string;
          project_id: string;
          employee_name: string | null;
          role: string | null;
          phase: string | null;
          planned_hours: number | null;
          booked_hours: number | null;
          period_date: string | null;
          import_log_id: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["oa_timesheets"]["Row"],
          "id"
        >;
        Update: Partial<
          Database["public"]["Tables"]["oa_timesheets"]["Insert"]
        >;
      };
      oa_milestones: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          planned_date: string | null;
          actual_date: string | null;
          status: string | null;
          import_log_id: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["oa_milestones"]["Row"],
          "id"
        >;
        Update: Partial<
          Database["public"]["Tables"]["oa_milestones"]["Insert"]
        >;
      };
      oa_budget_entries: {
        Row: {
          id: string;
          project_id: string;
          category: string | null;
          planned_eur: number | null;
          actual_eur: number | null;
          period_date: string | null;
          import_log_id: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["oa_budget_entries"]["Row"],
          "id"
        >;
        Update: Partial<
          Database["public"]["Tables"]["oa_budget_entries"]["Insert"]
        >;
      };
      project_thresholds: {
        Row: {
          id: string;
          project_id: string;
          budget_yellow_pct: number;
          budget_red_pct: number;
          schedule_yellow_days: number;
          schedule_red_days: number;
          resource_yellow_pct: number;
          resource_red_pct: number;
          scope_yellow_pct: number;
          scope_red_pct: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["project_thresholds"]["Row"],
          "id"
        >;
        Update: Partial<
          Database["public"]["Tables"]["project_thresholds"]["Insert"]
        >;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
