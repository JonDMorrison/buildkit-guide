// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { tabs } from '@/hooks/useNavigationTabs';
import {
  ROUTE_WRAPPER_MAP,
  NAV_ROUTE_LISTS,
  canAccessRoute,
  getNavRoutesForRole,
  roleToNavTier,
  type RoleName,
  type RouteWrapper,
} from '@/lib/routeInventory';

const ALL_ROLES: RoleName[] = ['admin', 'pm', 'foreman', 'accounting', 'hr', 'internal_worker', 'external_trade'];

// ── 1. Route inventory completeness ────────────────────────────────────────
describe('Route inventory completeness', () => {
  it('every nav tab path exists in ROUTE_WRAPPER_MAP', () => {
    for (const tab of tabs) {
      expect(
        ROUTE_WRAPPER_MAP[tab.path],
        `Nav tab "${tab.name}" (${tab.path}) missing from ROUTE_WRAPPER_MAP`
      ).toBeDefined();
    }
  });

  it('ROUTE_WRAPPER_MAP has no empty-string paths', () => {
    for (const path of Object.keys(ROUTE_WRAPPER_MAP)) {
      expect(path.length).toBeGreaterThan(0);
    }
  });
});

// ── 2. Per-role nav route enumeration ──────────────────────────────────────
describe('Per-role nav route enumeration', () => {
  for (const role of ALL_ROLES) {
    it(`${role}: has at least one visible route`, () => {
      expect(NAV_ROUTE_LISTS[role].length).toBeGreaterThan(0);
    });
  }

  it('external_trade sees only minimal routes (tasks, time, receipts)', () => {
    const routes = NAV_ROUTE_LISTS.external_trade;
    // Should not contain admin/PM routes
    expect(routes).not.toContain('/executive');
    expect(routes).not.toContain('/data-health');
    expect(routes).not.toContain('/playbooks');
    expect(routes).not.toContain('/users');
    expect(routes).not.toContain('/insights');
    expect(routes).not.toContain('/intelligence');
    // Should contain essential routes
    expect(routes).toContain('/tasks');
    expect(routes).toContain('/receipts');
  });

  it('internal_worker sees field routes but not admin routes', () => {
    const routes = NAV_ROUTE_LISTS.internal_worker;
    expect(routes).toContain('/tasks');
    expect(routes).toContain('/safety');
    expect(routes).toContain('/receipts');
    expect(routes).not.toContain('/executive');
    expect(routes).not.toContain('/playbooks');
    expect(routes).not.toContain('/users');
  });

  it('accounting sees office routes but not admin-only routes', () => {
    const routes = NAV_ROUTE_LISTS.accounting;
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/hours-tracking');
    expect(routes).toContain('/receipts');
    expect(routes).not.toContain('/playbooks');
    expect(routes).not.toContain('/insights/ai-brain');
  });

  it('admin sees all routes', () => {
    const routes = NAV_ROUTE_LISTS.admin;
    expect(routes).toContain('/dashboard');
    expect(routes).toContain('/executive');
    expect(routes).toContain('/playbooks');
    expect(routes).toContain('/data-health');
    expect(routes).toContain('/tasks');
  });
});

// ── 3. Nav/gate alignment — no route shown that would NoAccess ─────────────
describe('Nav/gate alignment — no route shown that would block', () => {
  // Routes with AdminRoute wrapper — only admin can access
  const ADMIN_WRAPPER_ROUTES = Object.entries(ROUTE_WRAPPER_MAP)
    .filter(([, wrappers]) => wrappers.includes('admin'))
    .map(([path]) => path);

  // Routes with AdminOrPMRoute wrapper — only admin or PM can access
  const ADMIN_OR_PM_WRAPPER_ROUTES = Object.entries(ROUTE_WRAPPER_MAP)
    .filter(([, wrappers]) => wrappers.includes('adminOrPM'))
    .map(([path]) => path);

  for (const role of ALL_ROLES) {
    it(`${role}: no admin-wrapped routes visible if role is not admin`, () => {
      if (role === 'admin') return; // admin can access everything
      const visibleRoutes = NAV_ROUTE_LISTS[role];
      for (const route of ADMIN_WRAPPER_ROUTES) {
        expect(
          visibleRoutes.includes(route),
          `${role} should NOT see admin-only route ${route}`
        ).toBe(false);
      }
    });

    it(`${role}: no adminOrPM-wrapped routes visible if role lacks access`, () => {
      if (role === 'admin' || role === 'pm') return;
      const visibleRoutes = NAV_ROUTE_LISTS[role];
      for (const route of ADMIN_OR_PM_WRAPPER_ROUTES) {
        expect(
          visibleRoutes.includes(route),
          `${role} should NOT see adminOrPM route ${route}`
        ).toBe(false);
      }
    });
  }
});

