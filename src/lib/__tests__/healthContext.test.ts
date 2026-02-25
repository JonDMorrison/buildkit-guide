import { describe, it, expect } from 'vitest';
import { parseHealthContext, stripHealthContext, HEALTH_CHECK_LABELS } from '@/lib/healthContext';

describe('healthContext', () => {
  describe('parseHealthContext', () => {
    it('returns inactive when from !== health', () => {
      expect(parseHealthContext('')).toEqual({ active: false, checkId: null, label: null });
      expect(parseHealthContext('?from=other')).toEqual({ active: false, checkId: null, label: null });
    });

    it('returns active with no check when from=health only', () => {
      const ctx = parseHealthContext('?from=health');
      expect(ctx.active).toBe(true);
      expect(ctx.checkId).toBeNull();
      expect(ctx.label).toBeNull();
    });

    it('returns active with check and label', () => {
      const ctx = parseHealthContext('?from=health&check=data_quality');
      expect(ctx.active).toBe(true);
      expect(ctx.checkId).toBe('data_quality');
      expect(ctx.label).toBe('Data Quality');
    });

    it('falls back to checkId as label for unknown checks', () => {
      const ctx = parseHealthContext('?from=health&check=unknown_thing');
      expect(ctx.label).toBe('unknown_thing');
    });

    it('preserves other params without issue', () => {
      const ctx = parseHealthContext('?tab=budget&from=health&check=snapshot_freshness');
      expect(ctx.active).toBe(true);
      expect(ctx.checkId).toBe('snapshot_freshness');
    });
  });

  describe('stripHealthContext', () => {
    it('removes from and check params', () => {
      expect(stripHealthContext('?from=health&check=data_quality')).toBe('');
    });

    it('preserves other params', () => {
      expect(stripHealthContext('?tab=budget&from=health&check=data_quality')).toBe('?tab=budget');
    });

    it('handles empty search', () => {
      expect(stripHealthContext('')).toBe('');
    });

    it('handles search with no health params', () => {
      expect(stripHealthContext('?tab=overview&page=1')).toBe('?tab=overview&page=1');
    });
  });

  describe('HEALTH_CHECK_LABELS', () => {
    it('has labels for all canonical check IDs', () => {
      const expectedKeys = ['access', 'snapshot_freshness', 'snapshot_coverage', 'data_quality', 'exec_intelligence', 'ui_reliability'];
      for (const key of expectedKeys) {
        expect(HEALTH_CHECK_LABELS[key]).toBeDefined();
        expect(HEALTH_CHECK_LABELS[key].length).toBeGreaterThan(0);
      }
    });
  });
});
