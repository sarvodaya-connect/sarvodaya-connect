import { describe, expect, it } from 'vitest';

import {
  financialYear,
  isSelectableFinancialYear,
  latestCompletedFinancialYear,
  selectableFinancialYears,
} from './financial-year.js';

describe('society financial years (1 April – 31 March)', () => {
  it('labels a year by the calendar year it starts in', () => {
    expect(financialYear(2025)).toEqual({
      startYear: 2025,
      label: 'FY 2025/26',
      startsOn: '2025-04-01',
      endsOn: '2026-03-31',
    });
    expect(financialYear(2099).label).toBe('FY 2099/00');
  });

  it('uses the most recently completed year, in Sri Lanka time', () => {
    expect(latestCompletedFinancialYear(new Date('2026-10-30T06:00:00Z'))).toBe(
      2025,
    );
    expect(latestCompletedFinancialYear(new Date('2026-02-15T06:00:00Z'))).toBe(
      2024,
    );
    // 31 March 19:00 UTC is already 1 April in Colombo.
    expect(latestCompletedFinancialYear(new Date('2026-03-31T19:00:00Z'))).toBe(
      2025,
    );
    expect(latestCompletedFinancialYear(new Date('2026-03-31T18:00:00Z'))).toBe(
      2024,
    );
  });

  it('offers the last five completed years, newest first', () => {
    const now = new Date('2026-10-30T06:00:00Z');
    expect(selectableFinancialYears(now).map((year) => year.startYear)).toEqual(
      [2025, 2024, 2023, 2022, 2021],
    );
    expect(isSelectableFinancialYear(2025, now)).toBe(true);
    expect(isSelectableFinancialYear(2026, now)).toBe(false);
    expect(isSelectableFinancialYear(2020, now)).toBe(false);
  });
});
