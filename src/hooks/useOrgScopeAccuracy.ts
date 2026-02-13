import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface OrgScopeRow {
  normalized_name: string;
  project_count: number;
  total_planned_hours: number;
  total_actual_hours: number;
  avg_delta_pct: number;
  worst_project_name: string;
  worst_delta_pct: number;
}

export const useOrgScopeAccuracy = (weeks = 12) => {
  const { activeOrganizationId } = useOrganization();
  const [rows, setRows] = useState<OrgScopeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrganizationId) {
      setRows([]);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc(
          "org_scope_accuracy" as any,
          { p_org_id: activeOrganizationId, p_weeks: weeks }
        );
        if (err) throw err;
        setRows(
          (data || []).map((r: any) => ({
            normalized_name: r.normalized_name,
            project_count: Number(r.project_count) || 0,
            total_planned_hours: Number(r.total_planned_hours) || 0,
            total_actual_hours: Number(r.total_actual_hours) || 0,
            avg_delta_pct: Number(r.avg_delta_pct) || 0,
            worst_project_name: r.worst_project_name || "",
            worst_delta_pct: Number(r.worst_delta_pct) || 0,
          }))
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [activeOrganizationId, weeks]);

  return { rows, loading, error };
};