// ── 4. canAccessRoute ↔ App.tsx wrapper consistency ────────────────────────
describe('canAccessRoute ↔ route wrapper consistency', () => {
  it('admin-only canAccessRoute routes should have admin wrapper in App.tsx', () => {
    // These routes return false for non-admin in canAccessRoute
    const adminOnlyPaths = ['/insights/ai-brain', '/playbooks'];
    for (const path of adminOnlyPaths) {
      const wrappers = ROUTE_WRAPPER_MAP[path];
      expect(
        wrappers?.includes('admin'),
        `${path}: canAccessRoute blocks non-admin but App.tsx lacks AdminRoute wrapper`
      ).toBe(true);
    }
  });

  it('/release: canAccessRoute is admin-only but App.tsx wrapper is adminOrPM', () => {
    // This is a KNOWN MISMATCH to flag:
    // canAccessRoute('/release', 'pm') returns false (only admin)
    // But App.tsx wraps it with AdminOrPMRoute (allows PM)
    // The nav hides it from PM, but PM could access via direct URL → allowed by wrapper
    // This is technically safe (over-permissive wrapper, nav hides it)
    // but the canAccessRoute is MORE restrictive than the wrapper
    const pmCanAccess = canAccessRoute('/release', 'pm');
    const wrappers = ROUTE_WRAPPER_MAP['/release'];
    // Flag: canAccessRoute says NO for PM, but wrapper says YES
    // This means PM can access via URL but won't see it in nav
    expect(pmCanAccess).toBe(false); // nav hides it
    expect(wrappers).toContain('adminOrPM'); // wrapper allows it
    // NOTE: This mismatch is flagged in audit report as MINOR
  });

  it('adminOrPM canAccessRoute routes match App.tsx wrappers', () => {
    const adminOrPmPaths = ['/executive', '/data-health', '/users'];
    for (const path of adminOrPmPaths) {
      const wrappers = ROUTE_WRAPPER_MAP[path];
      const pmAllowed = canAccessRoute(path, 'pm');
      expect(pmAllowed).toBe(true);
      expect(
        wrappers?.includes('adminOrPM') || wrappers?.includes('admin'),
        `${path}: should have admin or adminOrPM wrapper`
      ).toBe(true);
    }
  });

  it('foreman-accessible routes do NOT have admin/adminOrPM wrapper', () => {
    // Routes that canAccessRoute allows for foreman should not be blocked at wrapper level
    const foremanRoutes = ['/intelligence', '/deficiencies', '/lookahead', '/manpower', '/drawings', '/estimates'];
    for (const path of foremanRoutes) {
      const wrappers = ROUTE_WRAPPER_MAP[path] ?? [];
      expect(
        !wrappers.includes('admin') && !wrappers.includes('adminOrPM'),
        `${path}: foreman should not be blocked by route wrapper but has ${wrappers.join(',')}`
      ).toBe(true);
    }
  });
});

// ── 5. Protected routes have at minimum ProtectedRoute ─────────────────────
describe('All authenticated routes have ProtectedRoute', () => {
  const authRoutes = Object.entries(ROUTE_WRAPPER_MAP).filter(
    ([path, wrappers]) => !['/', '/how-it-works', '/safety-security', '/features', '/responsible-ai', '/auth', '/accept-invite'].includes(path)
  );

  for (const [path, wrappers] of authRoutes) {
    it(`${path} has ProtectedRoute wrapper`, () => {
      expect(
        wrappers.includes('protected'),
        `${path} is missing ProtectedRoute wrapper`
      ).toBe(true);
    });
  }
});

// ── 6. No nav route leads to a 404 (path exists in ROUTE_WRAPPER_MAP) ──────
describe('No nav route leads to a 404', () => {
  for (const role of ALL_ROLES) {
    it(`${role}: all visible routes exist in App.tsx`, () => {
      const routes = NAV_ROUTE_LISTS[role];
      for (const route of routes) {
        expect(
          ROUTE_WRAPPER_MAP[route],
          `${role} nav shows ${route} but it's not in ROUTE_WRAPPER_MAP (would 404)`
        ).toBeDefined();
      }
    });
  }
});
