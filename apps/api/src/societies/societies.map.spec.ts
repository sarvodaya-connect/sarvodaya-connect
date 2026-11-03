import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  MAP_POINT_LIMIT,
  SocietiesRepository,
} from './societies.repository.js';
import { SocietiesService } from './societies.service.js';

const base = { id: 'user', displayName: 'User', districtIds: [], societyIds: [] };
const hq: Principal = { ...base, roles: ['HQ_ADMIN'] };
const dm: Principal = {
  ...base,
  roles: ['DISTRICT_MANAGER'],
  districtIds: ['district-a'],
};
const spc: Principal = {
  ...base,
  roles: ['PROGRAMME_COORDINATOR'],
  societyIds: ['society-a'],
};
const ddm: Principal = {
  ...base,
  roles: ['DEPUTY_DISTRICT_MANAGER'],
  societyIds: ['society-a'],
  delegatedDistrictAccess: [
    { districtId: 'district-b', expiresAt: '2099-01-01T00:00:00.000Z' },
  ],
};
const located = { latitude: { not: null }, longitude: { not: null } };

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    nameEn: `Society ${id}`,
    societyCode: `S-${id}`,
    grade: 'B',
    status: 'ACTIVE',
    latitude: 7.2,
    longitude: 80.6,
    district: { nameEn: 'Kandy' },
    ...overrides,
  };
}

describe('Society map pins', () => {
  const findMany = vi.fn();
  const count = vi.fn();
  const prisma = { society: { findMany, count } } as unknown as PrismaService;
  let service: SocietiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    service = new SocietiesService(new SocietiesRepository(prisma));
  });

  it.each([
    ['HQ, the whole network', hq, {}],
    ['a DM, their district', dm, { districtId: { in: ['district-a'] } }],
    ['an SPC, their societies', spc, { id: { in: ['society-a'] } }],
    [
      'a DDM, their societies and a current temporary district',
      ddm,
      {
        OR: [
          { districtId: { in: ['district-b'] } },
          { id: { in: ['society-a'] } },
        ],
      },
    ],
  ])('limits the select and the count to %s', async (_label, principal, scope) => {
    await service.map(principal);
    expect(findMany).toHaveBeenCalledWith({
      where: { AND: [scope, located] },
      select: {
        id: true,
        nameEn: true,
        societyCode: true,
        grade: true,
        status: true,
        latitude: true,
        longitude: true,
        district: { select: { nameEn: true } },
      },
      orderBy: { id: 'asc' },
      take: MAP_POINT_LIMIT + 1,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        AND: [
          scope,
          { status: 'ACTIVE' },
          { OR: [{ latitude: null }, { longitude: null }] },
        ],
      },
    });
  });

  it('returns nothing to a role with no districts or societies', async () => {
    await service.map({ ...base, roles: ['DISTRICT_MANAGER'] });
    expect(findMany.mock.calls[0]![0].where).toEqual({
      AND: [{ id: { in: [] } }, located],
    });
  });

  it('returns only the pin fields and counts societies without a position', async () => {
    findMany.mockResolvedValue([row('a', { grade: null, status: 'INACTIVE' })]);
    count.mockResolvedValue(4);
    await expect(service.map(spc)).resolves.toEqual({
      points: [
        {
          id: 'a',
          name: 'Society a',
          societyCode: 'S-a',
          grade: null,
          status: 'INACTIVE',
          latitude: 7.2,
          longitude: 80.6,
          district: 'Kandy',
        },
      ],
      withoutLocation: 4,
      truncated: false,
    });
  });

  it('stops at the limit and says the map is incomplete', async () => {
    findMany.mockResolvedValue(
      Array.from({ length: MAP_POINT_LIMIT + 1 }, (_, i) => row(String(i))),
    );
    const map = await service.map(hq);
    expect(map.points).toHaveLength(MAP_POINT_LIMIT);
    expect(map.truncated).toBe(true);
  });
});
