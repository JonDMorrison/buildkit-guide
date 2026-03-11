import { useMemo, useCallback } from 'react';
import { SETUP_STEP_KEYS } from '@/lib/setupSteps';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';


export interface SetupProgress {
  step_org_created: boolean;
  step_timezone_set: boolean;
  step_first_project: boolean;
  step_first_job_site: boolean;
  step_first_invite: boolean;
  step_trades_configured: boolean;
  step_users_assigned: boolean;
  step_time_tracking_enabled: boolean;
  step_time_tracking_configured: boolean;
  step_ppe_reviewed: boolean;
  step_first_safety_form: boolean;
  step_hazard_library: boolean;
  step_first_drawing: boolean;
  step_labor_rates: boolean;
  step_invoice_permissions: boolean;
  dismissed_at: string | null;
  completed_at: string | null;
}

const defaultProgress: SetupProgress = {
  step_org_created: false,
  step_timezone_set: false,
  step_first_project: false,
  step_first_job_site: false,
  step_first_invite: false,
  step_trades_configured: false,
  step_users_assigned: false,
  step_time_tracking_enabled: false,
  step_time_tracking_configured: false,
  step_ppe_reviewed: false,
  step_first_safety_form: false,
  step_hazard_library: false,
  step_first_drawing: false,
  step_labor_rates: false,
  step_invoice_permissions: false,
  dismissed_at: null,
  completed_at: null,
};

/**
 * Each detector returns which step keys it is responsible for,
 * so failures can be tracked as "unknown" rather than "incomplete".
 */
interface DetectorResult {
  name: string;
  result: Partial<SetupProgress>;
  /** Which step keys this detector covers — used to mark as "unknown" on failure */
  coveredKeys: (keyof SetupProgress)[];
  error?: string;
}

async function runDetector(
  name: string,
  coveredKeys: (keyof SetupProgress)[],
  fn: () => Promise<Partial<SetupProgress>>
): Promise<DetectorResult> {
  try {
    const result = await fn();
    return { name, result, coveredKeys };
  } catch (e: any) {
    return { name, result: {}, coveredKeys, error: e?.message ?? 'unknown' };
  }
}

interface DetectionOutput {
  detected: Partial<SetupProgress>;
  /** Step keys whose detectors failed — these should not flip complete→incomplete */
  failedStepKeys: Set<keyof SetupProgress>;
  errors: string[];
}

