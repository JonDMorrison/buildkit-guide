-- Add company_name support to the signup flow.
--
-- The signup form now collects company_name and passes it via
-- supabase.auth.signUp options.data as `company_name`. It lands in
-- auth.users.raw_user_meta_data->>'company_name'.
--
-- This migration updates handle_new_user() to:
--   1. Use company_name (if provided) as the org name directly, falling back
--      to "<full_name>'s Organization" for any existing users who signed up
--      before this field existed.
--   2. Generate the slug from company_name rather than full_name so the slug
--      reflects the actual business (e.g. "acme-construction-a1b2c3d4").

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
  --    Prefer company_name; fall back to "<full_name>'s Organization" so that
  --    users who signed up before this field existed still get a sensible name.
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

  -- 5. Make the new user an admin of their org
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'admin', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
