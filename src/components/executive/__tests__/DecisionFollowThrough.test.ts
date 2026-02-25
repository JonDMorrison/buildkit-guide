import { describe, it, expect } from 'vitest';
import { deriveFollowThroughItems } from '@/components/executive/DecisionFollowThrough';

describe('deriveFollowThroughItems', () => {
  it('marks projects in attention set as still_attention', () => {
    const items = deriveFollowThroughItems(
      ['Tower A', 'Bridge B'],
      new Set(['Tower A', 'Highway C']),
    );
    expect(items[0]).toEqual({ projectName: 'Tower A', status: 'still_attention' });
    expect(items[1]).toEqual({ projectName: 'Bridge B', status: 'cleared' });
  });

  it('marks all as cleared when attention set is empty', () => {
    const items = deriveFollowThroughItems(['X', 'Y', 'Z'], new Set());
    expect(items.every(i => i.status === 'cleared')).toBe(true);
  });

  it('preserves noteTop3Projects order', () => {
    const order = ['Charlie', 'Alpha', 'Bravo'];
    const items = deriveFollowThroughItems(order, new Set(['Alpha']));
    expect(items.map(i => i.projectName)).toEqual(order);
    expect(items[1].status).toBe('still_attention');
  });

  it('returns empty array for empty input', () => {
    expect(deriveFollowThroughItems([], new Set(['A']))).toEqual([]);
  });
});
