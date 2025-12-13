import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

interface TimeTrackingState {
  enabled: boolean;
  loading: boolean;
}

/**
 * Hook to check if time tracking is enabled for the organization
 * Returns the effective enablement state based on organization settings
 */
export const useTimeTrackingEnabled = (): TimeTrackingState => {
  const { activeOrganizationId, loading: orgLoading } = useOrganization();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgLoading || !activeOrganizationId) {
      setLoading(true);
      return;
    }

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_settings')
          .select('time_tracking_enabled')
          .eq('organization_id', activeOrganizationId)
          .single();

        if (error) {
          console.error('Error fetching organization settings:', error);
          setEnabled(false);
        } else {
          setEnabled(data?.time_tracking_enabled ?? false);
        }
      } catch (error) {
        console.error('Error fetching time tracking settings:', error);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [activeOrganizationId, orgLoading]);

  return { enabled, loading };
};
