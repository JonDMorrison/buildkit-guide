-- =============================================
-- MULTI-ORG ARCHITECTURE MIGRATION (Fixed)
-- =============================================

-- A. NEW TABLES
-- ---------------------------------------------

-- 1. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Organization memberships table
CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'internal_worker',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id),
  CONSTRAINT valid_org_role CHECK (role IN ('admin', 'hr', 'pm', 'foreman', 'internal_worker', 'external_trade'))
);

-- 3. Organization settings table
CREATE TABLE public.organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  time_tracking_enabled boolean NOT NULL DEFAULT false,
  default_timezone text NOT NULL DEFAULT 'America/Vancouver',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- B. LINK PROJECTS TO ORGANIZATIONS
-- ---------------------------------------------

-- Add nullable organization_id column to projects
ALTER TABLE public.projects 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- C. HELPER FUNCTIONS (Security Definer)
-- ---------------------------------------------

-- Check if user is member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND is_active = true
  )
$$;

-- Check if user is admin of an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = 'admin'
      AND is_active = true
  )
$$;

-- Get user's organizations
CREATE OR REPLACE FUNCTION public.get_user_organizations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_memberships
  WHERE user_id = _user_id
    AND is_active = true
$$;

-- D. BACKFILL - Create Default Organization
-- ---------------------------------------------

-- Create default organization with explicit UUID cast
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Default Organization', 'default');

-- Create settings for default organization
INSERT INTO public.organization_settings (organization_id)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid);

-- Assign all existing projects to default organization
UPDATE public.projects 
SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
ALTER TABLE public.projects 
ALTER COLUMN organization_id SET NOT NULL;

-- E. BACKFILL - Create Organization Memberships
-- ---------------------------------------------

-- Insert org memberships for all users in project_members
INSERT INTO public.organization_memberships (organization_id, user_id, role)
SELECT DISTINCT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  pm.user_id,
  CASE 
    WHEN ur.role::text = 'admin' THEN 'admin'
    WHEN ur.role::text = 'project_manager' THEN 'pm'
    WHEN ur.role::text = 'foreman' THEN 'foreman'
    WHEN ur.role::text = 'internal_worker' THEN 'internal_worker'
    WHEN ur.role::text = 'external_trade' THEN 'external_trade'
    WHEN ur.role::text = 'accounting' THEN 'hr'
    ELSE 'internal_worker'
  END
FROM public.project_members pm
LEFT JOIN public.user_roles ur ON ur.user_id = pm.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_memberships om 
  WHERE om.user_id = pm.user_id 
    AND om.organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- Also add users from user_roles who might not be in project_members
INSERT INTO public.organization_memberships (organization_id, user_id, role)
SELECT DISTINCT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  ur.user_id,
  CASE 
    WHEN ur.role::text = 'admin' THEN 'admin'
    WHEN ur.role::text = 'project_manager' THEN 'pm'
    WHEN ur.role::text = 'foreman' THEN 'foreman'
    WHEN ur.role::text = 'internal_worker' THEN 'internal_worker'
    WHEN ur.role::text = 'external_trade' THEN 'external_trade'
    WHEN ur.role::text = 'accounting' THEN 'hr'
    ELSE 'internal_worker'
  END
FROM public.user_roles ur
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_memberships om 
  WHERE om.user_id = ur.user_id 
    AND om.organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- F. RLS POLICIES
-- ---------------------------------------------

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Organizations policies
CREATE POLICY "Users can view orgs they belong to"
ON public.organizations
FOR SELECT
USING (is_org_member(auth.uid(), id));

CREATE POLICY "Org admins can update their org"
ON public.organizations
FOR UPDATE
USING (is_org_admin(auth.uid(), id));

-- Organization memberships policies
CREATE POLICY "Users can view memberships in their orgs"
ON public.organization_memberships
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert memberships"
ON public.organization_memberships
FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can update memberships"
ON public.organization_memberships
FOR UPDATE
USING (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete memberships"
ON public.organization_memberships
FOR DELETE
USING (is_org_admin(auth.uid(), organization_id));

-- Organization settings policies
CREATE POLICY "Org members can view settings"
ON public.organization_settings
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can update settings"
ON public.organization_settings
FOR UPDATE
USING (is_org_admin(auth.uid(), organization_id));

-- G. UPDATE TRIGGER FOR organization_settings
-- ---------------------------------------------

CREATE TRIGGER update_organization_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- H. INDEXES FOR PERFORMANCE
-- ---------------------------------------------

CREATE INDEX idx_organization_memberships_user_id ON public.organization_memberships(user_id);
CREATE INDEX idx_organization_memberships_org_id ON public.organization_memberships(organization_id);
CREATE INDEX idx_projects_organization_id ON public.projects(organization_id);