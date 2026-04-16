import { useMemo } from 'react';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import { useLocation } from 'react-router-dom';
import { SETUP_STEPS, SETUP_STEP_KEYS, type ChecklistContext, type SetupStepDefinition } from '@/lib/setupSteps';

// Re-export types from the canonical registry
export type { ChecklistContext };


function detectContextFromRoute(pathname: string): ChecklistContext {
  if (pathname.includes('/time') || pathname.includes('/timesheets')) return 'time-tracking';
  if (pathname.includes('/safety')) return 'safety';
  if (pathname.includes('/invoic')) return 'invoicing';
  if (pathname.includes('/financial') || pathname.includes('/labor-rates') || pathname.includes('/estimates')) return 'financial';
  return 'dashboard';
}

export function useSmartChecklist(contextOverride?: ChecklistContext) {
  const { progress, isLoading, markStepComplete, dismissWizard, isDismissed, isComplete, isUpdating, detectorErrors, retryDetectors } = useSetupProgress();
  const location = useLocation();

  const currentContext = contextOverride || detectContextFromRoute(location.pathname);

  const { tier1Items, tier2Items } = useMemo(() => {
    if (isLoading) return { tier1Items: [], tier2Items: [] };

    const relevant = SETUP_STEPS.filter((item) => {
      if (progress[item.key] === true) return false;
      if (item.visibleIn.includes('dashboard')) return true;
      if (item.visibleIn.includes(currentContext)) return true;
      if (currentContext === 'all') return true;
      return false;
    });

    return {
      tier1Items: relevant.filter((i) => i.tier === 1),
      tier2Items: relevant.filter((i) => i.tier === 2),
    };
  }, [progress, isLoading, currentContext]);

  // Backwards-compatible combined list (tier 1 first, then tier 2 if expanded).
  // Kept so any external consumers that still use `items` don't break.
  const visibleItems = useMemo(
    () => [...tier1Items, ...tier2Items],
    [tier1Items, tier2Items]
  );

  const completedCount = useMemo(() => {
    return SETUP_STEP_KEYS.filter((key) => progress[key] === true).length;
  }, [progress]);

  return {
    items: visibleItems,
    tier1Items,
    tier2Items,
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
    detectorErrors,
    retryDetectors,
  };
}
