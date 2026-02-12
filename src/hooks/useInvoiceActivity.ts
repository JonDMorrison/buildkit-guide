import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { InvoiceActivityLog } from '@/types/invoicing';

export const useInvoiceActivity = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<InvoiceActivityLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async (invoiceId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('invoice_activity_log')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
      .limit(50);
    setActivities((data as any[]) || []);
    setLoading(false);
  }, []);

  const logActivity = useCallback(async (
    invoiceId: string,
    action: string,
    details?: string,
    metadata?: any,
  ) => {
    if (!user) return;
    await supabase
      .from('invoice_activity_log')
      .insert({
        invoice_id: invoiceId,
        user_id: user.id,
        action,
        details: details || null,
        metadata: metadata || null,
      } as any);
  }, [user]);

  return { activities, loading, fetchActivities, logActivity };
};
