import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

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
      const { data, error } = await (supabase as any).rpc(
        "rpc_data_quality_audit",
        { p_org_id: orgId! },
      );
      if (error) throw error;
      return data as any;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
