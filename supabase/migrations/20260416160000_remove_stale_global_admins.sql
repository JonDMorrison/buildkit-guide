-- Remove global admin role from test accounts and unknown users.
-- These accounts should not have cross-tenant admin privileges.
DELETE FROM public.user_roles
WHERE role = 'admin'
AND user_id IN (
  -- E2E test users
  '11471cfb-f64a-4e03-b78e-07a7d64d6cdd',
  '33507a43-19fc-4ab0-93c5-c27eed0d2392',
  '80975ed2-b23d-4a52-afb9-bae08b6d8fbd',
  'ce340bfc-d86c-460b-b2a2-888189a99724',
  'cfe4ce5e-f0e4-4060-8d20-cebbf201cc02',
  'ec95d55e-daa6-482f-94ab-89e5e34f3f7e',
  -- Fake test account
  '55555555-5555-5555-5555-555555555555',
  -- Unknown Ahmed Ali accounts
  'd5d19763-a386-417d-ba24-05c40077ae95',
  'e4e58fd1-24e1-4199-bdf1-7f77b673026b',
  '0bb71b1a-8265-465d-bc06-571c740ec979',
  -- Jon test account from today
  'd877db60-e803-4f57-bd8b-9f0553907f78'
);
