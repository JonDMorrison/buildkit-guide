import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectSnapshot {
  id: string;
  organization_id: string;
  project_id: string;
  snapshot_date: string;
  snapshot_period: string;
  status: string | null;
  has_budget: boolean;
  contract_value: number;
  planned_labor_hours: number;
  planned_labor_cost: number;
  planned_material_cost: number;
  planned_machine_cost: number;
  planned_other_cost: number;
  planned_total_cost: number;
  actual_labor_hours: number;
  actual_labor_cost: number;
  actual_material_cost: number;
  actual_machine_cost: number;
  actual_other_cost: number;
  actual_unclassified_cost: number;
  actual_total_cost: number;
  invoiced_amount_strict: number;
  invoiced_amount_relaxed: number;
  actual_profit: number;
  actual_margin_pct: number;
  planned_profit: number;
  planned_margin_pct: number;
  labor_hours_missing_cost_rate: number;
  labor_hours_missing_membership: number;
  created_at: string;
}

export const useProjectSnapshots = (projectId: string | null) => {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("project_financial_snapshots")
      .select("*")
      .eq("project_id", projectId)
      .eq("snapshot_period", "weekly")
      .order("snapshot_date", { ascending: true });

    if (err) {
      setError(err.message);
      setSnapshots([]);
    } else {
      setSnapshots((data as ProjectSnapshot[]) || []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { snapshots, loading, error, refetch: fetch };
};
