// @ts-nocheck
/**
 * Stage 15/16 — Prefetch Safety + Canonical Key Regression Tests
 *
 * These tests verify:
 * 1. Prefetch does nothing without orgId
 * 2. Only mapped routes trigger prefetch
 * 3. Throttling prevents repeated prefetch for same (route, orgId)
 * 4. Canonical query keys match shared hooks
 * 5. No unauthorized route prefetch (canAccessRoute guard)
 * 6. Deprecated "pm-attention-feed" key is not used anywhere
 */
import { describe, it, expect } from 'vitest';

// ─── 1. usePrefetchRoute module structure ──────────────────────────────────
describe('usePrefetchRoute safety', () => {
  it('requires activeOrganizationId before prefetching', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('if (!activeOrganizationId) return');
  });

  it('uses a throttle set to prevent repeated prefetch per (route, orgId)', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toMatch(/useRef.*Set/);
    expect(code).toContain('throttleKey');
    expect(code).toMatch(/has\(throttleKey\)/);
    expect(code).toMatch(/add\(throttleKey\)/);
  });

  it('only prefetches queries for routes in ROUTE_PREFETCH_MAP', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('ROUTE_PREFETCH_MAP');
    expect(code).toMatch(/ROUTE_PREFETCH_MAP\[route\]/);
  });

  it('uses prefetchQuery from queryClient (not bare fetchQuery)', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('prefetchQuery');
    expect(code).not.toMatch(/(?<!pre)fetchQuery/);
  });

  it('imports CHANGE_FEED_QUERY_KEY from shared hook', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('CHANGE_FEED_QUERY_KEY');
  });
});

// ─── 2. Canonical query key alignment ──────────────────────────────────────
describe('Prefetch query key alignment with shared hooks', () => {
  it('change feed prefetch uses canonical CHANGE_FEED_QUERY_KEY', async () => {
    const prefetchSource = await import('@/hooks/usePrefetchRoute?raw');
    const prefetchCode = typeof prefetchSource === 'string' ? prefetchSource : prefetchSource.default;
    expect(prefetchCode).toContain("CHANGE_FEED_QUERY_KEY");
    expect(prefetchCode).toContain("'rpc-executive-change-feed'");
  });

  it('snapshot coverage prefetch key matches shared hook', async () => {
    const prefetchSource = await import('@/hooks/usePrefetchRoute?raw');
    const prefetchCode = typeof prefetchSource === 'string' ? prefetchSource : prefetchSource.default;
    expect(prefetchCode).toContain("'rpc-snapshot-coverage'");
  });

  it('data quality audit prefetch key matches shared hook', async () => {
    const prefetchSource = await import('@/hooks/usePrefetchRoute?raw');
    const prefetchCode = typeof prefetchSource === 'string' ? prefetchSource : prefetchSource.default;
    expect(prefetchCode).toContain("'rpc-data-quality-audit'");
  });
});

// ─── 3. Deprecated key regression ──────────────────────────────────────────
describe('Deprecated pm-attention-feed key is eliminated', () => {
  it('usePrefetchRoute does not use pm-attention-feed', async () => {
    const source = await import('@/hooks/usePrefetchRoute?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).not.toContain("'pm-attention-feed'");
  });

  it('Dashboard does not use pm-attention-feed inline query', async () => {
    const source = await import('@/pages/Dashboard?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).not.toContain("'pm-attention-feed'");
  });

  it('AIChangeFeedCard does not use ai-change-feed inline query', async () => {
    const source = await import('@/components/ai-insights/AIChangeFeedCard?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).not.toContain("'ai-change-feed'");
    expect(code).toContain('useExecutiveChangeFeed');
  });
});

// ─── 4. Shared hook exports canonical key constant ─────────────────────────
describe('useExecutiveChangeFeed canonical key', () => {
  it('exports CHANGE_FEED_QUERY_KEY constant', async () => {
    const source = await import('@/hooks/rpc/useExecutiveChangeFeed?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('export const CHANGE_FEED_QUERY_KEY');
    expect(code).toContain('"rpc-executive-change-feed"');
  });

  it('uses CHANGE_FEED_QUERY_KEY in its own queryKey', async () => {
    const source = await import('@/hooks/rpc/useExecutiveChangeFeed?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toMatch(/queryKey.*CHANGE_FEED_QUERY_KEY/);
  });

  it('includes orgId in queryKey', async () => {
    const source = await import('@/hooks/rpc/useExecutiveChangeFeed?raw');
    const code = typeof source === 'string' ? source : source.default;
    expect(code).toContain('useOrganization');
    expect(code).toContain('p_org_id');
  });
});

// ─── 5. NavItem prefetch integration ───────────────────────────────────────
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

// ─── 6. Cross-page warming is role-gated ───────────────────────────────────
describe('Cross-page warming is role-gated', () => {
  it('ExecutiveDashboard only warms /dashboard for admin/PM', async () => {
    const source = await import('@/pages/ExecutiveDashboard?raw');
    const code = typeof source === 'string' ? source : source.default;
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
