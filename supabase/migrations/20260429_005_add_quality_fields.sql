-- FEAT-012: Add priority and team columns to jira_issues,
-- and quality lead time thresholds to project_thresholds.

ALTER TABLE jira_issues
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS team     text;

ALTER TABLE project_thresholds
  ADD COLUMN IF NOT EXISTS quality_lead_critical_days integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS quality_lead_major_days    integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS quality_lead_minor_days    integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS quality_lead_trivial_days  integer NOT NULL DEFAULT 50;
