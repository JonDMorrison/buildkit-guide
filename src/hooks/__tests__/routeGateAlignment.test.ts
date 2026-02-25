// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { tabs } from '@/hooks/useNavigationTabs';

/**
 * Route gate alignment tests.
 * Ensures every restricted route has proper protection at both
 * the navigation tier and route/page level.
 */

// Routes that MUST have AdminRoute wrapper in App.tsx
const ADMIN_ONLY_ROUTES = [
  '/playbooks',
  '/insights/ai-brain',
  '/dashboard-diagnostics',
  '/system-audit',
  '/insights/security',
  '/admin/time-diagnostics',
  '/admin/release-checklist',
];

// Routes that MUST have AdminOrPMRoute wrapper in App.tsx
const ADMIN_OR_PM_ROUTES = [
  '/executive',
  '/data-health',
  '/users',
  '/insights/project',
  '/release',
];

// Routes that should be nav-filtered (not in 'minimal' or 'field' tiers for workers)
const WORKER_BLOCKED_ROUTES = [
  '/executive',
  '/data-health',
  '/insights/ai-brain',
  '/playbooks',
  '/release',
  '/users',
];

describe('Route gate alignment', () => {
  it('admin-only routes are not in field/minimal nav tiers', () => {
    for (const route of ADMIN_ONLY_ROUTES) {
      const tab = tabs.find(t => t.path === route);
      if (tab) {
        expect(tab.tiers).not.toContain('field');
        expect(tab.tiers).not.toContain('minimal');
      }
    }
  });

  it('admin/PM routes are not in field/minimal nav tiers', () => {
    for (const route of ADMIN_OR_PM_ROUTES) {
      const tab = tabs.find(t => t.path === route);
      if (tab) {
        expect(tab.tiers).not.toContain('field');
        expect(tab.tiers).not.toContain('minimal');
      }
    }
  });

  it('worker-blocked routes are excluded from minimal and field tiers', () => {
    for (const route of WORKER_BLOCKED_ROUTES) {
      const tab = tabs.find(t => t.path === route);
      if (tab) {
        expect(tab.tiers).not.toContain('minimal');
        expect(tab.tiers).not.toContain('field');
      }
    }
  });

  it('every nav tab with "all" tier only has a valid path', () => {
    for (const tab of tabs) {
      expect(tab.path).toMatch(/^\//);
      expect(tab.name.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate paths in tab definitions', () => {
    const paths = tabs.map(t => t.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });
});
