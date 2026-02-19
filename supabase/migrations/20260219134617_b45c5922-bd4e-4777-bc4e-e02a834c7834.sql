
-- Table to store per-org manual release checks
CREATE TABLE public.release_manual_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  check_key text NOT NULL,
  label text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES public.profiles(id),
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, check_key)
);

ALTER TABLE public.release_manual_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_manual_checks FORCE ROW LEVEL SECURITY;

-- Read: org members only
CREATE POLICY "Org members can view release checks"
  ON public.release_manual_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = release_manual_checks.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Write: admin/pm only via RLS (no direct write grants — use RPC pattern)
-- We allow UPDATE only for toggling checks by admin/pm
CREATE POLICY "Admin/PM can update release checks"
  ON public.release_manual_checks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = release_manual_checks.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = release_manual_checks.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  );

-- Insert: admin/owner only (for seeding)
CREATE POLICY "Admin can insert release checks"
  ON public.release_manual_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = release_manual_checks.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  );

-- Seed default manual checks via RPC
CREATE OR REPLACE FUNCTION public.rpc_ensure_release_checks(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_defaults text[][] := ARRAY[
    ARRAY['stakeholder_signoff', 'Stakeholder sign-off obtained'],
    ARRAY['regression_test', 'Regression testing completed'],
    ARRAY['data_backup', 'Production data backup verified'],
    ARRAY['rollback_plan', 'Rollback plan documented'],
    ARRAY['changelog_updated', 'Changelog / release notes updated'],
    ARRAY['security_review', 'Security review completed']
  ];
  v_item text[];
BEGIN
  -- Verify caller is org member
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization' USING ERRCODE = '42501';
  END IF;

  FOREACH v_item SLICE 1 IN ARRAY v_defaults LOOP
    INSERT INTO release_manual_checks (organization_id, check_key, label)
    VALUES (p_org_id, v_item[1], v_item[2])
    ON CONFLICT (organization_id, check_key) DO NOTHING;
  END LOOP;
END;
$$;
