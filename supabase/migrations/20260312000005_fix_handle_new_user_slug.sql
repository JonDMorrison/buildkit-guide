-- Fix: organizations.slug was made NOT NULL by a later migration but
-- handle_new_user() was inserting without a slug, causing:
--   "null value in column slug of relation organizations violates not-null constraint"
--
-- Solution: generate a unique slug from the user's name/email + a short UUID
-- fragment. Format: <normalized-name>-<8-hex-chars>
-- e.g. "jon-morrison-a1b2c3d4"

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  user_name  text;
  org_slug   text;
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
    split_part(NEW.email, '@', 1)
  );

  -- 3. Generate a unique slug: lowercase alphanum + hyphens + 8-char uuid suffix
  org_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-'
              || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  -- 4. Create a personal organization
  INSERT INTO public.organizations (name, slug)
  VALUES (user_name || '''s Organization', org_slug)
  RETURNING id INTO new_org_id;

  -- 5. Make the new user an admin of their org
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (new_org_id, NEW.id, 'admin', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
