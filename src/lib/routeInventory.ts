/**
 * Route inventory derived from App.tsx route definitions and useNavigationTabs.
 * Single source of truth for audit tests — do NOT duplicate manually.
 */
import { tabs, type TabConfig } from '@/hooks/useNavigationTabs';

// ── Route wrapper types ────────────────────────────────────────────────────
export type RouteWrapper = 'public' | 'protected' | 'adminOrPM' | 'admin' | 'timeGate';

/**
 * Maps every route path in App.tsx to its wrapper type(s).
 * Order: outermost → innermost.
 * 'protected' means ProtectedRoute only.
 * 'admin' means ProtectedRoute + AdminRoute.
 * 'adminOrPM' means ProtectedRoute + AdminOrPMRoute.
 * 'timeGate' means ProtectedRoute + TimeTrackingGate.
 * 'public' means PublicRoute (no auth required).
 *
 * IMPORTANT: keep in sync with App.tsx — tests will catch drift.
 */
export const ROUTE_WRAPPER_MAP: Record<string, RouteWrapper[]> = {
  // Public routes
  '/': ['public'],
  '/how-it-works': ['public'],
  '/safety-security': ['public'],
  '/features': ['public'],
  '/responsible-ai': ['public'],

  // Auth (no wrapper)
  '/auth': [],
  '/accept-invite': [],

  // Protected-only routes
  '/welcome': ['protected'],
  '/setup': ['protected'],
  '/dashboard': ['protected'],
  '/projects': ['protected'],
  '/projects/:projectId': ['protected'],
  '/projects/:projectId/receipts': ['protected'],
  '/tasks': ['protected'],
  '/lookahead': ['protected'],
  '/manpower': ['protected'],
  '/deficiencies': ['protected'],
  '/projects/:projectId/deficiency-import': ['protected'],
  '/safety': ['protected'],
  '/ai': ['protected'],
  '/notifications': ['protected'],
  '/settings/notifications': ['protected'],
  '/settings/labor-rates': ['protected'],
  '/settings/organization': ['protected'],
  '/documents': ['protected'],
  '/audit': ['protected'],
  '/daily-logs': ['protected'],
  '/receipts': ['protected'],
  '/accounting/receipts': ['protected'],
  '/time-tracking-not-enabled': ['protected'],
  '/time/requests': ['protected'],
  '/time/periods': ['protected'],
  '/drawings': ['protected'],
  '/hours-tracking': ['protected'],
  '/job-cost-report': ['protected'],
  '/invoicing': ['protected'],
  '/financials': ['protected'],
  '/estimates': ['protected'],
  '/estimates/:estimateId': ['protected'],
  '/quotes': ['protected'],
  '/proposals': ['protected'],
  '/change-orders': ['protected'],
  '/change-orders/:id': ['protected'],
  '/insights': ['protected'],
  '/intelligence': ['protected'],
  '/insights/snapshots': ['protected'],
  '/docs/qa-gauntlet': ['protected'],
  '/workflow': ['protected'],
  '/audit/prompts-1-10': ['protected'],
  '/insights/audit': ['protected'],
  '/insights/conversion-test': ['protected'],
  '/executive-report': ['protected'],

  // Protected + TimeTrackingGate
  '/time': ['protected', 'timeGate'],

  // Protected + AdminOrPMRoute
  '/users': ['protected', 'adminOrPM'],
  '/insights/project': ['protected', 'adminOrPM'],
  '/data-health': ['protected', 'adminOrPM'],
  '/release': ['protected', 'adminOrPM'],
  '/executive': ['protected', 'adminOrPM'],
  '/health': ['protected', 'adminOrPM'],

  '/export': ['protected'],

  // Protected + AdminRoute
  '/admin/time-diagnostics': ['protected', 'admin'],
  '/insights/security': ['protected', 'admin'],
  '/insights/ai-brain': ['protected', 'admin'],
  '/playbooks': ['protected', 'admin'],
  '/admin/release-checklist': ['protected', 'admin'],
  '/dashboard-diagnostics': ['protected', 'admin'],
  '/admin/tenant-isolation': ['protected', 'admin'],
  '/admin/ui-smoke': ['protected', 'admin'],
  '/qa': ['protected', 'admin'],
  '/system-audit': ['protected', 'admin'],
};

// ── Nav tier → role mapping ────────────────────────────────────────────────
export type RoleName = 'admin' | 'pm' | 'foreman' | 'accounting' | 'hr' | 'internal_worker' | 'external_trade';

/**
 * Maps a role to its navigation tier (mirrors useNavigationTabs.tsx navTier logic).
 */
export function roleToNavTier(role: RoleName): 'all' | 'office' | 'field' | 'minimal' {
  switch (role) {
    case 'admin':
    case 'pm':
    case 'foreman':
    case 'hr':
      return 'all';
    case 'accounting':
      return 'office';
    case 'internal_worker':
      return 'field';
    case 'external_trade':
      return 'minimal';
  }
}

/**
 * canAccessRoute logic duplicated for static analysis (mirrors useNavigationTabs.tsx).
 */
export function canAccessRoute(path: string, role: RoleName): boolean {
  const isAdmin = role === 'admin';
  const isPM = role === 'pm';
  const isForeman = role === 'foreman';

  switch (path) {
    case '/insights/ai-brain':
    case '/release':
    case '/playbooks':
    case '/export':
      return isAdmin;
    case '/executive':
    case '/data-health':
    case '/users':
    case '/health':
      return isAdmin || isPM;
    case '/intelligence':
    case '/deficiencies':
    case '/lookahead':
    case '/manpower':
    case '/drawings':
    case '/financials':
      return isAdmin || isPM || isForeman;
    default:
      return true;
  }
}

/**
 * Returns which nav routes a given role would see (excluding time/workflow feature flags).
 */
export function getNavRoutesForRole(role: RoleName): string[] {
  const tier = roleToNavTier(role);
  return tabs
    .filter(tab => tab.tiers.includes(tier) && canAccessRoute(tab.path, role))
    .map(tab => tab.path);
}

/** Convenience: all roles → their visible routes. */
export const NAV_ROUTE_LISTS: Record<RoleName, string[]> = {
  admin: getNavRoutesForRole('admin'),
  pm: getNavRoutesForRole('pm'),
  foreman: getNavRoutesForRole('foreman'),
  accounting: getNavRoutesForRole('accounting'),
  hr: getNavRoutesForRole('hr'),
  internal_worker: getNavRoutesForRole('internal_worker'),
  external_trade: getNavRoutesForRole('external_trade'),
};

/**
 * Returns the route-level wrapper required for a route, or null if not in App.tsx.
 */
export function getRouteProtection(path: string): RouteWrapper[] | null {
  return ROUTE_WRAPPER_MAP[path] ?? null;
}
