-- FEAT-008: Add team, ticket_ref, task_category columns to oa_timesheets
ALTER TABLE oa_timesheets
  ADD COLUMN team           text,
  ADD COLUMN ticket_ref     text,
  ADD COLUMN task_category  text;

CREATE INDEX oa_timesheets_team_idx          ON oa_timesheets (project_id, team);
CREATE INDEX oa_timesheets_task_category_idx ON oa_timesheets (project_id, task_category);
