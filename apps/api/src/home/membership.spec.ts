import { describe, expect, it } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { homeViewScope } from './home.service.js';
import {
  composeMembership,
  profileMembership,
  type MembershipSociety,
} from './membership.compose.js';

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const S1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const S2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const S3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const now = new Date('2026-11-09T06:00:00Z');

function principal(
  role: Principal['roles'][number],
  extra: Partial<Principal> = {},
): Principal {
  return {
    id: 'p',
    displayName: 'Fictional',
    roles: [role],
    districtIds: [D1],
    societyIds: [S1],
    ...extra,
  };
}

const grant = (startsAt: string, expiresAt: string) => ({
  districtId: D1,
  startsAt,
  expiresAt,
});

describe('who a Membership view may count (issue #118)', () => {
  it('gives the DM their own district only', () => {
    expect(
      homeViewScope(
        'DISTRICT_MANAGER',
        principal('DISTRICT_MANAGER'),
        undefined,
        now,
      ),
    ).toEqual({
      scope: 'DISTRICT_MANAGER',
      where: { districtId: { in: [D1] } },
    });
  });

  it('gives the SPC only assigned societies, even with a district on the account', () => {
    expect(
      homeViewScope(
        'PROGRAMME_COORDINATOR',
        principal('PROGRAMME_COORDINATOR'),
        undefined,
        now,
      ),
    ).toEqual({
      scope: 'MINE',
      where: { id: { in: [S1] } },
    });
    expect(
      homeViewScope(
        'PROGRAMME_COORDINATOR',
        principal('PROGRAMME_COORDINATOR'),
        'DISTRICT',
        now,
      ),
    ).toHaveProperty('refused');
  });

  it('gives a DDM their assigned societies unless they ask for the district', () => {
    const ddm = principal('DEPUTY_DISTRICT_MANAGER', {
      delegatedDistrictAccess: [
        grant('2026-11-08T00:00:00Z', '2026-11-12T00:00:00Z'),
      ],
    });
    expect(
      homeViewScope('DEPUTY_DISTRICT_MANAGER', ddm, undefined, now),
    ).toEqual({ scope: 'MINE', where: { id: { in: [S1] } } });
  });

  it.each([
    [
      'before it starts',
      grant('2026-11-10T00:00:00Z', '2026-11-12T00:00:00Z'),
      false,
    ],
    [
      'while it is valid',
      grant('2026-11-08T00:00:00Z', '2026-11-12T00:00:00Z'),
      true,
    ],
    [
      'after it expires',
      grant('2026-11-01T00:00:00Z', '2026-11-09T05:59:59Z'),
      false,
    ],
  ])(
    'gives a DDM the district %s only while the grant is valid',
    (_label, g, allowed) => {
      const ddm = principal('DEPUTY_DISTRICT_MANAGER', {
        delegatedDistrictAccess: [g],
      });
      const result = homeViewScope(
        'DEPUTY_DISTRICT_MANAGER',
        ddm,
        'DISTRICT',
        now,
      );
      if (allowed)
        expect(result).toEqual({
          scope: 'DISTRICT',
          where: { districtId: { in: [D1] } },
        });
      else
        expect(result).toEqual({
          refused: 'Your temporary district-wide view has ended',
        });
    },
  );

  it('refuses the district after revocation, when the grant is no longer on the principal', () => {
    const ddm = principal('DEPUTY_DISTRICT_MANAGER', {
      delegatedDistrictAccess: [],
    });
    expect(
      homeViewScope('DEPUTY_DISTRICT_MANAGER', ddm, 'DISTRICT', now),
    ).toHaveProperty('refused');
  });
});

const society = (
  id: string,
  district: string,
  status = 'ACTIVE',
  memberCount: number | null = null,
  split: { female: number; male: number } | null = null,
): MembershipSociety => ({
  id,
  status,
  memberCount: split ? split.female + split.male : memberCount,
  femaleMembers: split?.female ?? null,
  maleMembers: split?.male ?? null,
  district: {
    id: district,
    nameEn: district === D1 ? 'Fictional North' : 'Fictional South',
  },
});

