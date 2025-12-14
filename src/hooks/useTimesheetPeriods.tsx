import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

export interface TimesheetPeriod {
  id: string;
  organization_id: string;
  user_id: string;
  user_name?: string;
  period_start: string;
  period_end: string;
  status: 'open' | 'submitted' | 'approved' | 'locked';
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approver_name?: string;
  locked_at: string | null;
  locked_by: string | null;
  locker_name?: string;
  attestation_text: string | null;
  notes: string | null;
  created_at: string;
}

// Worker view: their own periods
export function useMyTimesheetPeriods(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-timesheet-periods', user?.id, limit],
    queryFn: async (): Promise<TimesheetPeriod[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('timesheet_periods')
        .select('*')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((period: any) => ({
        id: period.id,
        organization_id: period.organization_id,
        user_id: period.user_id,
        period_start: period.period_start,
        period_end: period.period_end,
        status: period.status,
        submitted_at: period.submitted_at,
        submitted_by: period.submitted_by,
        approved_at: period.approved_at,
        approved_by: period.approved_by,
        locked_at: period.locked_at,
        locked_by: period.locked_by,
        attestation_text: period.attestation_text,
        notes: period.notes,
        created_at: period.created_at,
      }));
    },
    enabled: !!user?.id,
  });
}

// HR/Admin view: all periods for organization
export function useOrganizationTimesheetPeriods(status?: string) {
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();

  return useQuery({
    queryKey: ['organization-timesheet-periods', activeOrganization?.id, status],
    queryFn: async (): Promise<TimesheetPeriod[]> => {
      if (!user?.id || !activeOrganization?.id) return [];

      let query = supabase
        .from('timesheet_periods')
        .select(`
          *,
          user:profiles!user_id(full_name),
          approver:profiles!approved_by(full_name),
          locker:profiles!locked_by(full_name)
        `)
        .eq('organization_id', activeOrganization.id)
        .order('period_start', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((period: any) => ({
        id: period.id,
        organization_id: period.organization_id,
        user_id: period.user_id,
        user_name: period.user?.full_name,
        period_start: period.period_start,
        period_end: period.period_end,
        status: period.status,
        submitted_at: period.submitted_at,
        submitted_by: period.submitted_by,
        approved_at: period.approved_at,
        approved_by: period.approved_by,
        approver_name: period.approver?.full_name,
        locked_at: period.locked_at,
        locked_by: period.locked_by,
        locker_name: period.locker?.full_name,
        attestation_text: period.attestation_text,
        notes: period.notes,
        created_at: period.created_at,
      }));
    },
    enabled: !!user?.id && !!activeOrganization?.id,
  });
}
