
-- =============================================================
-- project_archetypes table + projects.archetype_id
-- =============================================================

CREATE TABLE IF NOT EXISTS public.project_archetypes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  key text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_project_archetypes_org ON public.project_archetypes(organization_id);

ALTER TABLE public.project_archetypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_archetypes FORCE ROW LEVEL SECURITY;

CREATE POLICY "pa_select" ON public.project_archetypes
  FOR SELECT USING (public.has_org_membership(organization_id));

CREATE POLICY "pa_insert" ON public.project_archetypes
  FOR INSERT WITH CHECK (public.org_role(organization_id) IN ('admin','pm'));
CREATE POLICY "pa_update" ON public.project_archetypes
  FOR UPDATE USING (public.org_role(organization_id) IN ('admin','pm'));
CREATE POLICY "pa_delete" ON public.project_archetypes
  FOR DELETE USING (public.org_role(organization_id) IN ('admin','pm'));

CREATE TRIGGER update_project_archetypes_updated_at
  BEFORE UPDATE ON public.project_archetypes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add archetype_id to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archetype_id uuid NULL REFERENCES public.project_archetypes(id);

CREATE INDEX IF NOT EXISTS idx_projects_archetype ON public.projects(archetype_id);

-- =============================================================
-- rpc_get_archetype_margin_stats
-- =============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_archetype_margin_stats(p_archetype_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arch record;
  v_org_base_currency text;
  v_buckets jsonb := '[]'::jsonb;
  v_bucket record;
  v_mixed_currencies boolean := false;
  v_currency_count int;
BEGIN
  SELECT pa.*, o.base_currency
  INTO v_arch
  FROM project_archetypes pa
  JOIN organizations o ON o.id = pa.organization_id
  WHERE pa.id = p_archetype_id;

  IF v_arch IS NULL THEN
    RAISE EXCEPTION 'Archetype not found' USING ERRCODE = '42501';
  END IF;
  IF NOT has_org_membership(v_arch.organization_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_org_base_currency := v_arch.base_currency;

  SELECT COUNT(DISTINCT p.currency) INTO v_currency_count
  FROM projects p
  WHERE p.archetype_id = p_archetype_id AND p.status = 'completed';

  v_mixed_currencies := v_currency_count > 1;

  FOR v_bucket IN
    WITH completed AS (
      SELECT p.id AS project_id, p.currency,
        e.planned_total_cost AS estimate_total,
        e.planned_material_cost AS est_material,
        e.planned_machine_cost AS est_machine,
        e.planned_other_cost AS est_other,
        e.contract_value AS revenue
      FROM projects p
      LEFT JOIN LATERAL (
        SELECT * FROM estimates WHERE project_id = p.id AND status = 'approved'
        ORDER BY updated_at DESC LIMIT 1
      ) e ON true
      WHERE p.archetype_id = p_archetype_id AND p.status = 'completed' AND e.id IS NOT NULL
    ),
    with_actuals AS (
      SELECT c.*,
        (SELECT COALESCE((rpc_get_project_cost_rollup(c.project_id)->>'actual_total_cost')::numeric, 0)) AS actual_total
      FROM completed c
    ),
    with_margin AS (
      SELECT wa.*,
        CASE WHEN wa.revenue > 0 THEN ROUND(((wa.revenue - wa.actual_total) / wa.revenue * 100)::numeric, 2) ELSE NULL END AS margin_pct,
        CASE WHEN wa.estimate_total > 0 THEN ROUND(((wa.actual_total - wa.estimate_total) / wa.estimate_total * 100)::numeric, 2) ELSE NULL END AS overage_pct
      FROM with_actuals wa
    )
    SELECT
      wm.currency,
      COUNT(*)::int AS project_count,
      ROUND(AVG(wm.estimate_total)::numeric, 2) AS avg_estimate_total_cost,
      ROUND(AVG(wm.actual_total)::numeric, 2) AS avg_actual_total_cost,
      ROUND(AVG(wm.margin_pct)::numeric, 2) AS avg_margin,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wm.overage_pct)::numeric, 2) AS median_overage_pct,
      'labor' AS top_overrun_driver
    FROM with_margin wm
    GROUP BY wm.currency
  LOOP
    v_buckets := v_buckets || jsonb_build_object(
      'currency', v_bucket.currency,
      'project_count', v_bucket.project_count,
      'avg_estimate_total_cost', v_bucket.avg_estimate_total_cost,
      'avg_actual_total_cost', v_bucket.avg_actual_total_cost,
      'avg_margin', v_bucket.avg_margin,
      'median_overage_pct', v_bucket.median_overage_pct,
      'top_overrun_driver', v_bucket.top_overrun_driver
    );
  END LOOP;

  RETURN jsonb_build_object(
    'archetype_id', p_archetype_id,
    'archetype_key', v_arch.key,
    'archetype_label', v_arch.label,
    'org_base_currency', v_org_base_currency,
    'mixed_currencies', v_mixed_currencies,
    'buckets', v_buckets,
    'stats', CASE
      WHEN NOT v_mixed_currencies AND jsonb_array_length(v_buckets) = 1 THEN v_buckets->0
      WHEN jsonb_array_length(v_buckets) = 0 THEN NULL
      ELSE NULL
    END,
    'flags', jsonb_build_object(
      'mixed_currencies', v_mixed_currencies,
      'no_completed_projects', jsonb_array_length(v_buckets) = 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_archetype_margin_stats(uuid) TO authenticated;