describe('scoped Membership figures (issue #118)', () => {
  it('counts only active societies in scope, with HQ definitions', () => {
    const result = composeMembership({
      scope: 'DISTRICT_MANAGER',
      societies: [
        society(S1, D1),
        society(S2, D1),
        society(S3, D1, 'INACTIVE'),
      ],
      year: 2026,
      counts: [
        { societyId: S1, category: 'YOUTH', female: 30, male: 20 },
        { societyId: S1, category: 'MOTHERS', female: 12, male: 0 },
        { societyId: S3, category: 'YOUTH', female: 99, male: 99 },
      ],
      districtView: null,
    });
    expect(result).toMatchObject({
      activeSocieties: 2,
      societiesReported: 1,
      female: 42,
      male: 20,
      total: 62,
    });
    expect(result.categories.find((row) => row.category === 'YOUTH')).toEqual({
      category: 'YOUTH',
      female: 30,
      male: 20,
      total: 50,
    });
    expect(result.categories).toHaveLength(5);
  });

  it('lists only districts that hold societies in scope', () => {
    const result = composeMembership({
      scope: 'MINE',
      societies: [society(S1, D2)],
      year: null,
      counts: [],
      districtView: null,
    });
    expect(result.districts.map((row) => row.id)).toEqual([D2]);
    expect(result.districts[0]).toMatchObject({ active: 1, total: 0 });
  });

  it('keeps profile member counts apart from the category breakdown', () => {
    const result = composeMembership({
      scope: 'DISTRICT_MANAGER',
      societies: [
        society(S1, D1, 'ACTIVE', 1200),
        society(S2, D1, 'ACTIVE', 840),
        society(S3, D1, 'INACTIVE', 500),
      ],
      year: null,
      counts: [],
      districtView: null,
    });
    expect(result).toMatchObject({
      total: 0,
      female: 0,
      male: 0,
      societiesReported: 0,
    });
    expect(result.profile).toEqual({
      societies: 2,
      members: 2040,
      withoutBreakdown: 2,
      withSplit: 0,
      female: 0,
      male: 0,
    });
  });

  it('treats a society with all-zero counts as not reported, like HQ', () => {
    const result = composeMembership({
      scope: 'MINE',
      societies: [society(S1, D1, 'ACTIVE', 10)],
      year: 2026,
      counts: [{ societyId: S1, category: 'YOUTH', female: 0, male: 0 }],
      districtView: null,
    });
    expect(result).toMatchObject({
      year: 2026,
      societiesReported: 0,
      total: 0,
    });
    expect(result.profile.withoutBreakdown).toBe(1);
  });
});

describe('profile female and male members (issue #141)', () => {
  const S4 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  const none = new Set<string>();

  it('counts a society with female 25 and male 17 once, alongside the others', () => {
    const result = composeMembership({
      scope: 'DISTRICT_MANAGER',
      societies: [
        society(S1, D1, 'ACTIVE', null, { female: 25, male: 17 }),
        society(S2, D1, 'ACTIVE', null, { female: 10, male: 5 }),
      ],
      year: null,
      counts: [],
      districtView: null,
    });
    expect(result.profile).toEqual({
      societies: 2,
      members: 57,
      withoutBreakdown: 2,
      withSplit: 2,
      female: 35,
      male: 22,
    });
    // The category figures stay what was entered by category: nothing.
    expect(result).toMatchObject({ female: 0, male: 0, total: 0 });
  });

  it('uses the latest saved values, so a change replaces the old figures', () => {
    const before = profileMembership(
      [society(S1, D1, 'ACTIVE', null, { female: 25, male: 17 })],
      none,
    );
    const raised = profileMembership(
      [society(S1, D1, 'ACTIVE', null, { female: 30, male: 17 })],
      none,
    );
    const lowered = profileMembership(
      [society(S1, D1, 'ACTIVE', null, { female: 20, male: 17 })],
      none,
    );
    expect(before).toMatchObject({ female: 25, male: 17, members: 42 });
    expect(raised).toMatchObject({ female: 30, male: 17, members: 47 });
    expect(raised.members - before.members).toBe(5);
    expect(lowered).toMatchObject({ female: 20, members: 37 });
  });

  it('keeps a total-only society in the total without guessing a split', () => {
    const result = profileMembership(
      [
        society(S1, D1, 'ACTIVE', null, { female: 25, male: 17 }),
        society(S2, D1, 'ACTIVE', 400),
      ],
      none,
    );
    expect(result).toEqual({
      societies: 2,
      members: 442,
      withoutBreakdown: 2,
      withSplit: 1,
      female: 25,
      male: 17,
    });
  });

  it('treats an entered zero as entered, and leaves out inactive societies', () => {
    const result = composeMembership({
      scope: 'MINE',
      societies: [
        society(S1, D1, 'ACTIVE', null, { female: 0, male: 0 }),
        society(S2, D1, 'ACTIVE'),
        society(S3, D1, 'INACTIVE', null, { female: 50, male: 50 }),
        society(S4, D1, 'ACTIVE', null, { female: 3, male: 4 }),
      ],
      year: 2026,
      counts: [{ societyId: S4, category: 'YOUTH', female: 3, male: 4 }],
      districtView: null,
    });
    expect(result.profile).toEqual({
      societies: 2,
      members: 7,
      withoutBreakdown: 1,
      withSplit: 2,
      female: 3,
      male: 4,
    });
    // Category figures are their own: the profile split is not added to them.
    expect(result).toMatchObject({ female: 3, male: 4, total: 7 });
  });
});
