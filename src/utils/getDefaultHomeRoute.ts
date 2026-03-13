/**
 * Role-based default home route mapping:
 *
 *   internal_worker | external_trade  => "/tasks"
 *   foreman | pm                      => "/dashboard"
 *   accounting / office tier          => "/insights"
 *   admin / global admin              => "/executive"
 *
 * Falls back to "/dashboard" when role context is unavailable.
 */

export interface RoleContext {
  isAdmin?: boolean;
  /** Organisation-level role (from organization_memberships) */
  orgRole?: string | null;
  /** Global user_roles entries */
  globalRoles?: string[];
  /** Per-project roles the user holds */
  projectRoles?: { role: string }[];
}

export function getDefaultHomeRoute(ctx: RoleContext): string {
  // 1. Admin / global admin => executive
  if (ctx.isAdmin) return '/executive';

  // 2. Accounting / HR (office tier) => insights
  if (ctx.orgRole === 'hr') return '/insights';
  if (ctx.globalRoles?.includes('accounting')) return '/insights';

  // 3. PM or Foreman at org or project level => dashboard
  if (ctx.orgRole === 'pm' || ctx.orgRole === 'foreman') return '/dashboard';
  if (ctx.orgRole === 'admin') return '/executive';

  const hasPM = ctx.projectRoles?.some(r => r.role === 'project_manager');
  const hasForeman = ctx.projectRoles?.some(r => r.role === 'foreman');
  if (hasPM || hasForeman) return '/dashboard';

  // 4. Internal worker / external trade => tasks
  const hasWorker = ctx.projectRoles?.some(
    r => r.role === 'internal_worker' || r.role === 'external_trade',
  );
  if (hasWorker) return '/tasks';

  if (ctx.globalRoles?.includes('internal_worker') || ctx.globalRoles?.includes('external_trade')) {
    return '/tasks';
  }

  // Fallback: new users with no roles go to onboarding, not dashboard (which requires roles)
  return '/welcome';
}
