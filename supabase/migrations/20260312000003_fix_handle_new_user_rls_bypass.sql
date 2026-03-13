-- Fix: handle_new_user() was failing with "Database error saving new user" because
-- the organizations table has RLS enabled with no INSERT policy. SECURITY DEFINER
-- alone does not bypass RLS — we must explicitly disable row security inside the
-- function body so the trigger can insert into organizations and
-- organization_memberships without a matching RLS policy.

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
  -- Disable RLS for this function execution (SECURITY DEFINER runs as the
  -- defining role but RLS is still evaluated unless explicitly bypassed).
  SET LOCAL row_security = off;

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

  -- 3. Create a personal organization for self-signup users
  INSERT INTO public.organizations (name)
  VALUES (user_name || '''s Organization')
  RETURNING id INTO new_org_id;

  -- 4. Make the new user an admin of that org
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'admin', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
