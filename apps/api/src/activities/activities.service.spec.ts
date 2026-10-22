import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ActivitiesService } from './activities.service.js';

const principal = {
  id: 'officer-a',
  displayName: 'Officer',
  roles: ['SOCIETY_OFFICER'] as const,
  districtIds: [],
  societyIds: ['10000000-0000-4000-8000-000000000001'],
};
const input = {
  societyId: principal.societyIds[0]!,
  title: 'Community garden',
  description: 'A fictional activity',
  activityDate: '2026-10-20',
  location: 'Example Hall',
  sector: 'Community',
  dimension: 'SOCIAL' as const,
  femaleParticipants: 3,
  maleParticipants: 2,
  otherParticipants: 0,
};

describe('ActivitiesService validation and ownership', () => {
  it('rejects a society outside the principal scope', async () => {
    const repository = {
      canAccessSociety: vi.fn().mockResolvedValue(null),
    } as any;
    await expect(
      new ActivitiesService(repository).create(input, principal as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects district managers attempting to create society-owned reports', async () => {
    const districtManager = {
      id: 'dm-a',
      displayName: 'Manager',
      roles: ['DISTRICT_MANAGER'],
      districtIds: ['20000000-0000-4000-8000-000000000001'],
      societyIds: [],
    };
    const repository = {
      canAccessSociety: vi.fn().mockResolvedValue(null),
    } as any;
    await expect(
      new ActivitiesService(repository).create(input, districtManager as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects incomplete GPS coordinate pairs', async () => {
    const repository = {
      canAccessSociety: vi.fn().mockResolvedValue({ id: input.societyId }),
    } as any;
    await expect(
      new ActivitiesService(repository).create(
        { ...input, latitude: 6 },
        principal as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects zero participants on submission', async () => {
    const repository = {
      canAccessSociety: vi.fn().mockResolvedValue({ id: input.societyId }),
    } as any;
    await expect(
      new ActivitiesService(repository).create(
        { ...input, femaleParticipants: 0, maleParticipants: 0 },
        principal as any,
        true,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
