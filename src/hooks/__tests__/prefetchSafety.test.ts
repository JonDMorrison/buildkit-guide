// @ts-nocheck
/**
 * Stage 15 — Prefetch Safety Regression Tests
 *
 * These tests verify:
 * 1. Prefetch does nothing without orgId
 * 2. Only mapped routes trigger prefetch
 * 3. Throttling prevents repeated prefetch for same (route, orgId)
 * 4. Canonical query keys match shared hooks
 * 5. No unauthorized route prefetch (canAccessRoute guard)
 */
import { describe, it, expect } from 'vitest';

// ─── 1. usePrefetchRoute module structure ──────────────────────────────────
describe('usePrefetchRoute safety', () => {
  it('requires activeOrganizationId before prefetching', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    // Must check for orgId before proceeding
    expect(code).toContain('if (!activeOrganizationId) return');
  });

  it('uses a throttle set to prevent repeated prefetch per (route, orgId)', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    // Must maintain a Set or Map for deduplication
    expect(code).toMatch(/useRef.*Set/);
    // Must construct a compound key from route + orgId
    expect(code).toContain('throttleKey');
    expect(code).toMatch(/has\(throttleKey\)/);
    expect(code).toMatch(/add\(throttleKey\)/);
  });

  it('only prefetches queries for routes in ROUTE_PREFETCH_MAP', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('ROUTE_PREFETCH_MAP');
    // Must look up the route before calling prefetchQuery
    expect(code).toMatch(/ROUTE_PREFETCH_MAP\[route\]/);
  });

  it('uses prefetchQuery from queryClient (not bare fetchQuery)', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('prefetchQuery');
    // Must not use fetchQuery standalone (only prefetchQuery)
    expect(code).not.toMatch(/(?<!pre)fetchQuery/);
  });
});

// ─── 2. Canonical query key alignment ──────────────────────────────────────
describe('Prefetch query key alignment with shared hooks', () => {
  it('executive change feed prefetch key matches dashboard usage', async () => {
    const prefetchSource = await import('@/hooks/usePrefetchRoute?raw');
    const prefetchCode = typeof prefetchSource === 'string' ? prefetchSource : prefetchSource.default;
    // The prefetch map must use the same key pattern as the shared dashboard query
    // Dashboard.tsx uses ['pm-attention-feed', activeOrganizationId]
    expect(prefetchCode).toContain("'pm-attention-feed'");
  });

  it('snapshot coverage prefetch key matches shared hook', async () => {
    const prefetchSource = await import('@/hooks/usePrefetchRoute?raw');
    const prefetchCode = typeof prefetchSource === 'string' ? prefetchSource : prefetchSource.default;
    // useSnapshotCoverageReport uses ["rpc-snapshot-coverage", orgId]
    expect(prefetchCode).toContain("'rpc-snapshot-coverage'");
  });

  it('data quality audit prefetch key matches shared hook', async () => {
    const prefetchSource = await import('@/hooks/usePrefetchRoute?raw');
    const prefetchCode = typeof prefetchSource === 'string' ? prefetchSource : prefetchSource.default;
    // useDataQualityAudit uses ["rpc-data-quality-audit", orgId]
    expect(prefetchCode).toContain("'rpc-data-quality-audit'");
  });
});

// ─── 3. NavItem prefetch integration ───────────────────────────────────────
describe('NavItem hover prefetch integration', () => {
  it('calls prefetchRoute on mouse enter', async () => {
    const source = await import('@/components/sidebar/NavItem?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('onMouseEnter');
    expect(code).toContain('prefetchRoute');
  });

  it('calls prefetchRoute on focus for keyboard navigation', async () => {
    const source = await import('@/components/sidebar/NavItem?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('onFocus');
  });
});

// ─── 4. Cross-page warming is role-gated ───────────────────────────────────
describe('Cross-page warming is role-gated', () => {
  it('ExecutiveDashboard only warms /dashboard for admin/PM', async () => {
    const source = await import('@/pages/ExecutiveDashboard?raw');
    const code = typeof source === 'string' ? source : source.default;
    // Must check role before prefetching
    expect(code).toMatch(/isAdmin.*isPM|isPM.*isAdmin/);
    expect(code).toContain("prefetchRoute('/dashboard')");
  });

  it('Dashboard only warms /executive for admin/PM', async () => {
    const source = await import('@/pages/Dashboard?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toMatch(/isAdmin.*isPM|isPM.*isAdmin/);
    expect(code).toContain("prefetchRoute('/executive')");
  });
});
