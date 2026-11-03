import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_DAYS,
  grantHistory,
  grantProblem,
  grantStatus,
  maxDaysFrom,
} from './district-access.rules.js';

const now = new Date('2026-10-27T02:30:00Z');
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe('temporary district access rules (V5 DM04, DM05, M30–M32)', () => {
  it('reads the longest grant from configuration, within 1–90 days', () => {
    expect(maxDaysFrom(undefined)).toBe(DEFAULT_MAX_DAYS);
    expect(maxDaysFrom('7')).toBe(7);
    expect(maxDaysFrom('0')).toBe(DEFAULT_MAX_DAYS);
    expect(maxDaysFrom('365')).toBe(DEFAULT_MAX_DAYS);
    expect(maxDaysFrom('two')).toBe(DEFAULT_MAX_DAYS);
  });

  it('names the status: scheduled, active, ended on its own or ended early', () => {
    const grant = { startsAt: hours(-1), expiresAt: hours(5), revokedAt: null };
    expect(grantStatus(grant, now)).toBe('ACTIVE');
    expect(grantStatus({ ...grant, startsAt: hours(2) }, now)).toBe(
      'SCHEDULED',
    );
    expect(grantStatus({ ...grant, expiresAt: hours(-0.5) }, now)).toBe(
      'ENDED',
    );
    expect(grantStatus({ ...grant, revokedAt: hours(-0.2) }, now)).toBe(
      'ENDED_EARLY',
    );
  });

  it('refuses past starts, reversed times, overlong grants and overlaps', () => {
    const ok = { startsAt: now, expiresAt: hours(24 * 4) };
    expect(grantProblem(ok, 0, 14, now)).toBeNull();
    expect(grantProblem({ ...ok, startsAt: hours(-2) }, 0, 14, now)).toBe(
      'The start time cannot be in the past.',
    );
    expect(grantProblem({ ...ok, expiresAt: hours(-0.1) }, 0, 14, now)).toBe(
      'The end time must be after the start time.',
    );
    expect(grantProblem({ ...ok, expiresAt: hours(24 * 15) }, 0, 14, now)).toBe(
      'Temporary access can last at most 14 days.',
    );
    expect(grantProblem(ok, 1, 14, now)).toMatch(
      /already has temporary access/,
    );
    expect(
      grantProblem(
        { startsAt: new Date('x'), expiresAt: hours(1) },
        0,
        14,
        now,
      ),
    ).toBe('Choose a start and an end time.');
  });

  it('builds the access history newest first, with who ended it early', () => {
    const history = grantHistory(
      {
        createdAt: hours(-30),
        startsAt: hours(-24),
        expiresAt: hours(48),
        revokedAt: hours(-1),
      },
      {
        grantedBy: 'R. Fernando',
        deputy: 'P. Dissanayake',
        endedBy: 'R. Fernando',
      },
      [{ at: hours(-3), societyName: 'Thalawa SSS' }],
      now,
    );
    expect(history.map((h) => [h.kind, h.actorName, h.societyName])).toEqual([
      ['ENDED_EARLY', 'R. Fernando', undefined],
      ['OPENED', 'P. Dissanayake', 'Thalawa SSS'],
      ['STARTED', null, undefined],
      ['GIVEN', 'R. Fernando', undefined],
    ]);
  });

  it('shows a scheduled grant as given only, and an expired one as ended', () => {
    const scheduled = grantHistory(
      {
        createdAt: hours(-1),
        startsAt: hours(3),
        expiresAt: hours(9),
        revokedAt: null,
      },
      { grantedBy: 'R. Fernando', deputy: 'P. D', endedBy: null },
      [],
      now,
    );
    expect(scheduled.map((h) => h.kind)).toEqual(['GIVEN']);
    const expired = grantHistory(
      {
        createdAt: hours(-50),
        startsAt: hours(-48),
        expiresAt: hours(-2),
        revokedAt: null,
      },
      { grantedBy: 'R. Fernando', deputy: 'P. D', endedBy: null },
      [],
      now,
    );
    expect(expired[0]).toMatchObject({ kind: 'ENDED', actorName: null });
  });
});
