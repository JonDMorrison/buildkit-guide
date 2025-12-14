import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TimeAdjustmentRequest {
  id: string;
  organization_id: string;
  project_id: string;
  project_name?: string;
  time_entry_id: string | null;
  target_user_id: string;
  target_user_name?: string;
  requester_user_id: string;
  requester_name?: string;
  request_type: string;
  reason: string;
  status: string;
  proposed_check_in_at: string | null;
  proposed_check_out_at: string | null;
  proposed_job_site_id: string | null;
  proposed_job_site_name?: string;
  proposed_notes: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_name?: string;
  created_at: string;
}

// Worker view: their own requests
export function useMyTimeRequests(limit = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-time-requests', user?.id, limit],
    queryFn: async (): Promise<TimeAdjustmentRequest[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('time_adjustment_requests')
        .select(`
          *,
          project:projects(name),
          target_user:profiles!time_adjustment_requests_target_user_id_fkey(full_name),
          requester:profiles!time_adjustment_requests_requester_user_id_fkey(full_name),
          proposed_job_site:job_sites(name)
        `)
        .eq('requester_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((req: any) => ({
        id: req.id,
        organization_id: req.organization_id,
        project_id: req.project_id,
        project_name: req.project?.name,
        time_entry_id: req.time_entry_id,
        target_user_id: req.target_user_id,
        target_user_name: req.target_user?.full_name,
        requester_user_id: req.requester_user_id,
        requester_name: req.requester?.full_name,
        request_type: req.request_type,
        reason: req.reason,
        status: req.status,
        proposed_check_in_at: req.proposed_check_in_at,
        proposed_check_out_at: req.proposed_check_out_at,
        proposed_job_site_id: req.proposed_job_site_id,
        proposed_job_site_name: req.proposed_job_site?.name,
        proposed_notes: req.proposed_notes,
        review_note: req.review_note,
        reviewed_at: req.reviewed_at,
        reviewed_by: req.reviewed_by,
        created_at: req.created_at,
      }));
    },
    enabled: !!user?.id,
  });
}

// Supervisor view: pending requests from shared projects
export function usePendingTimeRequests(projectId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-time-requests', user?.id, projectId],
    queryFn: async (): Promise<TimeAdjustmentRequest[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('time_adjustment_requests')
        .select(`
          *,
          project:projects(name),
          target_user:profiles!time_adjustment_requests_target_user_id_fkey(full_name),
          requester:profiles!time_adjustment_requests_requester_user_id_fkey(full_name),
          proposed_job_site:job_sites(name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((req: any) => ({
        id: req.id,
        organization_id: req.organization_id,
        project_id: req.project_id,
        project_name: req.project?.name,
        time_entry_id: req.time_entry_id,
        target_user_id: req.target_user_id,
        target_user_name: req.target_user?.full_name,
        requester_user_id: req.requester_user_id,
        requester_name: req.requester?.full_name,
        request_type: req.request_type,
        reason: req.reason,
        status: req.status,
        proposed_check_in_at: req.proposed_check_in_at,
        proposed_check_out_at: req.proposed_check_out_at,
        proposed_job_site_id: req.proposed_job_site_id,
        proposed_job_site_name: req.proposed_job_site?.name,
        proposed_notes: req.proposed_notes,
        review_note: req.review_note,
        reviewed_at: req.reviewed_at,
        reviewed_by: req.reviewed_by,
        created_at: req.created_at,
      }));
    },
    enabled: !!user?.id,
  });
}
