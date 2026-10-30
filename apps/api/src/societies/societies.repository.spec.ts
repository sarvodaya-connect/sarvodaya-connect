import { findDemoPrincipal } from '../auth/demo-principals.js';
const hq = findDemoPrincipal('demo-hq-admin')!;
import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';
import { SocietiesRepository } from './societies.repository.js';

describe('SocietiesRepository', () => {
  const findMany = vi.fn();
  const count = vi.fn();
  const findUnique = vi.fn();
  const transaction = vi.fn();

  const prisma = {
    society: { findMany, count, findUnique },
    $transaction: transaction,
  } as unknown as PrismaService;

  let repository: SocietiesRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SocietiesRepository(prisma);
  });

  it('queries PostgreSQL with filters and pagination', async () => {
    findMany.mockReturnValue('find-many-query');
    count.mockReturnValue('count-query');
    transaction.mockResolvedValue([[], 0]);

    await repository.list({
      page: 2,
      pageSize: 5,
      search: '  sunrise  ',
      districtId: '29000000-0000-4000-8000-000000000001',
      status: 'ACTIVE',
    }, hq);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          districtId: '29000000-0000-4000-8000-000000000001',
          status: 'ACTIVE',
          OR: expect.arrayContaining([
            { nameEn: { contains: 'sunrise', mode: 'insensitive' } },
          ]),
        }),
        skip: 5,
        take: 5,
      }),
    );
    expect(transaction).toHaveBeenCalledWith([
      'find-many-query',
      'count-query',
    ]);
  });

  it('looks up society profile, council and membership records', async () => {
    findUnique.mockResolvedValue(null);

    await repository.findById('29000000-0000-4000-8000-000000000101');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: '29000000-0000-4000-8000-000000000101' },
      include: {
        district: true,
        contacts: true,
        councilMembers: { orderBy: { seatNumber: 'asc' } },
        memberships: { orderBy: [{ year: 'desc' }, { category: 'asc' }] },
        // SC-65: the request waiting for HQ, if any.
        gradeRequests: {
          where: { status: 'PENDING' },
          orderBy: { requestedAt: 'desc' },
          take: 1,
        },
      },
    });
  });

  it('applies principal scope in membership aggregate queries', async () => {
    findMany.mockResolvedValue([]);

    await repository.membershipForPrincipal(
      {
        id: 'demo-dm-north',
        displayName: 'Demo District Manager',
        roles: ['DISTRICT_MANAGER'],
        districtIds: ['29000000-0000-4000-8000-000000000001'],
        societyIds: [],
      },
      2026,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          districtId: { in: ['29000000-0000-4000-8000-000000000001'] },
          memberships: { some: { year: 2026 } },
        }),
      }),
    );
  });

  it('does not expose database details when a query fails', async () => {
    findUnique.mockRejectedValue(
      new Error('password authentication failed for private-user'),
    );

    const call = repository.findById('29000000-0000-4000-8000-000000000101');

    await expect(call).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(call).rejects.toThrow('Database temporarily unavailable');
    await expect(call).rejects.not.toThrow('private-user');
  });
});
