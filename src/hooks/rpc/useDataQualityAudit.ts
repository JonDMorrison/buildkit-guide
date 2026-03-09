import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface QualityIssue {
  category?: string;
  type?: string;
  message?: string;
}

export interface QualityAuditRow {
  project_id: string;
  project_name: string;
  issue_count?: number;
  issues?: (string | QualityIssue)[];
}

/**
 * Shared hook for rpc_data_quality_audit.
 * Canonical query key: ["rpc-data-quality-audit", orgId]
 */
export function useDataQualityAudit(orgIdOverride?: string) {
  const { activeOrganizationId } = useOrganization();
  const orgId = orgIdOverride ?? activeOrganizationId;

  return useQuery({
    queryKey: ["rpc-data-quality-audit", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_data_quality_audit" as any,
        { p_org_id: orgId! },
      );
      if (error) throw error;
      return data as QualityAuditRow[] | null;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
