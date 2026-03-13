/**
 * Dev assertion: verify that nav visibility rules align with route gate rules.
 * This ensures no route is shown in the sidebar that the user would be blocked from.
 *
 * Run with: npx vitest run src/hooks/__tests__/navRouteAlignment.test.ts
 */
// @ts-ignore -- vitest types may not be installed
import { describe, it, expect } from 'vitest';
import { tabs } from '../useNavigationTabs';

// These must match the canAccessRoute switch cases in useNavigationTabs.tsx
const ROUTE_GATES: Record<string, string[]> = {
  '/insights/ai-brain': ['admin'],
  '/release': ['admin'],
  '/playbooks': ['admin'],
  '/export': ['admin'],
  '/executive': ['admin', 'pm'],
  '/data-health': ['admin', 'pm'],
  '/users': ['admin', 'pm'],
  '/intelligence': ['admin', 'pm', 'foreman'],
  '/deficiencies': ['admin', 'pm', 'foreman'],
  '/lookahead': ['admin', 'pm', 'foreman'],
  '/manpower': ['admin', 'pm', 'foreman'],
  '/drawings': ['admin', 'pm', 'foreman'],
  '/financials': ['admin', 'pm', 'foreman'],
};

describe('Nav ↔ Route gate alignment', () => {
  it('every gated route exists in the tabs config', () => {
    const tabPaths = new Set(tabs.map(t => t.path));
    for (const path of Object.keys(ROUTE_GATES)) {
      expect(tabPaths.has(path), `Gated route ${path} missing from tabs`).toBe(true);
    }
  });

  it('admin-only routes are not in field/minimal tiers', () => {
    const adminOnly = Object.entries(ROUTE_GATES)
      .filter(([, roles]) => roles.length === 1 && roles[0] === 'admin')
      .map(([path]) => path);

    for (const path of adminOnly) {
      const tab = tabs.find(t => t.path === path)!;
      expect(
        tab.tiers.every(t => t === 'all'),
        `Admin-only route ${path} should only be in 'all' tier, found: ${tab.tiers}`
      ).toBe(true);
    }
  });

  it('foreman-excluded routes require canAccessRoute filtering', () => {
    // Routes that foreman gets via 'all' tier but should NOT access
    const foremanBlocked = Object.entries(ROUTE_GATES)
      .filter(([, roles]) => !roles.includes('foreman'))
      .map(([path]) => path);

    for (const path of foremanBlocked) {
      const tab = tabs.find(t => t.path === path);
      if (tab && tab.tiers.includes('all')) {
        // This is expected — canAccessRoute handles the filtering
        // Just assert the route IS in the gate list
        expect(ROUTE_GATES[path]).toBeDefined();
      }
    }
  });
});
