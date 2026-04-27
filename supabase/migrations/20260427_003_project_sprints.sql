-- Migration: project_sprints
-- Adds manually configured sprints per project for sprint-based filtering.

CREATE TABLE project_sprints (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_sprints_end_after_start CHECK (end_date > start_date)
);

CREATE INDEX project_sprints_project_id_idx ON project_sprints (project_id);

ALTER TABLE project_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_sprints: owner full access"
  ON project_sprints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_sprints.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_sprints.project_id
        AND projects.owner_id = auth.uid()
    )
  );

CREATE TRIGGER project_sprints_updated_at
  BEFORE UPDATE ON project_sprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
