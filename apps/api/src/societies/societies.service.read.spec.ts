import { findDemoPrincipal } from '../auth/demo-principals.js';
const hq = findDemoPrincipal('demo-hq-admin')!;
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';

import { SocietiesService } from './societies.service.js';
import { SocietiesRepository } from './societies.repository.js';

const SOCIETY_ID = '00000000-0000-4000-8000-000000000001';
const DISTRICT = { id: 'district-1', code: 'COL', nameEn: 'Colombo' };

function listRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'society-1',
    societyCode: 'SOC001',
    nameEn: 'Test Society',
    nameLocal: null,
    district: DISTRICT,
    status: 'ACTIVE',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function detailRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...listRecord({ id: SOCIETY_ID }),
    establishedOn: new Date('2010-05-20T00:00:00.000Z'),
    addressLine: '12 Test Road',
    village: 'Test Village',
    gnDivision: 'Test GN',
    dsDivision: 'Test DS',
    latitude: 6.9271,
    longitude: 79.8612,
    contacts: [
      {
        id: 'contact-1',
        label: 'Secretary',
        phone: '0110000000',
        email: 'secretary@example.test',
        isPrimary: true,
      },
    ],
    councilMembers: [],
    memberships: [],
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SocietiesService read behaviour', () => {
  let service: SocietiesService;

  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SocietiesService(
      repository as unknown as SocietiesRepository,
    );
  });

  describe('list', () => {
    it('passes search, district and status filters to the repository', async () => {
      repository.list.mockResolvedValue({ records: [], totalItems: 0 });
      const query = {
        page: 2,
        pageSize: 5,
        search: 'test',
        districtId: '00000000-0000-4000-8000-000000000002',
        status: 'ACTIVE' as const,
      };

      await service.list(query, hq);

      expect(repository.list).toHaveBeenCalledTimes(1);
      expect(repository.list).toHaveBeenCalledWith(query, hq);
    });

    it('rounds totalPages up', async () => {
      repository.list.mockResolvedValue({
        records: [listRecord()],
        totalItems: 25,
      });

      const result = await service.list({ page: 1, pageSize: 10 }, hq);

      expect(result.meta).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
      });
    });

    it('returns an empty page when nothing matches', async () => {
      repository.list.mockResolvedValue({ records: [], totalItems: 0 });

      const result = await service.list({ page: 1, pageSize: 10 }, hq);

      expect(result.data).toEqual([]);
      expect(result.meta.totalItems).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('includes nameLocal only when present', async () => {
      repository.list.mockResolvedValue({
        records: [
          listRecord({ id: 'a', nameLocal: 'Local Name' }),
          listRecord({ id: 'b', nameLocal: null }),
        ],
        totalItems: 2,
      });

      const result = await service.list({ page: 1, pageSize: 10 }, hq);

      expect(result.data[0]).toHaveProperty('nameLocal', 'Local Name');
      expect(result.data[1]).not.toHaveProperty('nameLocal');
    });

    it('maps a record to the summary shape', async () => {
      repository.list.mockResolvedValue({
        records: [listRecord()],
        totalItems: 1,
      });

      const result = await service.list({ page: 1, pageSize: 10 }, hq);

      expect(result.data[0]).toEqual({
        id: 'society-1',
        societyCode: 'SOC001',
        nameEn: 'Test Society',
        district: DISTRICT,
        status: 'ACTIVE',
        verificationStatus: 'UNVERIFIED',
        profileCompleteness: 0,
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('still queries the repository for the UNVERIFIED status', async () => {
      repository.list.mockResolvedValue({ records: [], totalItems: 0 });

      await service.list({
        page: 1,
        pageSize: 10,
        verificationStatus: 'UNVERIFIED',
      }, hq);

      expect(repository.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('getById', () => {
    it('does not reveal a society outside the signed-in officer scope', async () => {
      repository.findById.mockResolvedValue(detailRecord({ districtId: 'district-1' }));
      await expect(service.getById(SOCIETY_ID, findDemoPrincipal('demo-officer-sunrise')!))
        .rejects.toThrow(NotFoundException);
    });

    it('looks the society up by id and returns the full detail', async () => {
      repository.findById.mockResolvedValue(detailRecord());

      const result = await service.getById(SOCIETY_ID, hq);

      expect(repository.findById).toHaveBeenCalledWith(SOCIETY_ID);
      expect(result).toMatchObject({
        id: SOCIETY_ID,
        nameEn: 'Test Society',
        establishedOn: '2010-05-20',
        address: {
          addressLine: '12 Test Road',
          village: 'Test Village',
          gnDivision: 'Test GN',
          dsDivision: 'Test DS',
        },
        location: { latitude: 6.9271, longitude: 79.8612 },
        contacts: [
          {
            id: 'contact-1',
            label: 'Secretary',
            phone: '0110000000',
            email: 'secretary@example.test',
            isPrimary: true,
          },
        ],
        createdAt: '2025-12-01T00:00:00.000Z',
      });
      expect(result.committee).toEqual([]);
      expect(result.documents).toEqual([]);
      expect(result.history).toEqual([]);
    });

    it('omits optional fields that are not set', async () => {
      repository.findById.mockResolvedValue(
        detailRecord({
          establishedOn: null,
          addressLine: null,
          village: null,
          gnDivision: null,
          dsDivision: null,
          latitude: null,
          longitude: null,
          contacts: [],
        }),
      );

      const result = await service.getById(SOCIETY_ID, hq);

      expect(result).not.toHaveProperty('establishedOn');
      expect(result).not.toHaveProperty('location');
      expect(result.address).toEqual({});
      expect(result.contacts).toEqual([]);
    });

    it('throws NotFoundException with a clear message when missing', async () => {
      repository.findById.mockResolvedValue(null);

      const call = service.getById(SOCIETY_ID, hq);

      await expect(call).rejects.toBeInstanceOf(NotFoundException);
      await expect(call).rejects.toThrow('Society not found');
    });
  });
});
