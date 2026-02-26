
-- Stage 20 hardening: auth validation, slug retry, membership idempotency
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
  v_max_attempts CONSTANT INT := 50;
  v_attempt INT := 0;
BEGIN
  -- CRITICAL: Validate caller identity — prevent privilege escalation
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: p_user_id must match authenticated user'
      USING ERRCODE = '42501';
  END IF;

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

  -- Deterministic slug conflict resolution with retry on unique_violation
  v_candidate := v_slug;
  v_suffix := 2;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique slug after % attempts', v_max_attempts
        USING ERRCODE = 'P0001';
    END IF;

    BEGIN
      INSERT INTO public.organizations (name, slug)
      VALUES (trim(p_name), v_candidate)
      RETURNING id INTO v_org_id;

      -- Insert succeeded — break out of loop
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        -- Slug already taken (race condition or pre-existing)
        -- Advance to next deterministic candidate
        v_candidate := left(v_slug, 26) || '-' || v_suffix::text;
        v_suffix := v_suffix + 1;
    END;
  END LOOP;

  -- Create membership — idempotent via ON CONFLICT
  INSERT INTO public.organization_memberships (organization_id, user_id, role, is_active)
  VALUES (v_org_id, p_user_id, 'admin', true)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Create settings — already idempotent via ON CONFLICT
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

COMMENT ON FUNCTION public.rpc_onboarding_ensure_org IS
  'Atomic org onboarding: validates auth.uid(), finds existing membership or creates org+membership+settings. '
  'Handles slug collisions via deterministic retry (base, base-2, base-3... up to 50 attempts). '
  'SECURITY DEFINER | pinned search_path | membership ON CONFLICT DO NOTHING.';
