
-- =============================================================
-- rpc_get_pricing_suggestions
-- Deterministic pricing adjustment suggestions per archetype.
-- No AI — pure historical variance heuristics.
-- =============================================================

CREATE OR REPLACE FUNCTION public.rpc_get_pricing_suggestions(
  p_min_projects int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_suggestions jsonb := '[]'::jsonb;
  v_arch record;
BEGIN
  -- Get user's org (use first org membership)
  SELECT om.organization_id INTO v_org_id
  FROM organization_memberships om
  WHERE om.user_id = v_uid
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization membership' USING ERRCODE = '42501';
  END IF;

  -- Iterate over archetypes belonging to this org
  FOR v_arch IN
    SELECT pa.id, pa.key, pa.label
    FROM project_archetypes pa
    WHERE pa.organization_id = v_org_id
  LOOP
    DECLARE
      v_stats jsonb;
      v_bucket jsonb;
      v_project_count int;
      v_median_overage numeric;
      v_avg_estimate numeric;
      v_avg_actual numeric;
      v_labor_suggest numeric;
      v_material_variance numeric;
      v_material_suggest numeric;
      -- Per-project material breakdown
      v_mat_overrun_count int := 0;
      v_mat_total_projects int := 0;
      v_avg_mat_overage_pct numeric := 0;
    BEGIN
      -- Get margin stats for this archetype
      v_stats := rpc_get_archetype_margin_stats(v_arch.id);

      -- Use the convenience stats (single currency) or first bucket
      v_bucket := COALESCE(
        v_stats->'stats',
        CASE WHEN jsonb_array_length(COALESCE(v_stats->'buckets', '[]'::jsonb)) > 0
             THEN v_stats->'buckets'->0
             ELSE NULL END
      );

      IF v_bucket IS NULL THEN CONTINUE; END IF;

      v_project_count := COALESCE((v_bucket->>'project_count')::int, 0);
      IF v_project_count < p_min_projects THEN CONTINUE; END IF;

      v_median_overage := COALESCE((v_bucket->>'median_overage_pct')::numeric, 0);
      v_avg_estimate := COALESCE((v_bucket->>'avg_estimate_total_cost')::numeric, 0);
      v_avg_actual := COALESCE((v_bucket->>'avg_actual_total_cost')::numeric, 0);

      -- ── Suggestion 1: Labor hours increase ──
      -- If median overage > 10%, suggest increasing labor estimate
      IF v_median_overage > 10 THEN
        -- Suggest increase = median_overage / 2, capped at 25%
        v_labor_suggest := LEAST(25, ROUND((v_median_overage / 2)::numeric, 1));

        v_suggestions := v_suggestions || jsonb_build_object(
          'archetype_key', v_arch.key,
          'archetype_label', v_arch.label,
          'suggestion_type', 'increase_labor_hours',
          'suggested_change', format('+%s%%', v_labor_suggest),
          'suggested_pct', v_labor_suggest,
          'rationale', format(
            'Median cost overage is %s%% across %s completed projects. Increasing labor hour estimates by %s%% would reduce future overruns.',
            v_median_overage, v_project_count, v_labor_suggest
          ),
          'evidence', jsonb_build_object(
            'project_count', v_project_count,
            'median_overage_pct', v_median_overage,
            'avg_estimate_total', v_avg_estimate,
            'avg_actual_total', v_avg_actual
          )
        );
      END IF;

      -- ── Suggestion 2: Material contingency ──
      -- Check material variance across completed projects
      SELECT
        COUNT(*) FILTER (WHERE mat_overage > 0),
        COUNT(*),
        COALESCE(ROUND(AVG(mat_overage_pct)::numeric, 2), 0)
      INTO v_mat_overrun_count, v_mat_total_projects, v_avg_mat_overage_pct
      FROM (
        SELECT
          p.id,
          COALESCE((rpc_get_project_cost_rollup(p.id)->>'actual_material_cost')::numeric, 0) AS actual_mat,
          COALESCE(e.planned_material_cost, 0) AS est_mat,
          COALESCE((rpc_get_project_cost_rollup(p.id)->>'actual_material_cost')::numeric, 0)
            - COALESCE(e.planned_material_cost, 0) AS mat_overage,
          CASE WHEN COALESCE(e.planned_material_cost, 0) > 0
            THEN ROUND((
              (COALESCE((rpc_get_project_cost_rollup(p.id)->>'actual_material_cost')::numeric, 0) - e.planned_material_cost)
              / e.planned_material_cost * 100
            )::numeric, 2)
            ELSE 0 END AS mat_overage_pct
        FROM projects p
        LEFT JOIN LATERAL (
          SELECT * FROM estimates WHERE project_id = p.id AND status = 'approved'
          ORDER BY updated_at DESC LIMIT 1
        ) e ON true
        WHERE p.archetype_id = v_arch.id
          AND p.status = 'completed'
          AND e.id IS NOT NULL
          AND COALESCE(e.planned_material_cost, 0) > 0
      ) sub;

      -- If >60% of projects had material overruns AND avg overrun > 5%
      IF v_mat_total_projects >= p_min_projects
         AND v_mat_overrun_count > (v_mat_total_projects * 0.6)
         AND v_avg_mat_overage_pct > 5 THEN

        v_material_suggest := LEAST(25, ROUND((v_avg_mat_overage_pct / 2)::numeric, 1));

        v_suggestions := v_suggestions || jsonb_build_object(
          'archetype_key', v_arch.key,
          'archetype_label', v_arch.label,
          'suggestion_type', 'add_material_contingency',
          'suggested_change', format('+%s%% contingency', v_material_suggest),
          'suggested_pct', v_material_suggest,
          'rationale', format(
            '%s of %s completed projects (%s%%) had material cost overruns averaging %s%%. Adding a %s%% material contingency is recommended.',
            v_mat_overrun_count, v_mat_total_projects,
            ROUND((v_mat_overrun_count::numeric / v_mat_total_projects * 100)::numeric, 0),
            v_avg_mat_overage_pct, v_material_suggest
          ),
          'evidence', jsonb_build_object(
            'projects_with_material_overrun', v_mat_overrun_count,
            'total_projects_with_materials', v_mat_total_projects,
            'avg_material_overage_pct', v_avg_mat_overage_pct
          )
        );
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'min_projects_threshold', p_min_projects,
    'suggestions', v_suggestions,
    'suggestion_count', jsonb_array_length(v_suggestions)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_pricing_suggestions(int) TO authenticated;
