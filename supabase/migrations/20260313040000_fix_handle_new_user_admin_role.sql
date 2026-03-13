-- Fix: handle_new_user() must also insert into user_roles so new org creators
-- receive the global admin role. Without this, pages like Playbooks and Users
-- show "Limited Access" and the setup wizard is inaccessible because those
-- pages gate on user_roles, not organization_memberships.
--
-- Root cause: the trigger creates the org and inserts into organization_memberships
-- with role='admin' but never touches user_roles. The app's useUserRole hook reads
-- user_roles; useOrganizationRole reads organization_memberships. Pages that only
-- check useUserRole (or useAuthRole before the org-role fix) saw no admin entry.
--
-- Also backfills any existing org creator who has organization_memberships.role = 'admin'
-- but no corresponding user_roles row (e.g. chantel@grminc.ca and similar accounts).

-- ── 1. Replace handle_new_user with the admin user_roles insert ──────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id  uuid;
  company     text;
  org_name    text;
  slug_base   text;
  org_slug    text;
BEGIN
  -- 1. Create the profile row
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- 2. Resolve org name
  --    Prefer company_name; fall back to "<full_name>'s Organization".
  company := NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), '');

  IF company IS NOT NULL THEN
    org_name  := company;
    slug_base := company;
  ELSE
    slug_base := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    );
    org_name := slug_base || '''s Organization';
  END IF;

  -- 3. Generate a unique slug: lowercase alphanum + hyphens + 8-char uuid suffix
  org_slug := lower(regexp_replace(slug_base, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-'
              || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- 4. Create the organization
  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  -- 5. Make the new user an org-level admin
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'admin', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- 6. Grant the global admin role so all user_roles-gated pages and hooks pass
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- ── 2. Backfill existing accounts ────────────────────────────────────────────
-- Give admin role to any user who is an active org admin in
-- organization_memberships but has no matching user_roles entry.
-- This fixes chantel@grminc.ca and any other accounts in the same situation.

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT om.user_id, 'admin'::public.app_role
FROM public.organization_memberships om
WHERE om.role = 'admin'
  AND om.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = om.user_id
      AND ur.role = 'admin'
  )
ON CONFLICT (user_id, role) DO NOTHING;
