import { describe, expect, it } from 'vitest';

import {
  type FiguresBySociety,
  missingAnnualFigures,
  profitAboveThreshold,
  type SocietyRef,
  summarizeMetric,
} from './assistant-calculations.js';

const society = (id: string, district = 'Kurunegala'): SocietyRef => ({
  id,
  code: `S-${id}`,
  name: `Fictional ${id} SSS`,
  district,
});

function figures(rows: [string, number, number | null, number | null][]): FiguresBySociety {
  const map: FiguresBySociety = new Map();
  for (const [id, year, profit, expenses] of rows) {
    if (!map.has(id)) map.set(id, new Map());
    map.get(id)!.set(year, { profit, expenses });
  }
  return map;
}

describe('summarizeMetric', () => {
  it('averages only recorded figures and counts the rest as excluded, not zero', () => {
    const result = summarizeMetric(
      [society('a'), society('b'), society('c')],
      figures([['a', 2025, 300_000, 900_000], ['b', 2025, -100_000, 400_000], ['c', 2025, null, 500_000]]),
      2025,
      'profit',
    );
    expect(result.average).toBe(100_000);
    expect(result.total).toBe(200_000);
    expect(result.included.map((row) => row.society.id)).toEqual(['a', 'b']);
    expect(result.excluded.map((row) => row.id)).toEqual(['c']);
  });

  it('returns no average when nothing is recorded', () => {
    const result = summarizeMetric([society('a')], figures([]), 2025, 'expenses');
    expect(result.average).toBeNull();
    expect(result.total).toBeNull();
    expect(result.excluded).toHaveLength(1);
  });
});

describe('profitAboveThreshold', () => {
  const years = [2023, 2024, 2025];
  const data = figures([
    ['steady', 2023, 150_000, 0], ['steady', 2024, 120_000, 0], ['steady', 2025, 110_000, 0],
    ['dip', 2023, 400_000, 0], ['dip', 2024, 50_000, 0], ['dip', 2025, 300_000, 0],
    ['gap', 2023, 500_000, 0], ['gap', 2025, 500_000, 0],
    ['low-gap', 2023, 10_000, 0],
  ]);
  const societies = ['steady', 'dip', 'gap', 'low-gap'].map((id) => society(id));

  it('each: needs every year above, and leaves out societies with a missing year', () => {
    const result = profitAboveThreshold(societies, data, years, 100_000, 'each');
    expect(result.matches.map((row) => row.society.id)).toEqual(['steady']);
    expect(result.checked).toBe(2);
    expect(result.excluded.map((row) => row.id)).toEqual(['gap', 'low-gap']);
  });

  it('any: one year above is enough, even with a missing year', () => {
    const result = profitAboveThreshold(societies, data, years, 100_000, 'any');
    expect(result.matches.map((row) => row.society.id).sort()).toEqual(['dip', 'gap', 'steady']);
    expect(result.excluded.map((row) => row.id)).toEqual(['low-gap']);
  });

  it('combined: adds the recorded years and needs all of them', () => {
    const result = profitAboveThreshold(societies, data, years, 500_000, 'combined');
    expect(result.matches.map((row) => [row.society.id, row.combined])).toEqual([['dip', 750_000]]);
    expect(result.checked).toBe(2);
  });
});

describe('missingAnnualFigures', () => {
  it('lists societies missing profit, expenses or both for the year', () => {
    const rows = missingAnnualFigures(
      [society('a'), society('b'), society('c'), society('d')],
      figures([['a', 2025, 1, 1], ['b', 2025, null, 1], ['c', 2025, 1, null]]),
      2025,
    );
    expect(rows.map((row) => [row.society.id, row.missing])).toEqual([['b', 'profit'], ['c', 'expenses'], ['d', 'both']]);
  });
});
