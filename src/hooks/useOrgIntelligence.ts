import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

export interface TradePerformance {
  trade: string;
  projects_worked: number;
  variance_pct: number;
  reliability_score: number;
  signal: "over_budget" | "on_track" | "under_budget";
  insight: string;
}

export interface JobTypeRisk {
  job_type: string;
  project_count: number;
  avg_margin: number | null;
  risk_level: "low" | "medium" | "high";
  deficiencies_per_project: number;
  insight: string;
}

export interface DeficiencyPattern {
  trade: string;
  total_deficiencies: number;
  projects_affected: number;
  avg_resolution_hours: number | null;
  insight: string;
}

export interface TopInsight {
  title: string;
  description: string;
  category: "trade" | "job_type" | "deficiency" | "financial";
  priority: "high" | "medium" | "low";
}

export interface OrgHealth {
  total_projects: number;
  active_projects: number;
  avg_margin: number;
  task_completion_rate: number;
  blocker_resolution_rate: number;
}

export interface OrgIntelligence {
  generated_at: string;
  org_health: OrgHealth;
  trade_performance: TradePerformance[];
  job_type_risks: JobTypeRisk[];
  deficiency_patterns: DeficiencyPattern[];
  top_insights: TopInsight[];
  data_quality_note: string;
}

export function useOrgIntelligence() {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();

  return useQuery({
    queryKey: ["org-intelligence", activeOrganizationId],
    queryFn: async (): Promise<OrgIntelligence> => {
      const { data, error } = await supabase.functions.invoke(
        "org-intelligence",
        { body: { org_id: activeOrganizationId } }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as OrgIntelligence;
    },
    enabled: !!activeOrganizationId && !!user,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 1,
  });
}
