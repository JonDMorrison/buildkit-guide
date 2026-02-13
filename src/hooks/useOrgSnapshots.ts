import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface OrgSnapshot {
  id: string;
  organization_id: string;
  snapshot_date: string;
  snapshot_period: string;
  total_contract_value: number;
  total_planned_cost: number;
  total_actual_cost: number;
  total_invoiced_strict: number;
  total_profit_actual: number;
  weighted_margin_pct_actual: number;
  projects_count: number;
  projects_with_budget_count: number;
  projects_missing_budget_count: number;
  projects_over_budget_count: number;
  created_at: string;
}

export const useOrgSnapshots = (dateFrom?: string, dateTo?: string) => {
  const { activeOrganizationId } = useOrganization();
  const [snapshots, setSnapshots] = useState<OrgSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!activeOrganizationId) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    let query = supabase
      .from("org_financial_snapshots")
      .select("*")
      .eq("organization_id", activeOrganizationId)
      .eq("snapshot_period", "weekly")
      .order("snapshot_date", { ascending: true });

    if (dateFrom) query = query.gte("snapshot_date", dateFrom);
    if (dateTo) query = query.lte("snapshot_date", dateTo);

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
      setSnapshots([]);
    } else {
      setSnapshots((data as OrgSnapshot[]) || []);
    }
    setLoading(false);
  }, [activeOrganizationId, dateFrom, dateTo]);

  useEffect(() => { fetch(); }, [fetch]);

  return { snapshots, loading, error, refetch: fetch };
};
