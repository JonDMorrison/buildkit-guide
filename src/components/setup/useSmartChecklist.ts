import { useMemo } from 'react';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import { useLocation } from 'react-router-dom';
import { SETUP_STEPS, SETUP_STEP_KEYS, type ChecklistContext, type SetupStepDefinition } from '@/lib/setupSteps';

// Re-export types from the canonical registry
export type { ChecklistContext };

export interface SmartChecklistItem extends SetupStepDefinition {
  // Inherits all fields from SetupStepDefinition
}

function detectContextFromRoute(pathname: string): ChecklistContext {
  if (pathname.includes('/time') || pathname.includes('/timesheets')) return 'time-tracking';
  if (pathname.includes('/safety')) return 'safety';
  if (pathname.includes('/invoic')) return 'invoicing';
  if (pathname.includes('/financial') || pathname.includes('/labor-rates') || pathname.includes('/estimates')) return 'financial';
  return 'dashboard';
}

export function useSmartChecklist(contextOverride?: ChecklistContext) {
  const { progress, isLoading, markStepComplete, dismissWizard, isDismissed, isComplete, isUpdating } = useSetupProgress();
  const location = useLocation();

  const currentContext = contextOverride || detectContextFromRoute(location.pathname);

  const visibleItems = useMemo(() => {
    if (isLoading) return [];

    // Filter items: show dashboard items always + context-specific items
    const relevant = SETUP_STEPS.filter((item) => {
      // Skip already-complete items
      if (progress[item.key] === true) return false;

      // Dashboard items always show
      if (item.visibleIn.includes('dashboard')) return true;

      // Context-specific items show when on that page
      if (item.visibleIn.includes(currentContext)) return true;

      // In "all" mode (e.g., the /setup page), show everything
      if (currentContext === 'all') return true;

      return false;
    });

    // Cap at 5 items
    return relevant.slice(0, 5);
  }, [progress, isLoading, currentContext]);

  const completedCount = useMemo(() => {
    return SETUP_STEP_KEYS.filter((key) => progress[key] === true).length;
  }, [progress]);

  return {
    items: visibleItems,
    completedCount,
    totalCount: SETUP_STEP_KEYS.length,
    isLoading,
    isDismissed,
    isComplete: isComplete || completedCount === SETUP_STEP_KEYS.length,
    currentContext,
    markStepComplete,
    dismissWizard,
    isUpdating,
    progress,
  };
}
