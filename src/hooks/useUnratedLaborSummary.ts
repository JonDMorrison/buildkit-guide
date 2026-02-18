import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnratedLaborDetail {
  user_id: string;
  user_name: string;
  hours: number;
  entries_count: number;
  reason: "missing_rate" | "currency_mismatch" | "invalid_rate";
}

export interface UnratedLaborSummary {
  unrated_hours: number;
  unrated_entries_count: number;
  currency_mismatch_hours: number;
  currency_mismatch_count: number;
  missing_cost_rates_count: number;
  details: UnratedLaborDetail[];
}

const emptySummary: UnratedLaborSummary = {
  unrated_hours: 0,
  unrated_entries_count: 0,
  currency_mismatch_hours: 0,
  currency_mismatch_count: 0,
  missing_cost_rates_count: 0,
  details: [],
};

export function useUnratedLaborSummary(projectId?: string | null) {
  return useQuery({
    queryKey: ["unrated-labor-summary", projectId ?? "org"],
    queryFn: async (): Promise<UnratedLaborSummary> => {
      const { data, error } = await supabase.rpc("rpc_get_unrated_labor_summary", {
        p_project_id: projectId ?? null,
      });
      if (error) {
        console.error("Failed to fetch unrated labor summary:", error);
        return emptySummary;
      }
      const d = data as any;
      return {
        unrated_hours: d?.unrated_hours ?? 0,
        unrated_entries_count: d?.unrated_entries_count ?? 0,
        currency_mismatch_hours: d?.currency_mismatch_hours ?? 0,
        currency_mismatch_count: d?.currency_mismatch_count ?? 0,
        missing_cost_rates_count: d?.missing_cost_rates_count ?? 0,
        details: d?.details ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
