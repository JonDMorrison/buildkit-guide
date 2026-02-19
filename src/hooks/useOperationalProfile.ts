import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

export interface OperationalProfileData {
  // Phase 1
  base_currency: string;
  tax_model: string;
  labor_cost_model: string;
  rate_source: string;
  invoice_permission_model: string;
  workflow_mode_default: string;
  // Phase 2
  over_estimate_action: string | null;
  invoice_approver: string | null;
  tasks_before_quote: boolean | null;
  time_audit_frequency: string | null;
  track_variance_per_trade: boolean | null;
  profit_leakage_source: string | null;
  quote_standardization: string | null;
  require_safety_before_work: boolean | null;
  // Phase 3
  ai_risk_mode: string;
  ai_auto_change_orders: boolean;
  ai_flag_profit_risk: boolean;
  ai_recommend_pricing: boolean;
  // Meta
  wizard_phase_completed: number;
  wizard_completed_at: string | null;
}

const defaultProfile: OperationalProfileData = {
  base_currency: 'CAD',
  tax_model: 'gst_only',
  labor_cost_model: 'blended',
  rate_source: 'manual',
  invoice_permission_model: 'admin_only',
  workflow_mode_default: 'standard',
  over_estimate_action: null,
  invoice_approver: null,
  tasks_before_quote: null,
  time_audit_frequency: null,
  track_variance_per_trade: null,
  profit_leakage_source: null,
  quote_standardization: null,
  require_safety_before_work: null,
  ai_risk_mode: 'balanced',
  ai_auto_change_orders: false,
  ai_flag_profit_risk: true,
  ai_recommend_pricing: false,
  wizard_phase_completed: 0,
  wizard_completed_at: null,
};

export function useOperationalProfile() {
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['operational-profile', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      const { data, error } = await supabase
        .from('organization_operational_profile')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();
      if (error) {
        console.error('Error fetching operational profile:', error);
        return null;
      }
      return data;
    },
    enabled: !!activeOrganizationId,
  });

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<OperationalProfileData>) => {
      if (!activeOrganizationId) throw new Error('No org');
      const { data, error } = await supabase.rpc('rpc_upsert_operational_profile', {
        p_organization_id: activeOrganizationId,
        p_data: updates as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operational-profile', activeOrganizationId] });
    },
  });

  const currentProfile: OperationalProfileData = profile
    ? {
        base_currency: profile.base_currency,
        tax_model: profile.tax_model,
        labor_cost_model: profile.labor_cost_model,
        rate_source: profile.rate_source,
        invoice_permission_model: profile.invoice_permission_model,
        workflow_mode_default: profile.workflow_mode_default,
        over_estimate_action: profile.over_estimate_action,
        invoice_approver: profile.invoice_approver,
        tasks_before_quote: profile.tasks_before_quote,
        time_audit_frequency: profile.time_audit_frequency,
        track_variance_per_trade: profile.track_variance_per_trade,
        profit_leakage_source: profile.profit_leakage_source,
        quote_standardization: profile.quote_standardization,
        require_safety_before_work: profile.require_safety_before_work,
        ai_risk_mode: profile.ai_risk_mode ?? 'balanced',
        ai_auto_change_orders: profile.ai_auto_change_orders ?? false,
        ai_flag_profit_risk: profile.ai_flag_profit_risk ?? true,
        ai_recommend_pricing: profile.ai_recommend_pricing ?? false,
        wizard_phase_completed: profile.wizard_phase_completed,
        wizard_completed_at: profile.wizard_completed_at,
      }
    : defaultProfile;

  return {
    profile: currentProfile,
    isLoading,
    saveProfile: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    wizardPhaseCompleted: currentProfile.wizard_phase_completed,
    isWizardComplete: currentProfile.wizard_phase_completed >= 3,
  };
}