/** All detectors run in parallel; failures are isolated per-detector */
async function detectAllSteps(orgId: string): Promise<DetectionOutput> {
  const detectors = [
    runDetector('org-settings',
      ['step_org_created', 'step_timezone_set', 'step_time_tracking_enabled', 'step_invoice_permissions'],
      async () => {
        const { data } = await supabase
          .from('organization_settings')
          .select('default_timezone,time_tracking_enabled,invoice_send_roles')
          .eq('organization_id', orgId)
          .maybeSingle();
        const d: Partial<SetupProgress> = {};
        d.step_org_created = true;
        if (data?.default_timezone) d.step_timezone_set = true;
        if (data?.time_tracking_enabled) d.step_time_tracking_enabled = true;
        if (data?.invoice_send_roles && (data.invoice_send_roles as string[]).length > 0) {
          d.step_invoice_permissions = true;
        }
        return d;
      }),
    runDetector('projects-and-related',
      ['step_first_project', 'step_trades_configured', 'step_users_assigned', 'step_first_safety_form', 'step_first_drawing'],
      async () => {
        const d: Partial<SetupProgress> = {};
        const { count: projectCount, data: projects } = await supabase
          .from('projects')
          .select('id',{ count: 'exact' })
          .eq('organization_id',orgId)
          .eq('is_deleted',false);
        if (projectCount && projectCount > 0) d.step_first_project = true;
        if (projects && projects.length > 0) {
          const projectIds = projects.map(p => p.id);
          const [tradesRes,assignRes,safetyRes,drawingRes] = await Promise.all([
            supabase.from('trades').select('id',{ count: 'exact',head: true }).eq('organization_id',orgId),supabase.from('project_members').select('id',{ count: 'exact',head: true }).in('project_id',projectIds),supabase.from('safety_forms').select('id',{ count: 'exact',head: true }).in('project_id',projectIds).eq('is_deleted',false).eq('status','submitted'),
            supabase.from('attachments').select('id',{ count: 'exact',head: true }).in('project_id',projectIds).not('document_type','is',null),]);
          if (tradesRes.count && tradesRes.count >= 3) d.step_trades_configured = true;
          if (assignRes.count && assignRes.count > 0) d.step_users_assigned = true;
          if (safetyRes.count && safetyRes.count > 0) d.step_first_safety_form = true;
          if (drawingRes.count && drawingRes.count > 0) d.step_first_drawing = true;
        }
        return d;
      }),runDetector('job-sites',['step_first_job_site'],async () => {
      const { count } = await supabase
        .from('job_sites')
        .select('id',{ count: 'exact',head: true })
        .eq('organization_id',orgId)
        .eq('is_active',true);
      return count && count > 0 ? { step_first_job_site: true } : {};
    }),runDetector('members',['step_first_invite'],async () => {
      const { count } = await supabase
        .from('organization_memberships')
        .select('id',{ count: 'exact',head: true })
        .eq('organization_id',orgId)
        .eq('is_active',true);
      return count && count > 1 ? { step_first_invite: true } : {};
    }),runDetector('labor-rates',['step_labor_rates'],async () => {
      const { data } = await supabase.rpc('rpc_get_org_costing_setup_status',{ p_org_id: orgId });
      if (data && (data as any).missing_labor_rates_count === 0 && !(data as any).has_currency_mismatch) {
        return { step_labor_rates: true } as Partial<SetupProgress>;
      }
      return {};
    }),];

  const results = await Promise.all(detectors);
  const detected: Partial<SetupProgress> = {};
  const failedStepKeys = new Set<keyof SetupProgress>();
  const errors: string[] = [];

  for (const r of results) {
    Object.assign(detected,r.result);
    if (r.error) {
      errors.push(`${r.name}: ${r.error}`);
      for (const key of r.coveredKeys) failedStepKeys.add(key);
    }
  }

  // Single aggregated log instead of per-detector spam
  if (errors.length > 0) {
    console.warn(`[setup-detectors] ${errors.length} detector(s) failed:`, errors.join('; '));
  }

  return { detected, errors, failedStepKeys };
}

