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
  /**
   * 1 = Tier 1 (always visible in the Next Steps card).
   * 2 = Tier 2 (hidden behind "Show more setup options" toggle).
   */
  tier: 1 | 2;
}

/**
 * The canonical ordered list of post-onboarding setup steps.
 * Order here determines display order in the UI.
 */
export const SETUP_STEPS: readonly SetupStepDefinition[] = [
  // ── Tier 1 — always visible on the dashboard checklist ──────────────────
  {
    key: 'step_first_invite',
    label: 'Invite a Team Member',
    description: 'Add your first team member to collaborate on projects',
    timeEstimate: '~2 min',
    actionLabel: 'Invite',
    helpText: "Use the Invite button to add a foreman or project manager. They'll get an email with a link to join your account.",
    visibleIn: ['dashboard', 'all'],
    tier: 1,
  },
  {
    key: 'step_first_project',
    label: 'Create your first project',
    description: 'Set up a project so you can start managing work',
    timeEstimate: '~2 min',
    actionLabel: 'Create Project',
    visibleIn: ['dashboard', 'all'],
    tier: 1,
  },
  {
    key: 'step_users_assigned',
    label: 'Assign someone to your project',
    description: 'Give team members access to specific projects',
    timeEstimate: '~2 min',
    actionLabel: 'Manage Users',
    helpText: 'Go to your project and add a team member so they can see and log work on that job.',
    visibleIn: ['dashboard', 'all'],
    tier: 1,
  },
  {
    key: 'step_morning_briefing_reviewed',
    label: 'Check Your Morning Briefing',
    description: 'See what the AI surfaces every morning on your dashboard',
    timeEstimate: '~1 min',
    actionLabel: 'Mark as Reviewed',
    helpText: "Go to your dashboard and read the Morning Briefing widget at the top. Then come back and click Mark as Reviewed to complete this step.",
    visibleIn: ['dashboard', 'all'],
    tier: 1,
  },
  {
    // Reuses the existing step_first_job_site column. Label is
    // user-facing-reframed as "daily site log" per product spec.
    key: 'step_first_job_site',
    label: 'Submit a daily site log',
    description: 'Log your first daily update so the morning briefing has something to summarize',
    timeEstimate: '~3 min',
    actionLabel: 'Go to Daily Logs',
    helpText: 'Have your foreman submit today\'s site log from the Daily Logs section. This is what powers the Morning Briefing.',
    visibleIn: ['dashboard', 'all'],
    tier: 1,
  },
  // ── Tier 2 — hidden behind "Show more setup options" toggle ─────────────
  {
    key: 'step_time_tracking_enabled',
    label: 'Enable Time Tracking',
    description: 'Turn on time tracking for your organization',
    timeEstimate: '~1 min',
    actionLabel: 'Enable',
    visibleIn: ['dashboard', 'time-tracking', 'all'],
    tier: 2,
  },
  {
    key: 'step_labor_rates',
    label: 'Set Labor Cost Rates',
    description: 'Set hourly cost rates so job costing works correctly',
    timeEstimate: '~3 min',
    actionLabel: 'Go to Labor Rates',
    helpText: 'Each field worker needs a cost rate for accurate job costing.',
    visibleIn: ['dashboard', 'time-tracking', 'financial', 'all'],
    tier: 2,
  },
  {
    key: 'step_ppe_reviewed',
    label: 'Submit your first safety log',
    description: 'Have your foreman complete the daily safety log -- it includes PPE confirmation for every trade on site',
    timeEstimate: '~3 min',
    actionLabel: 'Go to Safety',
    helpText: 'The Daily Safety Log includes PPE confirmation for each trade on site. PPE requirements are pre-loaded -- your foreman just taps through and confirms.',
    visibleIn: ['dashboard', 'safety', 'all'],
    tier: 2,
  },
  {
    key: 'step_hazard_library',
    label: 'Configure Hazard Library',
    description: "Confirm you've set up common hazards for safety forms",
    timeEstimate: '~5 min',
    actionLabel: "I've Configured This",
    helpText: 'Configure hazards in your safety workflow, then confirm here.',
    visibleIn: ['dashboard', 'safety', 'all'],
    tier: 2,
  },
  {
    key: 'step_invoice_permissions',
    label: 'Configure Invoice Permissions',
    description: 'Decide who can send invoices and whether approval is required',
    timeEstimate: '~2 min',
    actionLabel: 'Go to Invoicing',
    helpText: 'Admin-only step. Configure in the Invoicing settings tab.',
    visibleIn: ['dashboard', 'invoicing', 'all'],
    tier: 2,
  },
  {
    key: 'step_trades_configured',
    label: 'Configure Trades',
    description: 'Set up the trades/subcontractors working on your projects',
    timeEstimate: '~5 min',
    actionLabel: 'Manage Trades',
    helpText: 'Add at least 3 trades to complete this step.',
    visibleIn: ['financial', 'dashboard', 'all'],
    tier: 2,
  },
  {
    key: 'step_company_profile',
    label: 'Complete Your Company Profile',
    description: 'Add your business type, service area, and project size range',
    timeEstimate: '~3 min',
    actionLabel: 'Complete Profile',
    visibleIn: ['dashboard', 'all'],
    tier: 2,
  },
  {
    key: 'step_ai_calibrated',
    label: 'Calibrate Your AI',
    description: 'Answer 4 questions so your AI understands your business',
    timeEstimate: '~3 min',
    actionLabel: 'Calibrate',
    visibleIn: ['dashboard', 'all'],
    tier: 2,
  },
  {
    key: 'step_playbook_generated',
    label: 'Generate Your First Playbook',
    description: 'Let the AI build a reusable job template from your most common job type',
    timeEstimate: '~2 min',
    actionLabel: 'Go to Playbooks',
    visibleIn: ['dashboard', 'all'],
    tier: 2,
  },
] as const;

/** All checklist step keys (for progress calculation) */
export const SETUP_STEP_KEYS: readonly (keyof SetupProgress)[] = SETUP_STEPS.map(s => s.key);
