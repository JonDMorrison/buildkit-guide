-- =====================================================
-- SECURITY BASELINE: Phase 1 - Fix profiles table RLS
-- =====================================================

-- Drop the dangerous policy that allows public read
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create secure replacement: users can only see profiles in same organization
CREATE POLICY "Users can view profiles in same organization"
  ON profiles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- User can always see their own profile
      id = auth.uid()
      OR
      -- User can see profiles of users in the same organization(s)
      EXISTS (
        SELECT 1 FROM organization_memberships om1
        WHERE om1.user_id = profiles.id
          AND om1.is_active = true
          AND om1.organization_id IN (
            SELECT om2.organization_id 
            FROM organization_memberships om2
            WHERE om2.user_id = auth.uid()
              AND om2.is_active = true
          )
      )
    )
  );

-- =====================================================
-- SECURITY BASELINE: Phase 2 - Fix trades table
-- =====================================================

-- Add organization scoping column if it doesn't exist
ALTER TABLE trades ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_trades_organization_id ON trades(organization_id);

-- Backfill existing trades: associate with organization via project_members
UPDATE trades t
SET organization_id = (
  SELECT DISTINCT p.organization_id 
  FROM project_members pm
  JOIN projects p ON pm.project_id = p.id
  WHERE pm.trade_id = t.id
  LIMIT 1
)
WHERE t.organization_id IS NULL;

-- Drop the dangerous SELECT policy
DROP POLICY IF EXISTS "Users can view trades" ON trades;

-- Create secure replacement: org-scoped access only
CREATE POLICY "Users can view trades in same organization"
  ON trades FOR SELECT TO authenticated
  USING (
    is_admin(auth.uid())
    OR
    is_org_member(auth.uid(), organization_id)
  );

-- Update INSERT policy to require org membership
DROP POLICY IF EXISTS "PM and Admin can insert trades" ON trades;

CREATE POLICY "PM and Admin can insert trades"
  ON trades FOR INSERT TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'project_manager')
      AND is_org_member(auth.uid(), organization_id)
    )
  );

-- Update UPDATE policy to require org membership
DROP POLICY IF EXISTS "PM and Admin can update trades" ON trades;

CREATE POLICY "PM and Admin can update trades"
  ON trades FOR UPDATE TO authenticated
  USING (
    is_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'project_manager')
      AND is_org_member(auth.uid(), organization_id)
    )
  );

-- =====================================================
-- SECURITY BASELINE: Phase 3 - Fix receipts table RLS
-- =====================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Project members can view receipts" ON receipts;

-- Create restricted replacement: uploader, PM, admin, or accounting only
CREATE POLICY "Authorized users can view receipts"
  ON receipts FOR SELECT
  USING (
    -- Global admin
    is_admin(auth.uid())
    OR
    -- Uploader can see their own
    uploaded_by = auth.uid()
    OR
    -- Project manager can see project receipts
    has_project_role(auth.uid(), project_id, 'project_manager')
    OR
    -- Accounting role
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'accounting'
    )
  );