import { describe, expect, it } from 'vitest';
import { byCodeUnit, byInstant, byName } from './compare.js';

describe('explicit sort orders', () => {
  it('orders ids by code unit, the same on every machine', () => {
    const ids = ['b-2', 'B-1', 'a-3', '29000000-0000-4000-8000-000000000101'];
    expect([...ids].sort(byCodeUnit)).toEqual(['29000000-0000-4000-8000-000000000101', 'B-1', 'a-3', 'b-2']);
    expect(byCodeUnit('same', 'same')).toBe(0);
  });

  it('orders names alphabetically regardless of capitals', () => {
    expect(['Wariyapola', 'kuliyapitiya East', 'Bingiriya'].sort(byName)).toEqual([
      'Bingiriya',
      'kuliyapitiya East',
      'Wariyapola',
    ]);
  });

  it('orders timestamps by the moment they name, not their text', () => {
    // 01:00 UTC on 1 Nov is earlier than 23:00 at UTC-5 on 31 Oct (04:00 UTC on 1 Nov).
    const late = '2026-10-31T23:00:00-05:00';
    const early = '2026-11-01T01:00:00.000Z';
    expect([late, early].sort(byInstant)).toEqual([early, late]);
    expect([late, early].sort(byCodeUnit)).toEqual([late, early]);
  });
});
