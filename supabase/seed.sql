-- Development seed data
-- Creates a test user and a demo project for local development.
-- Login: dev@example.com / test1234

DO $$
DECLARE
  v_user_id    uuid := '00000000-0000-0000-0000-000000000001';
  v_project_id uuid;
BEGIN

  -- Create test user in auth.users (skip if already exists)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'dev@example.com',
    crypt('test1234', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false
  ) ON CONFLICT (id) DO NOTHING;

  -- Required for email/password login to work
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'dev@example.com',
    'email',
    jsonb_build_object('sub', v_user_id::text, 'email', 'dev@example.com'),
    now(),
    now(),
    now()
  ) ON CONFLICT DO NOTHING;

  -- Demo project
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
