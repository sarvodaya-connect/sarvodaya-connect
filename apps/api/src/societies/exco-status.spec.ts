import { describe, expect, it } from 'vitest';

import { excoStatus } from './societies.service.js';

type Row = Parameters<typeof excoStatus>[0][number];

/** 25 seats: 3 children, 3 youth, 3 mothers, 9 ordinary, 7 elders; seats 10–12 hold the offices. */
function fullExco(): Row[] {
  const groups = [
    ...Array(3).fill('CHILDREN'),
    ...Array(3).fill('YOUTH'),
    ...Array(3).fill('MOTHERS'),
    ...Array(9).fill('ORDINARY'),
    ...Array(7).fill('ELDERS_COUNCIL'),
  ] as Row['seatType'][];
  return groups.map((seatType, index) => ({
    seatNumber: index + 1,
    isActive: true,
    seatType,
    position:
      { 10: 'President', 11: 'Secretary', 12: 'Treasurer' }[index + 1] ??
      'Member',
  }));
}

describe('excoStatus: when an Exco is complete', () => {
  it('a new society with no Exco is incomplete and says so', () => {
    expect(excoStatus([])).toEqual({
      filledSeats: 0,
      totalSeats: 25,
      complete: false,
      missingOffices: ['President', 'Secretary', 'Treasurer'],
      problems: ['No Exco members have been entered yet.'],
    });
  });

  it('a partly entered Exco says how many seats are left and which offices are open', () => {
    const status = excoStatus(fullExco().slice(9, 12));
    expect(status).toMatchObject({ filledSeats: 3, complete: false });
    expect(status.problems).toEqual(['22 of 25 seats are still to fill.']);

    const one = excoStatus([fullExco()[0]!]);
    expect(one.problems).toEqual([
      '24 of 25 seats are still to fill.',
      'No President, Secretary or Treasurer chosen yet.',
    ]);
  });

  it('25 valid seats missing an office bearer stay incomplete', () => {
    const noSecretary = fullExco().map((row) =>
      row.position === 'Secretary' ? { ...row, position: 'Member' } : row,
    );
    expect(excoStatus(noSecretary)).toEqual({
      filledSeats: 25,
      totalSeats: 25,
      complete: false,
      missingOffices: ['Secretary'],
      problems: ['No Secretary chosen yet.'],
    });
  });

  it('a full Exco with the groups and all three office bearers is complete', () => {
    expect(excoStatus(fullExco())).toMatchObject({
      filledSeats: 25,
      complete: true,
      missingOffices: [],
      problems: [],
    });
    // Office names are matched without regard to case or spaces.
    const spaced = fullExco().map((row) =>
      row.position === 'President' ? { ...row, position: ' president ' } : row,
    );
    expect(excoStatus(spaced).complete).toBe(true);
  });

  it('older records with the wrong groups, two office holders or shared seats are incomplete', () => {
    const wrongGroups = fullExco().map((row) =>
      row.seatNumber === 25 ? { ...row, seatType: 'ORDINARY' as const } : row,
    );
    expect(excoStatus(wrongGroups)).toMatchObject({ complete: false });
    expect(excoStatus(wrongGroups).problems).toEqual([
      '10 ordinary seats are recorded; the Exco has 9.',
      "6 elders' council seats are recorded; the Exco has 7.",
    ]);

    const twoTreasurers = fullExco().map((row) =>
      row.seatNumber === 13 ? { ...row, position: 'Treasurer' } : row,
    );
    expect(excoStatus(twoTreasurers).problems).toEqual([
      '2 members are recorded as Treasurer; choose one.',
    ]);
    expect(excoStatus(twoTreasurers).complete).toBe(false);

    const shared = [...fullExco().slice(0, 24), { ...fullExco()[0]! }];
    expect(excoStatus(shared)).toMatchObject({
      filledSeats: 24,
      complete: false,
    });
  });

  it('ignores members who are no longer active', () => {
    const ended = fullExco().map((row) =>
      row.seatNumber === 5 ? { ...row, isActive: false } : row,
    );
    expect(excoStatus(ended)).toMatchObject({
      filledSeats: 24,
      complete: false,
    });
  });
});
