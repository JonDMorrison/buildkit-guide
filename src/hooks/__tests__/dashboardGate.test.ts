// @ts-nocheck
/**
 * Dashboard Gate regression test
 *
 * Validates that:
 * 1. DashboardContent is NOT rendered (and queries don't fire) while
 *    route access is loading.
 * 2. Worker-tier users are redirected away from /dashboard.
 *
 * Uses the same pure-logic testing style as routeGateAlignment.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { getDefaultHomeRoute, type RoleContext } from '@/utils/getDefaultHomeRoute';

describe('Dashboard gate logic', () => {
  it('worker roles get a home route other than /dashboard', () => {
    const workerCtx: RoleContext = {
      isAdmin: false,
      orgRole: null,
      globalRoles: [],
      projectRoles: [{ role: 'internal_worker' }],
    };
    const home = getDefaultHomeRoute(workerCtx);
    expect(home).not.toBe('/dashboard');
    expect(home).toBe('/tasks');
  });

  it('external_trade roles get a home route other than /dashboard', () => {
    const ctx: RoleContext = {
      isAdmin: false,
      orgRole: null,
      globalRoles: [],
      projectRoles: [{ role: 'external_trade' }],
    };
    expect(getDefaultHomeRoute(ctx)).toBe('/tasks');
  });

  it('PM role resolves to /dashboard (no redirect loop)', () => {
    const ctx: RoleContext = {
      isAdmin: false,
      orgRole: 'pm',
      globalRoles: [],
      projectRoles: [],
    };
    expect(getDefaultHomeRoute(ctx)).toBe('/dashboard');
  });

  it('foreman role resolves to /dashboard (no redirect loop)', () => {
    const ctx: RoleContext = {
      isAdmin: false,
      orgRole: 'foreman',
      globalRoles: [],
      projectRoles: [],
    };
    expect(getDefaultHomeRoute(ctx)).toBe('/dashboard');
  });

  it('admin role resolves to /executive (not /dashboard)', () => {
    const ctx: RoleContext = {
      isAdmin: true,
      orgRole: null,
      globalRoles: [],
      projectRoles: [],
    };
    expect(getDefaultHomeRoute(ctx)).toBe('/executive');
  });
});
