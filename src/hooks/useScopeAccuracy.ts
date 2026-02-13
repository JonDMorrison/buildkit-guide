import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ScopeAccuracyRow {
  scope_item_id: string;
  scope_item_name: string;
  item_type: string;
  planned_hours: number;
  actual_hours: number;
  delta_hours: number;
  delta_pct: number;
  task_count: number;
  trade_breakdown: { trade_id: string | null; trade_name: string; hours: number }[];
}

export const useScopeAccuracy = (projectId: string | null) => {
  const [rows, setRows] = useState<ScopeAccuracyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setRows([]);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc(
          "project_scope_accuracy" as any,
          { p_project_id: projectId }
        );
        if (err) throw err;
        setRows(
          (data || []).map((r: any) => ({
            scope_item_id: r.scope_item_id,
            scope_item_name: r.scope_item_name,
            item_type: r.item_type,
            planned_hours: Number(r.planned_hours) || 0,
            actual_hours: Number(r.actual_hours) || 0,
            delta_hours: Number(r.delta_hours) || 0,
            delta_pct: Number(r.delta_pct) || 0,
            task_count: Number(r.task_count) || 0,
            trade_breakdown: r.trade_breakdown || [],
          }))
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);

  return { rows, loading, error };
};
