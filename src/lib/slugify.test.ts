import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/utils';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Acme Construction')).toBe('acme-construction');
  });

  it('removes special characters', () => {
    expect(slugify("O'Brien & Sons (Ltd.)")).toBe('o-brien-sons-ltd');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('test---name')).toBe('test-name');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  --test--  ')).toBe('test');
  });

  it('truncates to 30 characters', () => {
    const long = 'a'.repeat(50);
    expect(slugify(long).length).toBeLessThanOrEqual(30);
  });

  it('returns "org" for empty/whitespace-only input', () => {
    expect(slugify('')).toBe('org');
    expect(slugify('   ')).toBe('org');
    expect(slugify('---')).toBe('org');
  });

  it('handles unicode characters', () => {
    expect(slugify('Café Résumé')).toBe('caf-r-sum');
  });

  it('is deterministic (same input → same output)', () => {
    const input = 'Test Company 123';
    expect(slugify(input)).toBe(slugify(input));
  });
});
