import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

// ── Types (mirroring RPC return shape) ─────────────────────────────────────

export interface ChangeFeedTopChange {
  project_id: string;
  project_name: string;
  prev_risk: number;
  curr_risk: number;
  risk_change: number;
  prev_margin: number;
  curr_margin: number;
  margin_change: number;
  prev_burn: number;
  curr_burn: number;
  burn_change: number;
  classification: string;
}

export interface ChangeFeedAttentionProject {
  project_id: string;
  project_name: string;
  attention_score: number;
  risk_change: number;
  margin_change: number;
  burn_change: number;
}

export interface ChangeFeedData {
  latest_snapshot_date: string;
  previous_snapshot_date: string;
  new_risks: number;
  resolved_risks: number;
  improving: number;
  worsening: number;
  burn_increases: number;
  top_changes: ChangeFeedTopChange[];
  attention_ranked_projects: ChangeFeedAttentionProject[];
}

/**
 * Canonical query key for rpc_executive_change_feed.
 * ALL consumers must use this key to prevent double-fetching.
 */
export const CHANGE_FEED_QUERY_KEY = "rpc-executive-change-feed";

/**
 * Shared hook for rpc_executive_change_feed.
 * Canonical query key: ["rpc-executive-change-feed", orgId]
 */
export function useExecutiveChangeFeed(orgIdOverride?: string) {
  const { activeOrganizationId } = useOrganization();
  const orgId = orgIdOverride ?? activeOrganizationId;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CHANGE_FEED_QUERY_KEY, orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "rpc_executive_change_feed",
        { p_org_id: orgId! },
      );
      if (error) throw error;
      return data?.latest_snapshot_date ? (data as ChangeFeedData) : null;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [CHANGE_FEED_QUERY_KEY, orgId] });
  }, [queryClient, orgId]);

  return { ...query, refresh };
}
