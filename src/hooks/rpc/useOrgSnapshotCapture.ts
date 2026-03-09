import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook for rpc_capture_org_economic_snapshots.
 * Provides a standardized way to trigger organization-wide snapshot captures.
 */
export function useOrgSnapshotCapture(orgId: string, onResolve?: () => Promise<void>) {
  const [isCapturing, setIsCapturing] = useState(false);

  const capture = useCallback(async () => {
    if (!orgId) return;
    
    setIsCapturing(true);
    try {
      // Cast for type safety with dynamically generated client
      const dbRpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const { error } = await dbRpc(
        'rpc_capture_org_economic_snapshots',
        { p_org_id: orgId, p_force: true },
      );

      if (error) throw new Error(error.message);
      
      if (onResolve) {
        await onResolve();
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error('Capture error:', e.message);
        throw e;
      }
    } finally {
      setIsCapturing(false);
    }
  }, [orgId, onResolve]);

  return {
    capture,
    isCapturing
  };
}
