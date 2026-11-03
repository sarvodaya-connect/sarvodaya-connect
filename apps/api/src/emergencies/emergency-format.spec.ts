import { describe, expect, it } from 'vitest';

import {
  actionState,
  defaultIncidentTitle,
  distanceKm,
  incidentReference,
  startedAtProblem,
} from './emergency-format.js';

describe('incident helpers', () => {
  it('formats the reference from the Sri Lanka year and number', () => {
    expect(incidentReference(9, new Date('2026-10-25T00:40:00Z'))).toBe(
      'INC-2026-09',
    );
    // 31 Dec 20:00 UTC is already 1 Jan in Sri Lanka.
    expect(incidentReference(112, new Date('2026-12-31T20:00:00Z'))).toBe(
      'INC-2027-112',
    );
  });

  it('names an incident from its type and area when none is given', () => {
    expect(defaultIncidentTitle('FLOOD', ['Kurunegala', 'Puttalam'])).toBe(
      'Floods — Kurunegala, Puttalam',
    );
  });

  it('works out a response action state from its helpers (badges, never bars)', () => {
    expect(actionState([])).toBe('NEEDED');
    expect(actionState([{ status: 'ASSIGNED', deliveredQuantity: 0 }])).toBe(
      'ASSIGNED',
    );
    expect(actionState([{ status: 'ASSIGNED', deliveredQuantity: 12 }])).toBe(
      'IN_PROGRESS',
    );
    expect(
      actionState([
        { status: 'DELIVERED', deliveredQuantity: 200 },
        { status: 'ASSIGNED', deliveredQuantity: 0 },
      ]),
    ).toBe('IN_PROGRESS');
    expect(
      actionState([
        { status: 'DELIVERED', deliveredQuantity: 200 },
        { status: 'DELIVERED', deliveredQuantity: 100 },
      ]),
    ).toBe('DELIVERED');
  });

  it('gives a distance only when both societies have a location', () => {
    const kurunegala = { latitude: 7.4863, longitude: 80.3623 };
    const puttalam = { latitude: 8.0362, longitude: 79.8283 };
    expect(distanceKm(kurunegala, puttalam)).toBe(85);
    expect(
      distanceKm(kurunegala, { latitude: null, longitude: null }),
    ).toBeNull();
  });

  it('accepts a start time from the last 30 days, not the future', () => {
    const now = new Date('2026-10-26T06:00:00Z');
    expect(startedAtProblem(new Date('2026-10-25T00:40:00Z'), now)).toBeNull();
    expect(startedAtProblem(new Date('2026-10-26T08:00:00Z'), now)).toMatch(
      /future/,
    );
    expect(startedAtProblem(new Date('2026-09-01T00:00:00Z'), now)).toMatch(
      /30 days/,
    );
  });
});
