import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';

export interface SetupStep {
  key: string;
  label: string;
  description: string;
  phase: number;
  phaseName: string;
  timeEstimate: string;
  isComplete: boolean;
  action?: () => void;
  actionLabel?: string;
  helpText?: string;
}

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
  dismissed_at: null,
  completed_at: null,
};

export function useSetupProgress() {
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  const [autoDetectedSteps, setAutoDetectedSteps] = useState<Partial<SetupProgress>>({});

  // Fetch saved progress from database
  const { data: savedProgress, isLoading } = useQuery({
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

  // Auto-detect completed steps based on existing data
  useEffect(() => {
    if (!activeOrganizationId) return;

    const detectSteps = async () => {
      const detected: Partial<SetupProgress> = {};

      // Check if org exists (always true if we have activeOrganizationId)
      detected.step_org_created = true;

      // Check timezone
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('default_timezone, time_tracking_enabled')
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();
      
      if (orgSettings?.default_timezone) {
        detected.step_timezone_set = true;
      }
      if (orgSettings?.time_tracking_enabled) {
        detected.step_time_tracking_enabled = true;
      }

      // Check projects
      const { count: projectCount } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', activeOrganizationId)
        .eq('is_deleted', false);
      
      if (projectCount && projectCount > 0) {
        detected.step_first_project = true;
      }

      // Check job sites
      const { count: jobSiteCount } = await supabase
        .from('job_sites')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true);
      
      if (jobSiteCount && jobSiteCount > 0) {
        detected.step_first_job_site = true;
      }

      // Check team members (more than 1 means someone was invited)
      const { count: memberCount } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true);
      
      if (memberCount && memberCount > 1) {
        detected.step_first_invite = true;
      }

      // Check trades - get projects first, then check trades
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', activeOrganizationId)
        .eq('is_deleted', false);
      
      if (projects && projects.length > 0) {
        const projectIds = projects.map(p => p.id);
        const { count: tradeCount } = await supabase
          .from('trades')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds);
        
        if (tradeCount && tradeCount >= 3) {
          detected.step_trades_configured = true;
        }

        // Check project members
        const { count: assignmentCount } = await supabase
          .from('project_members')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds);
        
        if (assignmentCount && assignmentCount > 0) {
          detected.step_users_assigned = true;
        }

        // Check safety forms
        const { count: safetyCount } = await supabase
          .from('safety_forms')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .eq('is_deleted', false)
          .eq('status', 'submitted');
        
        if (safetyCount && safetyCount > 0) {
          detected.step_first_safety_form = true;
        }

        // Check drawings
        const { count: drawingCount } = await supabase
          .from('attachments')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .not('document_type', 'is', null);
        
        if (drawingCount && drawingCount > 0) {
          detected.step_first_drawing = true;
        }
      }

      setAutoDetectedSteps(detected);
    };

    detectSteps();
  }, [activeOrganizationId]);

  // Merge saved progress with auto-detected steps
  const progress = useMemo((): SetupProgress => {
    const base = savedProgress || defaultProgress;
    return {
      ...base,
      step_org_created: base.step_org_created || autoDetectedSteps.step_org_created || false,
      step_timezone_set: base.step_timezone_set || autoDetectedSteps.step_timezone_set || false,
      step_first_project: base.step_first_project || autoDetectedSteps.step_first_project || false,
      step_first_job_site: base.step_first_job_site || autoDetectedSteps.step_first_job_site || false,
      step_first_invite: base.step_first_invite || autoDetectedSteps.step_first_invite || false,
      step_trades_configured: base.step_trades_configured || autoDetectedSteps.step_trades_configured || false,
      step_users_assigned: base.step_users_assigned || autoDetectedSteps.step_users_assigned || false,
      step_time_tracking_enabled: base.step_time_tracking_enabled || autoDetectedSteps.step_time_tracking_enabled || false,
      step_time_tracking_configured: base.step_time_tracking_configured || autoDetectedSteps.step_time_tracking_configured || false,
      step_ppe_reviewed: base.step_ppe_reviewed || autoDetectedSteps.step_ppe_reviewed || false,
      step_first_safety_form: base.step_first_safety_form || autoDetectedSteps.step_first_safety_form || false,
      step_hazard_library: base.step_hazard_library || autoDetectedSteps.step_hazard_library || false,
      step_first_drawing: base.step_first_drawing || autoDetectedSteps.step_first_drawing || false,
    };
  }, [savedProgress, autoDetectedSteps]);

  // Calculate stats
  const stepKeys: (keyof SetupProgress)[] = [
    'step_org_created', 'step_timezone_set', 'step_first_project', 'step_first_job_site',
    'step_first_invite', 'step_trades_configured', 'step_users_assigned',
    'step_time_tracking_enabled', 'step_time_tracking_configured',
    'step_ppe_reviewed', 'step_first_safety_form', 'step_hazard_library', 'step_first_drawing'
  ];

  const completedSteps = stepKeys.filter(key => progress[key] === true).length;
  const totalSteps = stepKeys.length;
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
    const allComplete: Partial<SetupProgress> = {};
    stepKeys.forEach(key => {
      allComplete[key] = true;
    });
    allComplete.completed_at = new Date().toISOString();
    updateMutation.mutate(allComplete);
  }, [updateMutation]);

  // Phase definitions
  const phases = [
    { id: 1, name: 'Foundation', steps: ['step_org_created', 'step_timezone_set', 'step_first_project', 'step_first_job_site'] },
    { id: 2, name: 'Team Setup', steps: ['step_first_invite', 'step_trades_configured', 'step_users_assigned'] },
    { id: 3, name: 'Time Tracking', steps: ['step_time_tracking_enabled', 'step_time_tracking_configured'] },
    { id: 4, name: 'Safety & Compliance', steps: ['step_ppe_reviewed', 'step_first_safety_form', 'step_hazard_library'] },
    { id: 5, name: 'Documents', steps: ['step_first_drawing'] },
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
  };
}
