import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface SnapshotCoverageRow {
  project_id: string;
  project_name: string;
  snapshot_count: number;
  latest_snapshot: string | null;
  oldest_snapshot: string | null;
  coverage_days: number;
  has_gap: boolean;
}

export interface SnapshotCoverageData {
  total_projects: number;
  covered_projects: number;
  coverage_percent: number;
  projects: SnapshotCoverageRow[];
}

/**
 * Shared hook for rpc_snapshot_coverage_report.
 * Canonical query key: ["rpc-snapshot-coverage", orgId]
 */
export function useSnapshotCoverageReport(orgIdOverride?: string) {
  const { activeOrganizationId } = useOrganization();
  const orgId = orgIdOverride ?? activeOrganizationId;

  return useQuery({
    queryKey: ["rpc-snapshot-coverage", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "rpc_snapshot_coverage_report",
        { p_org_id: orgId! },
      );
      if (error) throw error;
      const parsed = data as SnapshotCoverageData | null;
      return parsed ? { ...parsed, projects: parsed.projects ?? [] } : null;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
