-- Development seed data
-- Run after migrations to populate a local Supabase instance for development.
-- Requires a user to exist in auth.users first (create via Supabase dashboard or auth API).

-- Replace this UUID with an actual user ID from your local auth.users table.
DO $$
DECLARE
  v_user_id  uuid := '00000000-0000-0000-0000-000000000001';
  v_project_id uuid;
BEGIN
  INSERT INTO projects (
    owner_id, name, project_number, client,
    start_date, end_date, total_budget_eur, description
  ) VALUES (
    v_user_id,
    'Demo Project Alpha',
    'PRJ-2026-001',
    'Acme Corp',
    '2026-01-01',
    '2026-12-31',
    250000.00,
    'Synthetic demo project for local development'
  )
  RETURNING id INTO v_project_id;

  INSERT INTO project_thresholds (project_id)
  VALUES (v_project_id);
END $$;
