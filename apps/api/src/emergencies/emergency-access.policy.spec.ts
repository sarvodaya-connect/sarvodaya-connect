import { describe, expect, it } from 'vitest';

import type { Principal } from '../auth/principal.js';
import {
  actingScope,
  canCoordinate,
  coversSociety,
  isEmptyScope,
  societyScopeFilter,
  viewingScope,
} from './emergency-access.policy.js';

const NOW = new Date('2026-10-26T06:00:00Z');
const own = { id: 'society-own', districtId: 'district-1' };
const neighbour = { id: 'society-neighbour', districtId: 'district-1' };
const far = { id: 'society-far', districtId: 'district-2' };

const person = (
  roles: Principal['roles'],
  extra: Partial<Principal> = {},
): Principal => ({
  id: `${roles[0]}-1`,
  displayName: 'Fictional user',
  roles,
  // Every account carries its district; only DMs act for all of it.
  districtIds: ['district-1'],
  societyIds: ['society-own'],
  ...extra,
});

const officer = person(['SOCIETY_OFFICER']);
const spc = person(['PROGRAMME_COORDINATOR']);
const ddm = person(['DEPUTY_DISTRICT_MANAGER']);
const dm = person(['DISTRICT_MANAGER'], { societyIds: [] });
const hq = person(['HQ_ADMIN'], { districtIds: [], societyIds: [] });
const ddmWithAccess = person(['DEPUTY_DISTRICT_MANAGER'], {
  delegatedDistrictAccess: [
    {
      districtId: 'district-1',
      startsAt: '2026-10-25T00:00:00Z',
      expiresAt: '2026-10-28T00:00:00Z',
    },
  ],
});

describe('V5 PR 8 disaster response scope', () => {
  it.each([
    ['Society Officer', officer],
    ['SPC', spc],
    ['DDM', ddm],
  ])(
    '%s acts for assigned societies only, not the rest of the district',
    (_, who) => {
      const scope = actingScope(who);
      expect(coversSociety(scope, own)).toBe(true);
      expect(coversSociety(scope, neighbour)).toBe(false);
      expect(coversSociety(scope, far)).toBe(false);
    },
  );

  it('DM acts for the whole district and nothing outside it', () => {
    const scope = actingScope(dm);
    expect(coversSociety(scope, own)).toBe(true);
    expect(coversSociety(scope, neighbour)).toBe(true);
    expect(coversSociety(scope, far)).toBe(false);
  });

  it('HQ acts nationally', () => {
    const scope = actingScope(hq);
    expect(coversSociety(scope, far)).toBe(true);
    expect(societyScopeFilter(scope)).toEqual({});
  });

  it('DDM temporary access adds a view-only district while it lasts', () => {
    expect(coversSociety(viewingScope(ddmWithAccess, NOW), neighbour)).toBe(
      true,
    );
    // View only: the district never becomes part of what they act for.
    expect(coversSociety(actingScope(ddmWithAccess), neighbour)).toBe(false);
    const after = new Date('2026-10-28T00:00:01Z');
    expect(coversSociety(viewingScope(ddmWithAccess, after), neighbour)).toBe(
      false,
    );
  });

  it('temporary access means nothing for other roles', () => {
    const spcWithGrant = {
      ...spc,
      delegatedDistrictAccess: ddmWithAccess.delegatedDistrictAccess,
    };
    expect(coversSociety(viewingScope(spcWithGrant, NOW), neighbour)).toBe(
      false,
    );
  });

  it('an account without a role in disaster response sees nothing', () => {
    const nobody = person([] as unknown as Principal['roles']);
    expect(isEmptyScope(actingScope(nobody))).toBe(true);
    expect(isEmptyScope(viewingScope(nobody, NOW))).toBe(true);
  });

  it('only HQ coordinates response actions', () => {
    expect(canCoordinate(hq)).toBe(true);
    for (const who of [officer, spc, ddm, dm])
      expect(canCoordinate(who)).toBe(false);
  });

  it('builds a society filter from the scope', () => {
    expect(societyScopeFilter(actingScope(dm))).toEqual({
      OR: [{ districtId: { in: ['district-1'] } }, { id: { in: [] } }],
    });
    expect(societyScopeFilter(actingScope(spc))).toEqual({
      OR: [{ districtId: { in: [] } }, { id: { in: ['society-own'] } }],
    });
  });
});
