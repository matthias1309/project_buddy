export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      import_logs: {
        Row: {
          error_message: string | null
          filename: string
          id: string
          imported_at: string
          project_id: string
          records_imported: number | null
          source: string
          status: string
        }
        Insert: {
          error_message?: string | null
          filename: string
          id?: string
          imported_at?: string
          project_id: string
          records_imported?: number | null
          source: string
          status: string
        }
        Update: {
          error_message?: string | null
          filename?: string
          id?: string
          imported_at?: string
          project_id?: string
          records_imported?: number | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jira_issues: {
        Row: {
          assignee: string | null
          created_date: string | null
          epic: string | null
          id: string
          import_log_id: string | null
          issue_key: string
          issue_type: string | null
          project_id: string
          resolved_date: string | null
          sprint: string | null
          status: string | null
          story_points: number | null
          summary: string | null
        }
        Insert: {
          assignee?: string | null
          created_date?: string | null
          epic?: string | null
          id?: string
          import_log_id?: string | null
          issue_key: string
          issue_type?: string | null
          project_id: string
          resolved_date?: string | null
          sprint?: string | null
          status?: string | null
          story_points?: number | null
          summary?: string | null
        }
        Update: {
          assignee?: string | null
          created_date?: string | null
          epic?: string | null
          id?: string
          import_log_id?: string | null
          issue_key?: string
          issue_type?: string | null
          project_id?: string
          resolved_date?: string | null
          sprint?: string | null
          status?: string | null
          story_points?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jira_issues_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jira_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      jira_sprints: {
        Row: {
          completed_points: number | null
          end_date: string | null
          id: string
          import_log_id: string | null
          planned_points: number | null
          project_id: string
          sprint_name: string
          start_date: string | null
          state: string | null
        }
        Insert: {
          completed_points?: number | null
          end_date?: string | null
          id?: string
          import_log_id?: string | null
          planned_points?: number | null
          project_id: string
          sprint_name: string
          start_date?: string | null
          state?: string | null
        }
        Update: {
          completed_points?: number | null
          end_date?: string | null
          id?: string
          import_log_id?: string | null
          planned_points?: number | null
          project_id?: string
          sprint_name?: string
          start_date?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jira_sprints_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jira_sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      oa_budget_entries: {
        Row: {
          actual_eur: number | null
          category: string | null
          id: string
          import_log_id: string | null
          period_date: string | null
          planned_eur: number | null
          project_id: string
        }
        Insert: {
          actual_eur?: number | null
          category?: string | null
          id?: string
          import_log_id?: string | null
          period_date?: string | null
          planned_eur?: number | null
          project_id: string
        }
        Update: {
          actual_eur?: number | null
          category?: string | null
          id?: string
          import_log_id?: string | null
          period_date?: string | null
          planned_eur?: number | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oa_budget_entries_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oa_budget_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      oa_milestones: {
        Row: {
          actual_date: string | null
          id: string
          import_log_id: string | null
          name: string
          planned_date: string | null
          project_id: string
          status: string | null
        }
        Insert: {
          actual_date?: string | null
          id?: string
          import_log_id?: string | null
          name: string
          planned_date?: string | null
          project_id: string
          status?: string | null
        }
        Update: {
          actual_date?: string | null
          id?: string
          import_log_id?: string | null
          name?: string
          planned_date?: string | null
          project_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oa_milestones_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oa_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      oa_timesheets: {
        Row: {
          booked_hours: number | null
          employee_name: string | null
          id: string
          import_log_id: string | null
          period_date: string | null
          phase: string | null
          planned_hours: number | null
          project_id: string
          role: string | null
          task_category: string | null
          team: string | null
          ticket_ref: string | null
        }
        Insert: {
          booked_hours?: number | null
          employee_name?: string | null
          id?: string
          import_log_id?: string | null
          period_date?: string | null
          phase?: string | null
          planned_hours?: number | null
          project_id: string
          role?: string | null
          task_category?: string | null
          team?: string | null
          ticket_ref?: string | null
        }
        Update: {
          booked_hours?: number | null
          employee_name?: string | null
          id?: string
          import_log_id?: string | null
          period_date?: string | null
          phase?: string | null
          planned_hours?: number | null
          project_id?: string
          role?: string | null
          task_category?: string | null
          team?: string | null
          ticket_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oa_timesheets_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oa_timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_thresholds: {
        Row: {
          budget_red_pct: number
          budget_yellow_pct: number
          id: string
          project_id: string
          resource_red_pct: number
          resource_yellow_pct: number
          schedule_red_days: number
          schedule_yellow_days: number
          scope_red_pct: number
          scope_yellow_pct: number
        }
        Insert: {
          budget_red_pct?: number
          budget_yellow_pct?: number
          id?: string
          project_id: string
          resource_red_pct?: number
          resource_yellow_pct?: number
          schedule_red_days?: number
          schedule_yellow_days?: number
          scope_red_pct?: number
          scope_yellow_pct?: number
        }
        Update: {
          budget_red_pct?: number
          budget_yellow_pct?: number
          id?: string
          project_id?: string
          resource_red_pct?: number
          resource_yellow_pct?: number
          schedule_red_days?: number
          schedule_yellow_days?: number
          scope_red_pct?: number
          scope_yellow_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_thresholds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client: string | null
          created_at: string
          description: string | null
          end_date: string
          id: string
          name: string
          owner_id: string
          project_number: string | null
          start_date: string
          total_budget_eur: number
          updated_at: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          owner_id: string
          project_number?: string | null
          start_date: string
          total_budget_eur: number
          updated_at?: string
        }
        Update: {
          client?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          owner_id?: string
          project_number?: string | null
          start_date?: string
          total_budget_eur?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

