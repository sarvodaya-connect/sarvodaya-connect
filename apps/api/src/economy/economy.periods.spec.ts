import { describe, expect, it } from 'vitest';

import { checkPeriod, periodShape, periodsOverlap } from './economy.periods.js';

// 13 November 2026, 10:00 in Sri Lanka.
const NOW = new Date('2026-11-13T04:30:00.000Z');
const ok = (result: ReturnType<typeof checkPeriod>) => {
  if ('error' in result) throw new Error(result.error);
  return result.period;
};
const error = (result: ReturnType<typeof checkPeriod>) =>
  'error' in result ? result.error : null;

describe('production periods (issue #145)', () => {
  it('takes a calendar month for MONTHLY, including February in a leap year', () => {
    const october = ok(
      checkPeriod(
        { basis: 'MONTHLY', startsOn: '2026-10-01', endsOn: '2026-10-31' },
        'ACTUAL',
        NOW,
      ),
    );
    expect(october.seasonLabel).toBeNull();
    expect(
      'period' in
        periodShape({
          basis: 'MONTHLY',
          startsOn: '2028-02-01',
          endsOn: '2028-02-29',
        }),
    ).toBe(true);
    expect(
      error(
        checkPeriod(
          { basis: 'MONTHLY', startsOn: '2026-10-01', endsOn: '2026-10-30' },
          'ACTUAL',
          NOW,
        ),
      ),
    ).toMatch(/first to the last day/);
    expect(
      error(
        checkPeriod(
          { basis: 'MONTHLY', startsOn: '2026-09-15', endsOn: '2026-10-14' },
          'ACTUAL',
          NOW,
        ),
      ),
    ).toMatch(/first to the last day/);
  });

  it('takes Monday to Sunday for WEEKLY', () => {
    // 2 November 2026 is a Monday.
    ok(
      checkPeriod(
        { basis: 'WEEKLY', startsOn: '2026-11-02', endsOn: '2026-11-08' },
        'ACTUAL',
        NOW,
      ),
    );
    expect(
      error(
        checkPeriod(
          { basis: 'WEEKLY', startsOn: '2026-11-03', endsOn: '2026-11-09' },
          'ACTUAL',
          NOW,
        ),
      ),
    ).toMatch(/Monday/);
  });

  it('needs a name for a season and at most 366 days', () => {
    expect(
      ok(
        checkPeriod(
          {
            basis: 'SEASONAL',
            startsOn: '2025-10-15',
            endsOn: '2026-03-10',
            seasonLabel: '  Maha 2025/26 ',
          },
          'ACTUAL',
          NOW,
        ),
      ).seasonLabel,
    ).toBe('Maha 2025/26');
    expect(
      error(
        checkPeriod(
          { basis: 'SEASONAL', startsOn: '2025-10-15', endsOn: '2026-03-10' },
          'ACTUAL',
          NOW,
        ),
      ),
    ).toMatch(/Name the season/);
    expect(
      error(
        checkPeriod(
          {
            basis: 'SEASONAL',
            startsOn: '2024-01-01',
            endsOn: '2025-01-02',
            seasonLabel: 'Too long',
          },
          'ACTUAL',
          NOW,
        ),
      ),
    ).toMatch(/366 days/);
    expect(
      'period' in
        periodShape(
          { basis: 'SEASONAL', startsOn: '2025-10-15', endsOn: '2026-03-10' },
          { labelRequired: false },
        ),
    ).toBe(true);
  });

  it('keeps season names to seasons', () => {
    expect(
      error(
        checkPeriod(
          {
            basis: 'MONTHLY',
            startsOn: '2026-10-01',
            endsOn: '2026-10-31',
            seasonLabel: 'Yala',
          },
          'ACTUAL',
          NOW,
        ),
      ),
    ).toMatch(/Only a seasonal period/);
  });

  it('refuses impossible dates and periods that end first', () => {
    for (const [startsOn, endsOn] of [
      ['2026-02-30', '2026-03-01'],
      ['2026-10-1', '2026-10-31'],
      ['2026-10-31', '2026-10-01'],
      ['1999-12-01', '1999-12-31'],
    ])
      expect(
        error(
          checkPeriod(
            { basis: 'SEASONAL', startsOn, endsOn, seasonLabel: 'x' },
            'ESTIMATED',
            NOW,
          ),
        ),
      ).not.toBeNull();
  });

  it('keeps actual figures to days that have passed in Sri Lanka', () => {
    expect(
      error(
        checkPeriod(
          { basis: 'MONTHLY', startsOn: '2026-11-01', endsOn: '2026-11-30' },
          'ACTUAL',
          NOW,
        ),
      ),
    ).toMatch(/estimate instead/);
    ok(
      checkPeriod(
        { basis: 'MONTHLY', startsOn: '2026-11-01', endsOn: '2026-11-30' },
        'ESTIMATED',
        NOW,
      ),
    );
    expect(
      error(
        checkPeriod(
          { basis: 'MONTHLY', startsOn: '2028-01-01', endsOn: '2028-01-31' },
          'ESTIMATED',
          NOW,
        ),
      ),
    ).toMatch(/a year ahead/);
    // 2 November 2026 23:00 UTC is already 3 November in Sri Lanka.
    ok(
      checkPeriod(
        { basis: 'WEEKLY', startsOn: '2026-10-26', endsOn: '2026-11-01' },
        'ACTUAL',
        new Date('2026-11-01T19:00:00.000Z'),
      ),
    );
  });

  it('finds overlaps, including a single shared day', () => {
    const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
    expect(
      periodsOverlap(
        { start: d('2026-10-01'), end: d('2026-10-31') },
        { start: d('2026-10-26'), end: d('2026-11-01') },
      ),
    ).toBe(true);
    expect(
      periodsOverlap(
        { start: d('2026-10-01'), end: d('2026-10-31') },
        { start: d('2026-10-31'), end: d('2026-10-31') },
      ),
    ).toBe(true);
    expect(
      periodsOverlap(
        { start: d('2026-10-01'), end: d('2026-10-31') },
        { start: d('2026-11-01'), end: d('2026-11-30') },
      ),
    ).toBe(false);
  });
});
