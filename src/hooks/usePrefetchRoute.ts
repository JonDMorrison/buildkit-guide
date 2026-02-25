import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { CHANGE_FEED_QUERY_KEY } from '@/hooks/rpc/useExecutiveChangeFeed';

/**
 * Prefetch map: route → query keys + queryFns to warm.
 * Only warms critical top-fold data; respects existing staleTime.
 */
const ROUTE_PREFETCH_MAP: Record<string, string[]> = {
  '/executive': ['rpc-executive-change-feed', 'rpc_snapshot_coverage_report', 'rpc_data_quality_audit'],
  '/dashboard': ['rpc-executive-change-feed'],
  '/insights': [],  // Insights uses custom hooks; no simple RPC to prefetch
};

/**
 * Returns a prefetch handler for a given route.
 * - Throttled: each (route, orgId) pair fires at most once per session.
 * - Gated: does nothing without orgId.
 * - Uses existing RPC queryFns so query keys are consistent.
 */
export function usePrefetchRoute() {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganization();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetchRoute = useCallback(
    (route: string) => {
      if (!activeOrganizationId) return;

      const throttleKey = `${route}:${activeOrganizationId}`;
      if (prefetchedRef.current.has(throttleKey)) return;
      prefetchedRef.current.add(throttleKey);

      const rpcs = ROUTE_PREFETCH_MAP[route];
      if (!rpcs || rpcs.length === 0) return;

      for (const rpc of rpcs) {
        const queryKey = rpcToQueryKey(rpc, activeOrganizationId);
        const queryFn = rpcToQueryFn(rpc, activeOrganizationId);
        if (queryKey && queryFn) {
          queryClient.prefetchQuery({
            queryKey,
            queryFn,
            staleTime: 10 * 60 * 1000,
          });
        }
      }

      // Also preload the lazy route module
      preloadRouteModule(route);
    },
    [activeOrganizationId, queryClient],
  );

  return { prefetchRoute };
}

/** Map RPC name → react-query key (must match shared hooks) */
function rpcToQueryKey(rpc: string, orgId: string): string[] | null {
  switch (rpc) {
    case 'rpc-executive-change-feed':
      return [CHANGE_FEED_QUERY_KEY, orgId];
    case 'rpc_snapshot_coverage_report':
      return ['rpc-snapshot-coverage', orgId];
    case 'rpc_data_quality_audit':
      return ['rpc-data-quality-audit', orgId];
    default:
      return null;
  }
}

/** Map RPC name → queryFn (reuses existing RPC calls) */
function rpcToQueryFn(rpc: string, orgId: string): (() => Promise<any>) | null {
  switch (rpc) {
    case 'rpc-executive-change-feed':
      return async () => {
        const { data, error } = await (supabase as any).rpc('rpc_executive_change_feed', { p_org_id: orgId });
        if (error) throw error;
        return data?.latest_snapshot_date ? data : null;
      };
    case 'rpc_snapshot_coverage_report':
      return async () => {
        const { data, error } = await (supabase as any).rpc('rpc_snapshot_coverage_report', { p_org_id: orgId });
        if (error) throw error;
        return data;
      };
    case 'rpc_data_quality_audit':
      return async () => {
        const { data, error } = await (supabase as any).rpc('rpc_data_quality_audit', { p_org_id: orgId });
        if (error) throw error;
        return data;
      };
    default:
      return null;
  }
}

/** Preload React.lazy route modules */
function preloadRouteModule(route: string) {
  switch (route) {
    case '/executive':
      import('@/pages/ExecutiveDashboard');
      break;
    case '/dashboard':
      import('@/pages/Dashboard');
      break;
    case '/insights':
      import('@/pages/Insights');
      break;
  }
}
