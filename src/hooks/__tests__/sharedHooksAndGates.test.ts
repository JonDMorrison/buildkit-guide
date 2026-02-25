// @ts-nocheck
/**
 * Stage 3 regression tests:
 * - Shared RPC hooks are the canonical import paths
 * - DashboardDiagnostics blocks non-admin at page level
 */
import { describe, it, expect } from 'vitest';

describe('Shared RPC hook canonical paths', () => {
  it('useSnapshotCoverageReport module exists and exports the hook', async () => {
    const source = await import('@/hooks/rpc/useSnapshotCoverageReport?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('export function useSnapshotCoverageReport');
    expect(code).toContain('rpc_snapshot_coverage_report');
  });

  it('useDataQualityAudit module exists and exports the hook', async () => {
    const source = await import('@/hooks/rpc/useDataQualityAudit?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('export function useDataQualityAudit');
    expect(code).toContain('rpc_data_quality_audit');
  });

  it('SnapshotStatusCard imports from shared hook (not inline RPC)', async () => {
    const source = await import('@/components/executive/SnapshotStatusCard?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useSnapshotCoverageReport');
    expect(code).not.toContain("supabase.rpc");
    expect(code).not.toContain('supabase as any).rpc("rpc_snapshot_coverage_report"');
  });

  it('DashboardMissionControl imports from shared hooks (not inline RPC)', async () => {
    const source = await import('@/components/dashboard/DashboardMissionControl?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useSnapshotCoverageReport');
    expect(code).toContain('useDataQualityAudit');
    expect(code).not.toContain('.rpc("rpc_snapshot_coverage_report"');
    expect(code).not.toContain('.rpc("rpc_data_quality_audit"');
  });

  it('DataIntegrityBannerCard imports from shared hook (not inline RPC)', async () => {
    const source = await import('@/components/insights/accounting/DataIntegrityBannerCard?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useDataQualityAudit');
    expect(code).not.toContain('.rpc("rpc_data_quality_audit"');
  });
});

describe('DashboardDiagnostics page gate', () => {
  it('imports useRouteAccess and NoAccess for defense-in-depth', async () => {
    const source = await import('@/pages/DashboardDiagnostics?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useRouteAccess');
    expect(code).toContain('NoAccess');
  });
});
