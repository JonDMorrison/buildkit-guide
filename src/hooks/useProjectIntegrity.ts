import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IntegrityStatus = 'clean' | 'needs_attention' | 'blocked';

export interface IntegrityData {
  status: IntegrityStatus;
  score: number;
  blockers: string[];
}

export const useProjectIntegrity = (projectId: string | null) => {
  const [integrity, setIntegrity] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setIntegrity(null);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc(
          'estimate_variance_summary' as any,
          { p_project_id: projectId }
        );

        if (error) throw error;

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        if (result?.integrity) {
          setIntegrity({
            status: result.integrity.status as IntegrityStatus,
            score: Number(result.integrity.score) || 0,
            blockers: Array.isArray(result.integrity.blockers) ? result.integrity.blockers : [],
          });
        }
      } catch {
        // Silently fail — integrity is supplementary
        setIntegrity(null);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [projectId]);

  return { integrity, loading };
};
