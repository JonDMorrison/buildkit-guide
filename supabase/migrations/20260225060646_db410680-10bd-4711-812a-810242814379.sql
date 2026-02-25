
-- 1. Create new organizations
INSERT INTO organizations (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Foster Irrigation'),
  ('22222222-2222-2222-2222-222222222222', 'Team Horizon'),
  ('33333333-3333-3333-3333-333333333333', 'GRM Inc');

-- 2. Move memberships: update org_id from Default to new orgs

-- Foster Irrigation: Melissa
UPDATE organization_memberships
SET organization_id = '11111111-1111-1111-1111-111111111111', role = 'admin'
WHERE user_id = '51c4f804-8daa-44bd-95eb-b87361293abe'
  AND organization_id = '00000000-0000-0000-0000-000000000001';

-- Team Horizon: jordan.pughe@teamhorizon.com
UPDATE organization_memberships
SET organization_id = '22222222-2222-2222-2222-222222222222', role = 'admin'
WHERE user_id = '250fa4b2-2f13-4760-b04a-b3e4a2fe5ee7'
  AND organization_id = '00000000-0000-0000-0000-000000000001';

-- Team Horizon: sean.olson@teamhorizon.com
UPDATE organization_memberships
SET organization_id = '22222222-2222-2222-2222-222222222222', role = 'pm'
WHERE user_id = 'f4958b9a-1f39-4d31-b86e-bc1044dd9202'
  AND organization_id = '00000000-0000-0000-0000-000000000001';

-- Team Horizon: pughejordan@gmail.com
UPDATE organization_memberships
SET organization_id = '22222222-2222-2222-2222-222222222222', role = 'pm'
WHERE user_id = '7b9799f3-ceaa-4026-83e0-33ccc2f9d1f3'
  AND organization_id = '00000000-0000-0000-0000-000000000001';

-- GRM Inc: kjohnston@grminc.ca
UPDATE organization_memberships
SET organization_id = '33333333-3333-3333-3333-333333333333', role = 'admin'
WHERE user_id = '977f8215-0638-481d-a266-6ece5e688f50'
  AND organization_id = '00000000-0000-0000-0000-000000000001';

-- 3. Remove project memberships from Default Org projects for migrated users
-- This prevents cross-org data access
DELETE FROM project_members
WHERE user_id IN (
  '51c4f804-8daa-44bd-95eb-b87361293abe',
  '250fa4b2-2f13-4760-b04a-b3e4a2fe5ee7',
  'f4958b9a-1f39-4d31-b86e-bc1044dd9202',
  '7b9799f3-ceaa-4026-83e0-33ccc2f9d1f3',
  '977f8215-0638-481d-a266-6ece5e688f50'
)
AND project_id IN (
  SELECT id FROM projects WHERE organization_id = '00000000-0000-0000-0000-000000000001'
);
