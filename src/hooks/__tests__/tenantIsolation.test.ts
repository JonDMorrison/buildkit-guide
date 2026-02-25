// @ts-nocheck
/**
 * Stage 13 — Tenant Isolation & Permission Regression Tests
 *
 * These tests verify:
 * 1. Shared RPC hooks include orgId in query keys (no cross-org leaks)
 * 2. No inline RPC regressions in key surfaces
 * 3. Route access hook returns deterministic results
 * 4. Home-route mapping is correct per role
 * 5. TenantIsolationSmoke page has admin gate
 */
import { describe, it, expect } from 'vitest';
import { getDefaultHomeRoute } from '@/utils/getDefaultHomeRoute';

// ─── 1. Shared RPC hooks use orgId in query keys ───────────────────────────
describe('Shared RPC hooks org-scoping', () => {
  it('useSnapshotCoverageReport includes orgId in queryKey', async () => {
    const source = await import('@/hooks/rpc/useSnapshotCoverageReport?raw');
    const code = typeof source === 'string' ? source : source.default;
    // Must use activeOrganizationId / orgId in the query key
    expect(code).toContain('useOrganization');
    expect(code).toContain('activeOrganizationId');
    expect(code).toMatch(/queryKey.*orgId/);
    // Must pass orgId to the RPC
    expect(code).toContain('p_org_id');
  });

  it('useDataQualityAudit includes orgId in queryKey', async () => {
    const source = await import('@/hooks/rpc/useDataQualityAudit?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useOrganization');
    expect(code).toContain('activeOrganizationId');
    expect(code).toMatch(/queryKey.*orgId/);
    expect(code).toContain('p_org_id');
  });
});

// ─── 2. No inline RPC regressions ──────────────────────────────────────────
describe('No inline RPC regressions in executive surfaces', () => {
  it('ExecutiveDashboard does not call RPCs inline', async () => {
    const source = await import('@/pages/ExecutiveDashboard?raw');
    const code = typeof source === 'string' ? source : source.default;
    // Should use shared hooks, not direct .rpc() calls
    expect(code).not.toContain('.rpc("rpc_snapshot_coverage_report"');
    expect(code).not.toContain('.rpc("rpc_data_quality_audit"');
  });

  it('AttentionInbox does not call RPCs inline', async () => {
    const source = await import('@/components/executive/AttentionInbox?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).not.toContain('supabase.rpc');
  });
});

// ─── 3. useRouteAccess returns expected shape ───────────────────────────────
describe('useRouteAccess module shape', () => {
  it('exports useRouteAccess and reconciles all role sources', async () => {
    const source = await import('@/hooks/useRouteAccess?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useUserRole');
    expect(code).toContain('useProjectRole');
    expect(code).toContain('useOrganizationRole');
    expect(code).toContain('canViewDiagnostics');
    expect(code).toContain('canViewFinancials');
  });
});

// ─── 4. Home-route mapping determinism ──────────────────────────────────────
describe('getDefaultHomeRoute determinism', () => {
  it('admin => /executive', () => {
    expect(getDefaultHomeRoute({ isAdmin: true })).toBe('/executive');
  });

  it('org admin => /executive', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, orgRole: 'admin' })).toBe('/executive');
  });

  it('hr => /insights', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, orgRole: 'hr' })).toBe('/insights');
  });

  it('accounting => /insights', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, globalRoles: ['accounting'] })).toBe('/insights');
  });

  it('pm (org) => /dashboard', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, orgRole: 'pm' })).toBe('/dashboard');
  });

  it('foreman (org) => /dashboard', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, orgRole: 'foreman' })).toBe('/dashboard');
  });

  it('pm (project) => /dashboard', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, projectRoles: [{ role: 'project_manager' }] })).toBe('/dashboard');
  });

  it('foreman (project) => /dashboard', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, projectRoles: [{ role: 'foreman' }] })).toBe('/dashboard');
  });

  it('internal_worker (project) => /tasks', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, projectRoles: [{ role: 'internal_worker' }] })).toBe('/tasks');
  });

  it('external_trade (project) => /tasks', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, projectRoles: [{ role: 'external_trade' }] })).toBe('/tasks');
  });

  it('internal_worker (global) => /tasks', () => {
    expect(getDefaultHomeRoute({ isAdmin: false, globalRoles: ['internal_worker'] })).toBe('/tasks');
  });

  it('unknown => /dashboard fallback', () => {
    expect(getDefaultHomeRoute({ isAdmin: false })).toBe('/dashboard');
  });
});

// ─── 5. TenantIsolationSmoke admin gate ─────────────────────────────────────
describe('TenantIsolationSmoke page gate', () => {
  it('imports useRouteAccess and NoAccess for defense-in-depth', async () => {
    const source = await import('@/pages/TenantIsolationSmoke?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useRouteAccess');
    expect(code).toContain('NoAccess');
    expect(code).toContain('isAdmin');
  });
});

// ─── 6. Org context wiring in hooks ─────────────────────────────────────────
describe('Org context wiring', () => {
  it('useOrganizationRole queries with org_id + user_id', async () => {
    const source = await import('@/hooks/useOrganizationRole?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('organization_id');
    expect(code).toContain('user_id');
    expect(code).toContain('activeOrganization');
  });

  it('useOrganization provides activeOrganizationId', async () => {
    const source = await import('@/hooks/useOrganization?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('activeOrganizationId');
    expect(code).toContain('OrganizationProvider');
  });
});