export function useSetupProgress() {
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch saved progress from database
  const { data: savedProgress, isLoading: isSavedLoading } = useQuery({
    queryKey: ['setup-progress', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      
      const { data, error } = await supabase
        .from('setup_checklist_progress')
        .select('*')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching setup progress:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!activeOrganizationId,
  });

  // Auto-detect completed steps — cached via react-query, parallel execution
  const { data: detectionResult, isLoading: isDetecting } = useQuery({
    queryKey: ['setup-detectors', activeOrganizationId],
    queryFn: () => detectAllSteps(activeOrganizationId!),
    enabled: !!activeOrganizationId,
    staleTime: 60_000, // cache for 60s — avoid re-running on every mount
    refetchOnWindowFocus: false,
  });

  const autoDetectedSteps = detectionResult?.detected ?? {};
  const failedStepKeys = detectionResult?.failedStepKeys ?? new Set<keyof SetupProgress>();
  const detectorErrors = detectionResult?.errors ?? [];
  const isLoading = isSavedLoading || isDetecting;

  // Merge saved progress with auto-detected steps.
  // Key invariant: if a detector failed for a step, we preserve the saved DB value
  // and never flip it to false. This prevents complete→incomplete regressions.
  const progress = useMemo((): SetupProgress => {
    const base = savedProgress || defaultProgress;

    const mergeStep = (key: keyof SetupProgress): boolean => {
      const savedVal = base[key];
      const detectedVal = autoDetectedSteps[key];
      // If detector failed for this key, trust saved value only (no false override)
      if (failedStepKeys.has(key)) return !!savedVal;
      return !!savedVal || !!detectedVal;
    };

    return {
      ...base,
      step_org_created: mergeStep('step_org_created'),
      step_timezone_set: mergeStep('step_timezone_set'),
      step_first_project: mergeStep('step_first_project'),
      step_first_job_site: mergeStep('step_first_job_site'),
      step_first_invite: mergeStep('step_first_invite'),
      step_trades_configured: mergeStep('step_trades_configured'),
      step_users_assigned: mergeStep('step_users_assigned'),
      step_time_tracking_enabled: mergeStep('step_time_tracking_enabled'),
      step_time_tracking_configured: mergeStep('step_time_tracking_configured'),
      step_ppe_reviewed: mergeStep('step_ppe_reviewed'),
      step_first_safety_form: mergeStep('step_first_safety_form'),
      step_hazard_library: mergeStep('step_hazard_library'),
      step_first_drawing: mergeStep('step_first_drawing'),
      step_labor_rates: mergeStep('step_labor_rates'),
      step_invoice_permissions: mergeStep('step_invoice_permissions'),
    };
  }, [savedProgress, autoDetectedSteps, failedStepKeys]);

  // Calculate stats — uses canonical registry so checklist UI and progress bar always agree
  const completedSteps = SETUP_STEP_KEYS.filter(key => progress[key] === true).length;
  const totalSteps = SETUP_STEP_KEYS.length;
  const percentComplete = Math.round((completedSteps / totalSteps) * 100);

  // Update progress mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<SetupProgress>) => {
      if (!activeOrganizationId) throw new Error('No organization selected');
      
      // Check if record exists
      const { data: existing } = await supabase
        .from('setup_checklist_progress')
        .select('id')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('setup_checklist_progress')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('organization_id', activeOrganizationId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('setup_checklist_progress')
          .insert({ organization_id: activeOrganizationId, ...updates });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup-progress', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['setup-detectors', activeOrganizationId] });
    },
  });

  const markStepComplete = useCallback((stepKey: keyof SetupProgress) => {
    updateMutation.mutate({ [stepKey]: true });
  }, [updateMutation]);

  const dismissWizard = useCallback(() => {
    updateMutation.mutate({ dismissed_at: new Date().toISOString() });
  }, [updateMutation]);

  const resetProgress = useCallback(() => {
    updateMutation.mutate({
      ...defaultProgress,
      dismissed_at: null,
      completed_at: null,
    });
  }, [updateMutation]);

  const markAllComplete = useCallback(() => {
    const allComplete: Partial<SetupProgress> = {
      step_org_created: true,
      step_timezone_set: true,
      step_first_project: true,
      step_first_job_site: true,
      step_first_invite: true,
      step_trades_configured: true,
      step_users_assigned: true,
      step_time_tracking_enabled: true,
      step_time_tracking_configured: true,
      step_ppe_reviewed: true,
      step_first_safety_form: true,
      step_hazard_library: true,
      step_first_drawing: true,
      step_labor_rates: true,
      step_invoice_permissions: true,
      completed_at: new Date().toISOString(),
    };
    updateMutation.mutate(allComplete);
  }, [updateMutation]);

  // Phase definitions
  const phases = [
    { id: 1, name: 'Foundation', steps: ['step_org_created', 'step_timezone_set', 'step_first_project', 'step_first_job_site'] },
    { id: 2, name: 'Team Setup', steps: ['step_first_invite', 'step_trades_configured', 'step_users_assigned'] },
    { id: 3, name: 'Time Tracking', steps: ['step_time_tracking_enabled', 'step_time_tracking_configured'] },
    { id: 4, name: 'Safety & Compliance', steps: ['step_ppe_reviewed', 'step_first_safety_form', 'step_hazard_library'] },
    { id: 5, name: 'Documents', steps: ['step_first_drawing'] },
    { id: 6, name: 'Financial Setup', steps: ['step_labor_rates', 'step_invoice_permissions'] },
  ];

  const getPhaseProgress = (phaseId: number) => {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return { completed: 0, total: 0 };
    
    const completed = phase.steps.filter(s => progress[s as keyof SetupProgress]).length;
    return { completed, total: phase.steps.length };
  };

  // Find next incomplete step
  const nextIncompleteStep = useMemo(() => {
    for (const phase of phases) {
      for (const step of phase.steps) {
        if (!progress[step as keyof SetupProgress]) {
          return step;
        }
      }
    }
    return null;
  }, [progress, phases]);

  const retryDetectors = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['setup-detectors', activeOrganizationId] });
  }, [queryClient, activeOrganizationId]);

  return {
    progress,
    isLoading,
    isDismissed: !!progress.dismissed_at,
    isComplete: !!progress.completed_at || percentComplete === 100,
    completedSteps,
    totalSteps,
    percentComplete,
    phases,
    getPhaseProgress,
    nextIncompleteStep,
    markStepComplete,
    dismissWizard,
    resetProgress,
    markAllComplete,
    isUpdating: updateMutation.isPending,
    detectorErrors,
    retryDetectors,
  };
}
