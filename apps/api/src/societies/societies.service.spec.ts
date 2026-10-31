
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

import { SocietiesService } from './societies.service.js';
import { SocietiesRepository } from './societies.repository.js';
import type { Principal } from '../auth/principal.js';
const hq: Principal = { id: 'hq', displayName: 'HQ', roles: ['HQ_ADMIN'], districtIds: [], societyIds: [] };

describe('SocietiesService', () => {
  let service: SocietiesService;

  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    activeDelegatedDistrictIds: vi.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SocietiesService(
      repository as unknown as SocietiesRepository,
    );
  });

  it('returns paginated society results', async () => {
    repository.list.mockResolvedValue({
      records: [
        {
          id: 'society-1',
          societyCode: 'SOC001',
          nameEn: 'Test Society',
          nameLocal: null,
          district: {
            id: 'district-1',
            code: 'COL',
            nameEn: 'Colombo',
          },
          status: 'ACTIVE',
          grade: 'B',
          dsDivision: null,
          memberships: [],
          assignments: [],
          updatedAt: new Date('2026-01-01'),
        },
      ],
      totalItems: 1,
    });

    const result = await service.list({
      page: 1,
      pageSize: 10,
    }, hq);

    expect(result.data).toHaveLength(1);
    expect(result.meta.totalItems).toBe(1);
    expect(result.meta.totalPages).toBe(1);
    expect(result.data[0].verificationStatus).toBe('UNVERIFIED');
  });

  it('returns an empty result for unsupported verification status', async () => {
    const result = await service.list({
      page: 1,
      pageSize: 10,
      verificationStatus: 'VERIFIED',
    }, hq);

    expect(result.data).toEqual([]);
    expect(result.meta.totalItems).toBe(0);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('throws 404 when a society does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.getById('00000000-0000-4000-8000-000000000001', hq),
    ).rejects.toThrow(NotFoundException);
  });
});
