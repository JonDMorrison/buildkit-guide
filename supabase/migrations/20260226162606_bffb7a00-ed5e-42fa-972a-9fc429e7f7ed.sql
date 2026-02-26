
-- Stage 20: Org creation idempotency + duplicate prevention
-- 1) Fix NULL slugs deterministically
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR r IN SELECT id, name FROM public.organizations WHERE slug IS NULL ORDER BY created_at ASC
  LOOP
    -- Derive slug from name
    base_slug := regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(r.name)), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
      ),
      '-{2,}', '-', 'g'
    );
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'org';
    END IF;
    base_slug := left(base_slug, 30);

    candidate := base_slug;
    suffix := 2;
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = candidate AND id <> r.id) LOOP
      candidate := left(base_slug, 26) || '-' || suffix::text;
      suffix := suffix + 1;
    END LOOP;

    UPDATE public.organizations SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 2) Make slug NOT NULL now that all rows have a value
ALTER TABLE public.organizations ALTER COLUMN slug SET NOT NULL;

-- 3) Create the atomic onboarding RPC
CREATE OR REPLACE FUNCTION public.rpc_onboarding_ensure_org(
  p_name TEXT,
  p_slug_base TEXT,
  p_user_id UUID,
  p_timezone TEXT DEFAULT 'America/Toronto',
  p_jurisdiction_code TEXT DEFAULT 'ON'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_org_id UUID;
  v_org_id UUID;
  v_slug TEXT;
  v_candidate TEXT;
  v_suffix INT;
BEGIN
  -- Guard: if user already has an active membership, return that org
  SELECT organization_id INTO v_existing_org_id
  FROM public.organization_memberships
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'org_id', v_existing_org_id,
      'slug', (SELECT slug FROM public.organizations WHERE id = v_existing_org_id),
      'already_existed', true
    );
  END IF;

  -- Sanitize slug base
  v_slug := regexp_replace(
    regexp_replace(
      regexp_replace(lower(trim(p_slug_base)), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ),
    '-{2,}', '-', 'g'
  );
  IF v_slug = '' OR v_slug IS NULL THEN
    v_slug := 'org';
  END IF;
  v_slug := left(v_slug, 30);

  -- Deterministic slug conflict resolution: base, base-2, base-3...
  v_candidate := v_slug;
  v_suffix := 2;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_candidate) LOOP
    v_candidate := left(v_slug, 26) || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  END LOOP;

  -- Create organization
  INSERT INTO public.organizations (name, slug)
  VALUES (trim(p_name), v_candidate)
  RETURNING id INTO v_org_id;

  -- Create membership (admin role)
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (v_org_id, p_user_id, 'admin', true);

  -- Create settings
  INSERT INTO public.organization_settings (organization_id, default_timezone, jurisdiction_code)
  VALUES (v_org_id, p_timezone, p_jurisdiction_code)
  ON CONFLICT (organization_id) DO UPDATE
  SET default_timezone = EXCLUDED.default_timezone,
      jurisdiction_code = EXCLUDED.jurisdiction_code;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'slug', v_candidate,
    'already_existed', false
  );
END;
$$;

-- Grant access
REVOKE ALL ON FUNCTION public.rpc_onboarding_ensure_org FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_onboarding_ensure_org TO authenticated;

COMMENT ON FUNCTION public.rpc_onboarding_ensure_org IS
  'Atomic org onboarding: finds existing membership or creates org+membership+settings in one transaction. '
  'SECURITY DEFINER | pinned search_path | deterministic slug conflict resolution.';
