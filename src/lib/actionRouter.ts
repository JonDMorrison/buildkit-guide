/**
 * Deterministic action router for Health Check CTAs.
 * Static mapping only — no AI, no backend calls.
 * All routes must exist in ROUTE_WRAPPER_MAP.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ActionContext {
  orgId?: string;
  projectId?: string;
  issue?: string;
  canViewDiagnostics?: boolean;
  canViewExecutive?: boolean;
}

export interface ActionLink {
  label: string;
  to: string;
  requires?: ('executive' | 'diagnostics')[];
}

export interface ActionBundle {
  title: string;
  description: string;
  primary: ActionLink;
  secondary?: ActionLink;
  tertiary?: ActionLink;
}

// ── Check IDs (canonical, match HealthCheck.tsx) ───────────────────────────

export const HEALTH_CHECK_IDS = [
  'access',
  'snapshot_freshness',
  'snapshot_coverage',
  'data_quality',
  'exec_intelligence',
  'ui_reliability',
] as const;

export type HealthCheckId = (typeof HEALTH_CHECK_IDS)[number];

// ── Static action mappings ─────────────────────────────────────────────────

function buildBundle(
  checkId: HealthCheckId,
  ctx: ActionContext,
): ActionBundle | null {
  switch (checkId) {
    case 'access':
      return {
        title: 'Verify Access',
        description: 'Confirm your role grants access to this surface.',
        primary: { label: 'Go to Dashboard', to: '/dashboard' },
      };

    case 'snapshot_freshness':
      return {
        title: 'Investigate Snapshot Freshness',
        description: 'Snapshots may be stale — check the executive brief for latest data.',
        primary: {
          label: 'Open Executive Brief',
          to: '/executive?from=health&check=snapshot_freshness',
          requires: ['executive'],
        },
        secondary: ctx.canViewDiagnostics
          ? { label: 'View Diagnostics', to: '/insights/ai-brain', requires: ['diagnostics'] }
          : { label: 'View Release Status', to: '/release?from=health&check=snapshot_freshness', requires: ['executive'] },
      };

    case 'snapshot_coverage':
      return {
        title: 'Improve Snapshot Coverage',
        description: 'Some projects are missing snapshots — review confidence data.',
        primary: {
          label: 'Open Executive Brief',
          to: '/executive?from=health&check=snapshot_coverage',
          requires: ['executive'],
        },
        secondary: {
          label: 'View Mission Control',
          to: '/dashboard?from=health&check=snapshot_coverage',
        },
      };

    case 'data_quality':
      return {
        title: 'Fix Data Quality Issues',
        description: 'Data quality problems may invalidate conclusions — review affected projects.',
        primary: {
          label: 'Open Portfolio Insights',
          to: '/insights?from=health&check=data_quality',
        },
        secondary: {
          label: 'Open Data Health',
          to: '/data-health?from=health&check=data_quality',
          requires: ['executive'],
        },
        tertiary: {
          label: 'View Projects',
          to: '/projects',
        },
      };

    case 'exec_intelligence':
      return {
        title: 'Review Executive Intelligence',
        description: 'Change feed may be empty — check if snapshots are generating changes.',
        primary: {
          label: 'Open Executive Brief',
          to: '/executive?from=health&check=exec_intelligence',
          requires: ['executive'],
        },
        secondary: {
          label: 'Open Portfolio Insights',
          to: '/insights?from=health&check=exec_intelligence',
        },
      };

    case 'ui_reliability':
      return {
        title: 'Investigate UI Errors',
        description: 'Core routes encountered errors during probing — review smoke test details.',
        primary: ctx.canViewDiagnostics
          ? { label: 'Run UI Smoke Test', to: '/admin/ui-smoke?from=health&check=ui_reliability', requires: ['diagnostics'] }
          : { label: 'View Release Status', to: '/release?from=health&check=ui_reliability', requires: ['executive'] },
        secondary: {
          label: 'Go to Dashboard',
          to: '/dashboard',
        },
      };

    default:
      return null;
  }
}

// ── Permission filter ──────────────────────────────────────────────────────

function isLinkAllowed(link: ActionLink, ctx: ActionContext): boolean {
  if (!link.requires || link.requires.length === 0) return true;
  for (const req of link.requires) {
    if (req === 'diagnostics' && !ctx.canViewDiagnostics) return false;
    if (req === 'executive' && !ctx.canViewExecutive) return false;
  }
  return true;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns a deterministic action bundle for a given health check ID.
 * Filters actions based on user permissions.
 * Returns null if no actions available after filtering.
 */
export function getActionsForHealthCheck(
  checkId: string,
  ctx: ActionContext,
): ActionBundle | null {
  const bundle = buildBundle(checkId as HealthCheckId, ctx);
  if (!bundle) return null;

  // Filter primary — if primary is not allowed, try to promote secondary
  if (!isLinkAllowed(bundle.primary, ctx)) {
    if (bundle.secondary && isLinkAllowed(bundle.secondary, ctx)) {
      return {
        ...bundle,
        primary: bundle.secondary,
        secondary: bundle.tertiary && isLinkAllowed(bundle.tertiary, ctx) ? bundle.tertiary : undefined,
        tertiary: undefined,
      };
    }
    if (bundle.tertiary && isLinkAllowed(bundle.tertiary, ctx)) {
      return { ...bundle, primary: bundle.tertiary, secondary: undefined, tertiary: undefined };
    }
    return null;
  }

  // Filter secondary/tertiary
  const secondary = bundle.secondary && isLinkAllowed(bundle.secondary, ctx) ? bundle.secondary : undefined;
  const tertiary = bundle.tertiary && isLinkAllowed(bundle.tertiary, ctx) ? bundle.tertiary : undefined;

  return { ...bundle, secondary, tertiary };
}
