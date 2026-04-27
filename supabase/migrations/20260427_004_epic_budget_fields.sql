-- FEAT-011: Epic Budget Tracking
-- Adds T-Shirt planning field to Jira issues and epic warning threshold to project thresholds.

ALTER TABLE jira_issues
  ADD COLUMN t_shirt_days integer;

ALTER TABLE project_thresholds
  ADD COLUMN epic_warning_margin_pct integer NOT NULL DEFAULT 10;
