import { describe, it, expect } from 'vitest';
import {
  getActionsForHealthCheck,
  HEALTH_CHECK_IDS,
  type ActionContext,
  type ActionBundle,
} from '@/lib/actionRouter';
import { ROUTE_WRAPPER_MAP } from '@/lib/routeInventory';

const ADMIN_CTX: ActionContext = {
  orgId: 'org-1',
  canViewDiagnostics: true,
  canViewExecutive: true,
};

const PM_CTX: ActionContext = {
  orgId: 'org-1',
  canViewDiagnostics: false,
  canViewExecutive: true,
};

const MINIMAL_CTX: ActionContext = {
  orgId: 'org-1',
  canViewDiagnostics: false,
  canViewExecutive: false,
};

function stripQuery(path: string): string {
  return path.split('?')[0];
}

describe('actionRouter', () => {
  it('returns a bundle for every checkId with admin context', () => {
    for (const id of HEALTH_CHECK_IDS) {
      const bundle = getActionsForHealthCheck(id, ADMIN_CTX);
      expect(bundle).not.toBeNull();
      expect(bundle!.primary.to).toMatch(/^\//);
      expect(bundle!.primary.label.length).toBeGreaterThan(0);
    }
  });

  it('returns deterministic results on repeated calls', () => {
    for (const id of HEALTH_CHECK_IDS) {
      const a = getActionsForHealthCheck(id, ADMIN_CTX);
      const b = getActionsForHealthCheck(id, ADMIN_CTX);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });

  it('primary routes exist in ROUTE_WRAPPER_MAP', () => {
    for (const id of HEALTH_CHECK_IDS) {
      const bundle = getActionsForHealthCheck(id, ADMIN_CTX);
      if (bundle) {
        const path = stripQuery(bundle.primary.to);
        expect(ROUTE_WRAPPER_MAP[path]).toBeDefined();
      }
    }
  });

  it('filters diagnostics-only actions for PM context', () => {
    const adminBundle = getActionsForHealthCheck('ui_reliability', ADMIN_CTX);
    const pmBundle = getActionsForHealthCheck('ui_reliability', PM_CTX);
    // Admin gets /admin/ui-smoke as primary; PM should not
    expect(adminBundle!.primary.to).toBe('/admin/ui-smoke');
    expect(pmBundle!.primary.to).not.toBe('/admin/ui-smoke');
  });

  it('filters executive-only actions for minimal context', () => {
    const bundle = getActionsForHealthCheck('snapshot_freshness', MINIMAL_CTX);
    // With no executive or diagnostics, primary should be filtered/promoted or null
    // snapshot_freshness primary requires executive, so it should promote or return null
    if (bundle) {
      expect(bundle.primary.requires ?? []).not.toContain('executive');
      expect(bundle.primary.requires ?? []).not.toContain('diagnostics');
    }
  });

  it('secondary routes start with /', () => {
    for (const id of HEALTH_CHECK_IDS) {
      const bundle = getActionsForHealthCheck(id, ADMIN_CTX);
      if (bundle?.secondary) {
        expect(bundle.secondary.to).toMatch(/^\//);
      }
      if (bundle?.tertiary) {
        expect(bundle.tertiary.to).toMatch(/^\//);
      }
    }
  });

  it('returns null for unknown checkId', () => {
    const bundle = getActionsForHealthCheck('nonexistent_check', ADMIN_CTX);
    expect(bundle).toBeNull();
  });

  it('ordering is always primary then secondary then tertiary', () => {
    const bundle = getActionsForHealthCheck('data_quality', ADMIN_CTX);
    expect(bundle).not.toBeNull();
    expect(bundle!.primary).toBeDefined();
    // data_quality should have all three for admin
    expect(bundle!.secondary).toBeDefined();
    expect(bundle!.tertiary).toBeDefined();
  });
});
