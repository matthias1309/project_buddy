-- ============================================================
-- PM Dashboard — Initial Schema
-- ============================================================

-- ------------------------------------------------------------
-- Utility: updated_at trigger function
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: projects
-- ============================================================
CREATE TABLE projects (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name             text        NOT NULL,
  project_number   text,
  description      text,
  client           text,
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  total_budget_eur numeric(12,2) NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projects_end_after_start CHECK (end_date >= start_date),
  CONSTRAINT projects_budget_positive  CHECK (total_budget_eur >= 0)
);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: owner full access"
  ON projects FOR ALL
  USING     (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ============================================================
-- TABLE: import_logs
-- ============================================================
CREATE TABLE import_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES projects ON DELETE CASCADE,
  source           text        NOT NULL CHECK (source IN ('jira', 'openair')),
  filename         text        NOT NULL,
  status           text        NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  records_imported integer,
  error_message    text,
  imported_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_logs: owner full access"
  ON import_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = import_logs.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = import_logs.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: jira_issues
-- ============================================================
CREATE TABLE jira_issues (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid    NOT NULL REFERENCES projects ON DELETE CASCADE,
  issue_key      text    NOT NULL,
  summary        text,
  issue_type     text,
  status         text,
  story_points   numeric,
  sprint         text,
  epic           text,
  assignee       text,
  created_date   date,
  resolved_date  date,
  import_log_id  uuid    REFERENCES import_logs ON DELETE SET NULL,

  CONSTRAINT jira_issues_unique_key_per_project UNIQUE (project_id, issue_key)
);

CREATE INDEX jira_issues_project_id_idx ON jira_issues (project_id);

ALTER TABLE jira_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jira_issues: owner full access"
  ON jira_issues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = jira_issues.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = jira_issues.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: jira_sprints
-- ============================================================
CREATE TABLE jira_sprints (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid    NOT NULL REFERENCES projects ON DELETE CASCADE,
  sprint_name      text    NOT NULL,
  state            text,
  start_date       date,
  end_date         date,
  completed_points numeric,
  planned_points   numeric,
  import_log_id    uuid    REFERENCES import_logs ON DELETE SET NULL,

  CONSTRAINT jira_sprints_unique_name_per_project UNIQUE (project_id, sprint_name)
);

CREATE INDEX jira_sprints_project_id_idx ON jira_sprints (project_id);

ALTER TABLE jira_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jira_sprints: owner full access"
  ON jira_sprints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = jira_sprints.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = jira_sprints.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: oa_timesheets
-- ============================================================
CREATE TABLE oa_timesheets (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid    NOT NULL REFERENCES projects ON DELETE CASCADE,
  employee_name  text,
  role           text,
  phase          text,
  planned_hours  numeric,
  booked_hours   numeric,
  period_date    date,
  import_log_id  uuid    REFERENCES import_logs ON DELETE SET NULL
);

CREATE INDEX oa_timesheets_project_id_idx ON oa_timesheets (project_id);

ALTER TABLE oa_timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oa_timesheets: owner full access"
  ON oa_timesheets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = oa_timesheets.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = oa_timesheets.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: oa_milestones
-- ============================================================
CREATE TABLE oa_milestones (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid    NOT NULL REFERENCES projects ON DELETE CASCADE,
  name           text    NOT NULL,
  planned_date   date,
  actual_date    date,
  status         text,
  import_log_id  uuid    REFERENCES import_logs ON DELETE SET NULL
);

CREATE INDEX oa_milestones_project_id_idx ON oa_milestones (project_id);

ALTER TABLE oa_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oa_milestones: owner full access"
  ON oa_milestones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = oa_milestones.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = oa_milestones.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: oa_budget_entries
-- ============================================================
CREATE TABLE oa_budget_entries (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid         NOT NULL REFERENCES projects ON DELETE CASCADE,
  category       text,
  planned_eur    numeric(12,2),
  actual_eur     numeric(12,2),
  period_date    date,
  import_log_id  uuid         REFERENCES import_logs ON DELETE SET NULL
);

CREATE INDEX oa_budget_entries_project_id_idx ON oa_budget_entries (project_id);

ALTER TABLE oa_budget_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oa_budget_entries: owner full access"
  ON oa_budget_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = oa_budget_entries.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = oa_budget_entries.project_id
        AND projects.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TABLE: project_thresholds
-- ============================================================
CREATE TABLE project_thresholds (
  id                    uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid    NOT NULL UNIQUE REFERENCES projects ON DELETE CASCADE,
  budget_yellow_pct     numeric NOT NULL DEFAULT 15,
  budget_red_pct        numeric NOT NULL DEFAULT 25,
  schedule_yellow_days  integer NOT NULL DEFAULT 5,
  schedule_red_days     integer NOT NULL DEFAULT 15,
  resource_yellow_pct   numeric NOT NULL DEFAULT 85,
  resource_red_pct      numeric NOT NULL DEFAULT 100,
  scope_yellow_pct      numeric NOT NULL DEFAULT 10,
  scope_red_pct         numeric NOT NULL DEFAULT 20,

  CONSTRAINT thresholds_budget_red_gt_yellow
    CHECK (budget_red_pct > budget_yellow_pct),
  CONSTRAINT thresholds_schedule_red_gt_yellow
    CHECK (schedule_red_days > schedule_yellow_days),
  CONSTRAINT thresholds_resource_red_gt_yellow
    CHECK (resource_red_pct > resource_yellow_pct),
  CONSTRAINT thresholds_scope_red_gt_yellow
    CHECK (scope_red_pct > scope_yellow_pct)
);

ALTER TABLE project_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_thresholds: owner full access"
  ON project_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_thresholds.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_thresholds.project_id
        AND projects.owner_id = auth.uid()
    )
  );
