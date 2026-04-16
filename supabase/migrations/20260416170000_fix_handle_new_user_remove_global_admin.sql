-- Fix handle_new_user trigger to stop granting global admin role on signup.
-- Previously inserted into user_roles(role='admin') for every new user,
-- directly undoing cross-tenant RLS security fixes from today.
-- New users get org-scoped admin via organization_memberships(role='admin') only.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_id uuid;
  org_name text;
  org_slug text;
  base_slug text;
  counter int := 0;
  test_slug text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  -- Determine org name from signup metadata
  org_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'company_name'), ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Organization'
  );

  -- Generate unique slug
  base_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF length(base_slug) < 3 THEN base_slug := 'org'; END IF;
  base_slug := left(base_slug, 40);

  test_slug := base_slug || '-' || substr(md5(NEW.id::text), 1, 8);
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = test_slug);
    counter := counter + 1;
    test_slug := base_slug || '-' || substr(md5(NEW.id::text || counter::text), 1, 8);
  END LOOP;
  org_slug := test_slug;

  -- Create organization
  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO org_id;

  -- Grant org-scoped admin membership (tenant-scoped, not global)
  INSERT INTO public.organization_memberships (user_id, organization_id, role, is_active)
  VALUES (NEW.id, org_id, 'admin', true)
  ON CONFLICT DO NOTHING;

  -- NOTE: We intentionally do NOT insert into user_roles here.
  -- Global admin via user_roles bypasses tenant isolation.
  -- Org-level admin via organization_memberships is sufficient and safe.

  RETURN NEW;
END;
$function$;
