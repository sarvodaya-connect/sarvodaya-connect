import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '../auth/principal.js';
import { SocietiesService } from './societies.service.js';
import { SocietiesRepository } from './societies.repository.js';

const societyId = '29000000-0000-4000-8000-000000000101';
const districtId = '29000000-0000-4000-8000-000000000001';
const baseRecord = {
  id: societyId,
  societyCode: 'DEMO-SOC-001',
  nameEn: 'Example Sunrise Society',
  districtId,
  district: {
    id: districtId,
    code: 'DEMO-N',
    nameEn: 'Fictional North District',
  },
  contacts: [],
  councilMembers: [],
  memberships: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const officer: Principal = {
  id: 'demo-officer-sunrise',
  displayName: 'Demo Officer',
  roles: ['SOCIETY_OFFICER'],
  districtIds: [districtId],
  societyIds: [societyId],
};
const otherOfficer: Principal = {
  ...officer,
  id: 'demo-officer-other',
  societyIds: ['29000000-0000-4000-8000-000000000103'],
};

describe('SocietiesService profile, council and membership', () => {
  const repository = {
    findById: vi.fn(),
    updateProfile: vi.fn(),
    replaceCouncil: vi.fn(),
    replaceMembership: vi.fn(),
    membershipForPrincipal: vi.fn(),
  };
  let service: SocietiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(baseRecord);
    service = new SocietiesService(
      repository as unknown as SocietiesRepository,
    );
  });

  it('allows an assigned society officer to update a complete coordinate pair', async () => {
    repository.updateProfile.mockResolvedValue({ id: societyId });
    await service.updateProfile(
      societyId,
      { latitude: 7.3, longitude: 80.6 },
      officer,
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(societyId, {
      latitude: 7.3,
      longitude: 80.6,
    }, officer);
  });

  it('rejects a partial GPS location without changing stored values', async () => {
    await expect(
      service.updateProfile(societyId, { latitude: 7.3 }, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects updates outside the assigned society scope', async () => {
    await expect(
      service.updateProfile(
        societyId,
        { village: 'Fictional village' },
        otherOfficer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects council updates with the wrong seat distribution', async () => {
    await expect(
      service.updateCouncil(societyId, { members: [] }, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replaceCouncil).not.toHaveBeenCalled();
  });

  it('adds category and gender counts to an overall membership total', async () => {
    repository.membershipForPrincipal.mockResolvedValue([
      {
        ...baseRecord,
        memberships: [
          { year: 2026, category: 'CHILDREN', female: 178, male: 164 },
          { year: 2026, category: 'YOUTH', female: 246, male: 219 },
          { year: 2026, category: 'MOTHERS', female: 526, male: 0 },
          { year: 2026, category: 'ORDINARY', female: 1485, male: 1328 },
          { year: 2026, category: 'ELDERS_COUNCIL', female: 82, male: 65 },
        ],
      },
    ]);
    const result = await service.membership(2026, officer);
    expect(result).toMatchObject({
      femaleTotal: 2517,
      maleTotal: 1776,
      overallTotal: 4293,
    });
    expect(
      result.categories.reduce((sum, category) => sum + category.total, 0),
    ).toBe(result.overallTotal);
  });
});
