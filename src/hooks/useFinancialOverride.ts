import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseFinancialOverrideReturn {
  logOverride: (projectId: string, checkpoint: string, reason: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export const useFinancialOverride = (): UseFinancialOverrideReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logOverride = async (projectId: string, checkpoint: string, reason: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc('rpc_log_financial_override' as any, {
        p_project_id: projectId,
        p_checkpoint: checkpoint,
        p_override_reason: reason,
      });
      if (rpcError) throw rpcError;
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Failed to log override');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { logOverride, loading, error };
};
