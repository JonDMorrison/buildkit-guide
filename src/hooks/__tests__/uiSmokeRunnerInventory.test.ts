// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { getSmokeRoutes, getSmokeRoutesForRole, classifyResult } from '@/lib/uiSmokeRunner';
import { ROUTE_WRAPPER_MAP, NAV_ROUTE_LISTS } from '@/lib/routeInventory';

describe('getSmokeRoutes determinism & validity', () => {
  const routes = getSmokeRoutes();

  it('returns a non-empty array', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('is deterministic (same order on repeated calls)', () => {
    const second = getSmokeRoutes();
    expect(routes).toEqual(second);
  });

  it('is sorted alphabetically', () => {
    const sorted = [...routes].sort();
    expect(routes).toEqual(sorted);
  });

  it('has no duplicates', () => {
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
  });

  it('every route exists in ROUTE_WRAPPER_MAP', () => {
    for (const route of routes) {
      expect(
        ROUTE_WRAPPER_MAP[route],
        `Smoke route ${route} not found in ROUTE_WRAPPER_MAP`
      ).toBeDefined();
    }
  });

  it('contains no parameterised routes', () => {
    for (const route of routes) {
      expect(route).not.toContain(':');
    }
  });

  it('contains no public routes', () => {
    for (const route of routes) {
      const wrappers = ROUTE_WRAPPER_MAP[route];
      expect(wrappers).not.toContain('public');
    }
  });

  it('includes all admin nav routes', () => {
    for (const navRoute of NAV_ROUTE_LISTS.admin) {
      if (!navRoute.includes(':')) {
        expect(routes).toContain(navRoute);
      }
    }
  });

  it('includes critical deep links', () => {
    const critical = ['/dashboard', '/executive', '/insights', '/projects', '/tasks'];
    for (const path of critical) {
      expect(routes).toContain(path);
    }
  });
});

describe('getSmokeRoutesForRole determinism & validity', () => {
  const roles = ['admin', 'pm', 'foreman', 'internal_worker'] as const;

  for (const role of roles) {
    it(`${role}: returns sorted, deduplicated routes`, () => {
      const routes = getSmokeRoutesForRole(role);
      expect(routes.length).toBeGreaterThan(0);
      const sorted = [...routes].sort();
      expect(routes).toEqual(sorted);
      expect(new Set(routes).size).toBe(routes.length);
    });

    it(`${role}: is deterministic`, () => {
      const a = getSmokeRoutesForRole(role);
      const b = getSmokeRoutesForRole(role);
      expect(a).toEqual(b);
    });

    it(`${role}: contains no parameterised routes`, () => {
      for (const route of getSmokeRoutesForRole(role)) {
        expect(route).not.toContain(':');
      }
    });
  }

  it('admin has >= pm routes', () => {
    expect(getSmokeRoutesForRole('admin').length).toBeGreaterThanOrEqual(
      getSmokeRoutesForRole('pm').length
    );
  });

  it('pm has >= foreman routes', () => {
    expect(getSmokeRoutesForRole('pm').length).toBeGreaterThanOrEqual(
      getSmokeRoutesForRole('foreman').length
    );
  });
});

describe('classifyResult severity logic', () => {
  const makeResult = (overrides: Partial<any> = {}): any => ({
    path: '/test',
    status: 'pass',
    severity: 'INFO',
    durationMs: 100,
    finalPathname: '/test',
    consoleLogs: [],
    ...overrides,
  });

  it('classifies console.error as BLOCKER', () => {
    const r = makeResult({
      status: 'fail',
      errorMessage: '1 console error(s)',
      consoleLogs: [{ level: 'error', message: 'Something broke', ts: 0 }],
    });
    expect(classifyResult(r)).toBe('BLOCKER');
  });

  it('classifies dynamic import failure as BLOCKER', () => {
    const r = makeResult({
      status: 'fail',
      consoleLogs: [{ level: 'error', message: 'Failed to fetch dynamically imported module', ts: 0 }],
    });
    expect(classifyResult(r)).toBe('BLOCKER');
  });

  it('classifies redirect on accessible route as MAJOR for role', () => {
    const r = makeResult({
      status: 'redirect',
      path: '/dashboard',
      finalPathname: '/auth',
    });
    expect(classifyResult(r, 'pm')).toBe('MAJOR');
  });

  it('classifies redirect on inaccessible route as INFO', () => {
    const r = makeResult({
      status: 'redirect',
      path: '/insights/ai-brain',
      finalPathname: '/dashboard',
    });
    // ai-brain is admin-only, pm can't access it
    expect(classifyResult(r, 'pm')).toBe('INFO');
  });

  it('classifies console.warn as MINOR', () => {
    const r = makeResult({
      consoleLogs: [{ level: 'warn', message: 'Deprecation warning', ts: 0 }],
    });
    expect(classifyResult(r)).toBe('MINOR');
  });

  it('classifies clean pass as INFO', () => {
    const r = makeResult({});
    expect(classifyResult(r)).toBe('INFO');
  });

  it('classifies probe skip as MINOR', () => {
    const r = makeResult({
      probeResults: [{ name: 'test', status: 'skip', error: 'not found' }],
    });
    expect(classifyResult(r)).toBe('MINOR');
  });
});
