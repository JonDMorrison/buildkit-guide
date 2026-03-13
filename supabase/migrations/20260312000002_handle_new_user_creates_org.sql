-- Fix: self-signup users had no organization or role after signup, causing a
-- permission loop on the dashboard (RoleGate denied access, fallback routed back
-- to dashboard, 404/loop).
--
-- Solution: extend handle_new_user() to also create a personal organization and
-- an organization_memberships row with role 'admin'. Self-signup users are the
-- owner of their own org. Invited users already get memberships via the invite
-- flow, so we guard with ON CONFLICT DO NOTHING.

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
  -- 1. Create the profile row (unchanged from original)
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

  -- 3. Create a personal organization for self-signup users
  INSERT INTO public.organizations (name)
  VALUES (user_name || '''s Organization')
  RETURNING id INTO new_org_id;

  -- 4. Make the new user an admin of that org
  --    ON CONFLICT DO NOTHING guards against invited users who may already have
  --    a membership created by the invite flow before the trigger fires.
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'admin', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
