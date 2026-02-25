// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { getSmokeRoutes } from '@/lib/uiSmokeRunner';
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
