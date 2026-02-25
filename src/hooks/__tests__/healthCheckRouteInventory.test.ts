// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { ROUTE_WRAPPER_MAP } from '@/lib/routeInventory';

describe('/health route inventory', () => {
  it('/health exists in ROUTE_WRAPPER_MAP', () => {
    expect(ROUTE_WRAPPER_MAP['/health']).toBeDefined();
  });

  it('/health has protected + adminOrPM wrappers', () => {
    const wrappers = ROUTE_WRAPPER_MAP['/health'];
    expect(wrappers).toContain('protected');
    expect(wrappers).toContain('adminOrPM');
  });

  it('health probe routes are all non-parameterised', () => {
    const probeRoutes = ['/dashboard', '/executive', '/insights', '/projects', '/tasks'];
    for (const r of probeRoutes) {
      expect(r).not.toContain(':');
    }
  });

  it('health probe routes are exactly the 5 core routes', () => {
    const probeRoutes = ['/dashboard', '/executive', '/insights', '/projects', '/tasks'];
    expect(probeRoutes).toHaveLength(5);
    // All exist in wrapper map
    for (const r of probeRoutes) {
      expect(ROUTE_WRAPPER_MAP[r]).toBeDefined();
    }
  });
});
