import { useMemo } from 'react';
import { useSetupProgress, SetupProgress } from '@/hooks/useSetupProgress';
import { useLocation } from 'react-router-dom';

export type ChecklistContext = 'dashboard' | 'time-tracking' | 'safety' | 'invoicing' | 'financial' | 'all';

export interface SmartChecklistItem {
  key: keyof SetupProgress;
  label: string;
  description: string;
  timeEstimate: string;
  helpText?: string;
  actionLabel?: string;
  context: ChecklistContext[];
}

const ALL_ITEMS: SmartChecklistItem[] = [
  // Always-shown (until complete)
  {
    key: 'step_first_invite',
    label: 'Invite a Team Member',
    description: 'Add your first team member to collaborate on projects',
    timeEstimate: '~2 min',
    actionLabel: 'Invite',
    context: ['dashboard'],
  },
  {
    key: 'step_users_assigned',
    label: 'Assign Someone to Your Project',
    description: 'Give team members access to specific projects',
    timeEstimate: '~2 min',
    actionLabel: 'Manage Users',
    context: ['dashboard'],
  },
  // Time Tracking context
  {
    key: 'step_time_tracking_enabled',
    label: 'Enable Time Tracking',
    description: 'Turn on time tracking for your organization',
    timeEstimate: '~1 min',
    actionLabel: 'Enable',
    context: ['time-tracking'],
  },
  {
    key: 'step_labor_rates',
    label: 'Set Labor Cost Rates',
    description: 'Set hourly cost rates so job costing works correctly',
    timeEstimate: '~3 min',
    actionLabel: 'Go to Labor Rates',
    helpText: 'Each field worker needs a cost rate for accurate job costing.',
    context: ['time-tracking', 'financial'],
  },
  // Safety context
  {
    key: 'step_ppe_reviewed',
    label: 'Review PPE Requirements',
    description: 'Ensure PPE checklists are configured for each trade',
    timeEstimate: '~5 min',
    actionLabel: 'Mark Complete',
    context: ['safety'],
  },
  {
    key: 'step_hazard_library',
    label: 'Configure Hazard Library',
    description: 'Set up common hazards for quick selection in safety forms',
    timeEstimate: '~5 min',
    actionLabel: 'Mark Complete',
    context: ['safety'],
  },
  // Invoicing context
  {
    key: 'step_invoice_permissions',
    label: 'Configure Invoice Permissions',
    description: 'Decide who can send invoices and whether approval is required',
    timeEstimate: '~2 min',
    actionLabel: 'Go to Invoicing',
    helpText: 'Admin-only step. Configure in the Invoicing settings tab.',
    context: ['invoicing'],
  },
  // Financial context (labor_rates already included above)
  {
    key: 'step_trades_configured',
    label: 'Configure Trades',
    description: 'Set up the trades/subcontractors working on your projects',
    timeEstimate: '~5 min',
    actionLabel: 'Manage Trades',
    helpText: 'Add at least 3 trades to complete this step.',
    context: ['financial', 'dashboard'],
  },
];

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
    const relevant = ALL_ITEMS.filter((item) => {
      // Skip already-complete items
      if (progress[item.key] === true) return false;

      // Dashboard items always show
      if (item.context.includes('dashboard')) return true;

      // Context-specific items show when on that page
      if (item.context.includes(currentContext)) return true;

      // In "all" mode (e.g., the /setup page), show everything
      if (currentContext === 'all') return true;

      return false;
    });

    // Cap at 5 items
    return relevant.slice(0, 5);
  }, [progress, isLoading, currentContext]);

  const completedCount = useMemo(() => {
    return ALL_ITEMS.filter((item) => progress[item.key] === true).length;
  }, [progress]);

  return {
    items: visibleItems,
    completedCount,
    totalCount: ALL_ITEMS.length,
    isLoading,
    isDismissed,
    isComplete: isComplete || completedCount === ALL_ITEMS.length,
    currentContext,
    markStepComplete,
    dismissWizard,
    isUpdating,
    progress,
  };
}
