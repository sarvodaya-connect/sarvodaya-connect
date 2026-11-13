import { describe, expect, it } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { canManageEconomy, economyScopeFor } from './economy.policy.js';

const SOCIETY = { id: 'society-a' };
const HOUR = 3_600_000;
const NOW = new Date('2026-11-13T04:30:00.000Z');
const who = (
  roles: Principal['roles'],
  extra: Partial<Principal> = {},
): Principal => ({
  id: 'p',
  displayName: 'Fictional person',
  roles,
  districtIds: [],
  societyIds: [],
  ...extra,
});

describe('Village Economic Profile permissions (issue #145)', () => {
  it('lets only the assigned Society Officer manage it', () => {
    expect(
      canManageEconomy(
        who(['SOCIETY_OFFICER'], { societyIds: ['society-a'] }),
        SOCIETY,
      ),
    ).toBe(true);
    expect(
      canManageEconomy(
        who(['SOCIETY_OFFICER'], { societyIds: ['society-b'] }),
        SOCIETY,
      ),
    ).toBe(false);
    for (const role of [
      'HQ_ADMIN',
      'DISTRICT_MANAGER',
      'DEPUTY_DISTRICT_MANAGER',
      'PROGRAMME_COORDINATOR',
    ] as const)
      expect(
        canManageEconomy(
          who([role], { societyIds: ['society-a'], districtIds: ['d'] }),
          SOCIETY,
        ),
        role,
      ).toBe(false);
  });

  it('reports over HQ nationally, a DM’s district and assigned societies', () => {
    expect(economyScopeFor(who(['HQ_ADMIN']), NOW)).toEqual({ national: true });
    expect(
      economyScopeFor(who(['DISTRICT_MANAGER'], { districtIds: ['d1'] }), NOW),
    ).toEqual({
      national: false,
      districtIds: ['d1'],
      societyIds: [],
    });
    // An SPC's district gives nothing.
    expect(
      economyScopeFor(
        who(['PROGRAMME_COORDINATOR'], {
          districtIds: ['d1'],
          societyIds: ['s1', 's1'],
        }),
        NOW,
      ),
    ).toEqual({ national: false, districtIds: [], societyIds: ['s1'] });
  });

  it('gives a DDM a district only while the grant is valid', () => {
    const ddm = (startsIn: number, endsIn: number) =>
      who(['DEPUTY_DISTRICT_MANAGER'], {
        districtIds: ['d1'],
        societyIds: ['s1'],
        delegatedDistrictAccess: [
          {
            districtId: 'd1',
            startsAt: new Date(NOW.getTime() + startsIn * HOUR).toISOString(),
            expiresAt: new Date(NOW.getTime() + endsIn * HOUR).toISOString(),
          },
        ],
      });
    expect(economyScopeFor(ddm(-1, 1), NOW)).toEqual({
      national: false,
      districtIds: ['d1'],
      societyIds: ['s1'],
    });
    expect(economyScopeFor(ddm(1, 2), NOW)).toMatchObject({ districtIds: [] });
    expect(economyScopeFor(ddm(-2, -1), NOW)).toMatchObject({
      districtIds: [],
    });
  });
});
