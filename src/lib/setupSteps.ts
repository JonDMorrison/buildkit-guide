import { type SetupProgress } from '@/hooks/useSetupProgress';

export type ChecklistContext = 'dashboard' | 'time-tracking' | 'safety' | 'invoicing' | 'financial' | 'all';

/**
 * Canonical setup step registry.
 *
 * This is the SINGLE SOURCE OF TRUTH for:
 *  - which steps appear in the SmartChecklist UI
 *  - which steps count toward setup progress percentage
 *
 * "Onboarding-only" steps (org_created, timezone_set, first_project, first_job_site)
 * are NOT listed here because they are completed during the onboarding wizard
 * and should never appear in the post-onboarding checklist.
 *
 * Keys MUST match columns in the `setup_checklist_progress` table
 * AND keys in the `SetupProgress` interface.
 */
export interface SetupStepDefinition {
  /** Must correspond to a key in SetupProgress / setup_checklist_progress column */
  key: keyof SetupProgress;
  label: string;
  description: string;
  timeEstimate: string;
  helpText?: string;
  actionLabel?: string;
  /** Which checklist contexts this step is visible in */
  visibleIn: ChecklistContext[];
}

/**
 * The canonical ordered list of post-onboarding setup steps.
 * Order here determines display order in the UI.
 */
export const SETUP_STEPS: readonly SetupStepDefinition[] = [
  // Team / Dashboard
  {
    key: 'step_first_invite',
    label: 'Invite a Team Member',
    description: 'Add your first team member to collaborate on projects',
    timeEstimate: '~2 min',
    actionLabel: 'Invite',
    visibleIn: ['dashboard'],
  },
  {
    key: 'step_users_assigned',
    label: 'Assign Someone to Your Project',
    description: 'Give team members access to specific projects',
    timeEstimate: '~2 min',
    actionLabel: 'Manage Users',
    visibleIn: ['dashboard'],
  },
  // Time Tracking
  {
    key: 'step_time_tracking_enabled',
    label: 'Enable Time Tracking',
    description: 'Turn on time tracking for your organization',
    timeEstimate: '~1 min',
    actionLabel: 'Enable',
    visibleIn: ['time-tracking'],
  },
  {
    key: 'step_labor_rates',
    label: 'Set Labor Cost Rates',
    description: 'Set hourly cost rates so job costing works correctly',
    timeEstimate: '~3 min',
    actionLabel: 'Go to Labor Rates',
    helpText: 'Each field worker needs a cost rate for accurate job costing.',
    visibleIn: ['time-tracking', 'financial'],
  },
  // Safety — acknowledgement steps (no auto-detector; user confirms review)
  {
    key: 'step_ppe_reviewed',
    label: 'Review PPE Requirements',
    description: "Confirm you've reviewed PPE checklists for each trade",
    timeEstimate: '~5 min',
    actionLabel: "I've Reviewed This",
    helpText: 'Review your PPE requirements outside the app, then confirm here.',
    visibleIn: ['safety'],
  },
  {
    key: 'step_hazard_library',
    label: 'Configure Hazard Library',
    description: "Confirm you've set up common hazards for safety forms",
    timeEstimate: '~5 min',
    actionLabel: "I've Configured This",
    helpText: 'Configure hazards in your safety workflow, then confirm here.',
    visibleIn: ['safety'],
  },
  // Invoicing
  {
    key: 'step_invoice_permissions',
    label: 'Configure Invoice Permissions',
    description: 'Decide who can send invoices and whether approval is required',
    timeEstimate: '~2 min',
    actionLabel: 'Go to Invoicing',
    helpText: 'Admin-only step. Configure in the Invoicing settings tab.',
    visibleIn: ['invoicing'],
  },
  // Financial / Dashboard
  {
    key: 'step_trades_configured',
    label: 'Configure Trades',
    description: 'Set up the trades/subcontractors working on your projects',
    timeEstimate: '~5 min',
    actionLabel: 'Manage Trades',
    helpText: 'Add at least 3 trades to complete this step.',
    visibleIn: ['financial', 'dashboard'],
  },
  // Company
  {
    key: 'step_company_profile',
    label: 'Complete Your Company Profile',
    description: 'Add your business type, service area, and project size range',
    timeEstimate: '~3 min',
    actionLabel: 'Complete Profile',
    visibleIn: ['dashboard', 'all'],
  },
  {
    key: 'step_ai_calibrated',
    label: 'Calibrate Your AI',
    description: 'Answer 4 questions so your AI understands your business',
    timeEstimate: '~3 min',
    actionLabel: 'Calibrate',
    visibleIn: ['dashboard', 'all'],
  },
  // Operations
  {
    key: 'step_playbook_generated',
    label: 'Generate Your First Playbook',
    description: 'Let the AI build a reusable job template from your most common job type',
    timeEstimate: '~2 min',
    actionLabel: 'Go to Playbooks',
    visibleIn: ['dashboard', 'all'],
  },
  {
    key: 'step_morning_briefing_reviewed',
    label: 'Check Your Morning Briefing',
    description: 'See what the AI surfaces every morning on your dashboard',
    timeEstimate: '~1 min',
    actionLabel: "I've Seen It",
    helpText: 'Check the Morning Briefing widget on your Dashboard, then confirm here.',
    visibleIn: ['dashboard', 'all'],
  },
] as const;

/** All checklist step keys (for progress calculation) */
export const SETUP_STEP_KEYS: readonly (keyof SetupProgress)[] = SETUP_STEPS.map(s => s.key);
