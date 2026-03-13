-- Fix: two bugs were causing "Database error saving new user":
--
-- Bug 1: Migration 20260312000003 added `SET LOCAL row_security = off` which
--   throws "permission denied to set parameter 'row_security'" in Supabase's
--   managed Postgres because the postgres role is not a true superuser.
--   SECURITY DEFINER + postgres ownership already provides BYPASSRLS implicitly
--   (proven by the original profile insert working without any RLS policy).
--   Removing SET LOCAL row_security = off fixes this.
--
-- Bug 2: Inserting into organizations fires the on_organization_created trigger
--   which calls handle_new_organization(). An older version of that function
--   tries to insert auth.uid() (NULL inside a trigger context) into
--   organization_memberships.user_id which is NOT NULL — causing a constraint
--   violation. We re-deploy handle_new_organization() here with the null guard
--   to ensure it is live in production.

-- Step 1: Fix handle_new_user — remove SET LOCAL row_security = off,
--   keep SECURITY DEFINER + postgres ownership for BYPASSRLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  user_name  text;
BEGIN
  -- 1. Create the profile row
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- 2. Derive a display name for the org
  user_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NEW.email
  );

  -- 3. Create a personal organization.
  --    Note: this fires the on_organization_created trigger which calls
  --    handle_new_organization(). That function will skip the membership insert
  --    because auth.uid() is NULL here (trigger context). We insert the
  --    membership explicitly in step 4.
  INSERT INTO public.organizations (name)
  VALUES (user_name || '''s Organization')
  RETURNING id INTO new_org_id;

  -- 4. Make the new user an admin of their org.
  --    ON CONFLICT DO NOTHING handles the case where handle_new_organization()
  --    already inserted it (if auth.uid() happened to be set).
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'admin', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure the function is owned by postgres so SECURITY DEFINER runs with
-- BYPASSRLS (same as the original handle_new_user that successfully inserted
-- profiles despite profiles having no INSERT RLS policy).
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Step 2: Re-deploy handle_new_organization with the null guard to prevent it
--   from attempting to insert auth.uid() = NULL into user_id NOT NULL.
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create organization settings
  INSERT INTO public.organization_settings (organization_id, time_tracking_enabled)
  VALUES (NEW.id, false)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Add the creator as admin only when called from an authenticated session.
  -- When called from the handle_new_user trigger, auth.uid() is NULL — skip it.
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.organization_memberships (user_id, organization_id, role, is_active)
    VALUES (auth.uid(), NEW.id, 'admin', true)
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_organization() OWNER TO postgres;
