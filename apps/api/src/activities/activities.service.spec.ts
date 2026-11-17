import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findDemoPrincipal } from '../auth/demo-principals.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { ApproveActivityDto } from './activities.dto.js';
import type { ActivitiesRepository } from './activities.repository.js';
import {
  ActivitiesService,
  developmentGoals,
  plannableYears,
} from './activities.service.js';
import { toClassification } from './activity.mappers.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const CENTRAL = '29000000-0000-4000-8000-000000000002';
const SUNRISE = {
  id: '29000000-0000-4000-8000-000000000101',
  nameEn: 'Example Sunrise Society',
  societyCode: 'S-1001',
  districtId: NORTH,
};
const LOTUS = {
  id: '29000000-0000-4000-8000-000000000103',
  nameEn: 'Example Lotus Society',
  societyCode: 'S-1003',
  districtId: CENTRAL,
};
const ACTIVITY_ID = '29000000-0000-4000-8000-000000000901';

const officer = findDemoPrincipal('demo-officer-sunrise')!;
const otherOfficer = findDemoPrincipal('demo-officer-lotus')!;
const spc = findDemoPrincipal('demo-programme-coordinator')!;
const ddm = findDemoPrincipal('demo-deputy-district-manager')!;
const dm = findDemoPrincipal('demo-dm-north')!;
const hq = findDemoPrincipal('demo-hq-admin')!;

const { last } = plannableYears();

const input = {
  year: last,
  month: 9,
  name: 'Youth leadership camp',
  description: 'Three-day camp for 40 young people from the village.',
  sector: 'Community education',
  dimension: 'SOCIAL' as const,
  datesLabel: '12–14 Sep',
  allocatedCost: 55000,
  femaleParticipants: 24,
  maleParticipants: 14,
  youthParticipants: 12,
  householdsBenefited: 146,
  womenHeadedHouseholds: 31,
  volunteerHours: 120,
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    societyId: SUNRISE.id,
    ...input,
    sector: input.sector,
    partners: null,
    resourcesNeeded: null,
    status: 'WAITING_FOR_SPC',
    createdById: officer.id,
    createdByName: officer.displayName,
    createdByRole: 'SOCIETY_OFFICER',
    submittedAt: new Date('2026-11-02T03:50:00.000Z'),
    reviewedByName: null,
    reviewedAt: null,
    reviewComment: null,
    sdgs: [] as { sdg: number }[],
    classifiedAt: null as Date | null,
    goalDimensions: [] as { dimension: string }[],
    goalCategories: [] as { category: string }[],
    society: SUNRISE,
    ...overrides,
  };
}

describe('ActivitiesService (V5 PR 4)', () => {
  const repository = {
    findSociety: vi.fn(),
    findActivity: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    approve: vi.fn(),
    sendBack: vi.fn(),
    queue: vi.fn(),
    spcRecipientIds: vi.fn(),
  };
  const notifications = { notifyUsers: vi.fn() };
  let service: ActivitiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ActivitiesService(
      repository as unknown as ActivitiesRepository,
      notifications as unknown as NotificationsService,
    );
    repository.findSociety.mockImplementation(async (id: string) =>
      id === SUNRISE.id ? SUNRISE : id === LOTUS.id ? LOTUS : null,
    );
    repository.create.mockResolvedValue(row());
    repository.update.mockResolvedValue(row());
    repository.spcRecipientIds.mockResolvedValue([spc.id, 'spc-2']);
  });

  describe('adding an activity (M09a–M09d)', () => {
    it.each([
      ['Society Officer', officer],
      ['assigned SPC', spc],
      ['assigned DDM', ddm],
      ['HQ', hq],
    ])('lets the %s add it, waiting for the SPC', async (_label, principal) => {
      const result = await service.create(SUNRISE.id, input, principal);
      expect(repository.create).toHaveBeenCalledWith(SUNRISE, input, principal);
      expect(result).toMatchObject({
        status: 'WAITING_FOR_SPC',
        sdgs: [],
        society: { name: SUNRISE.nameEn },
      });
    });

    it('tells the society SPCs, but not the person who added it', async () => {
      await service.create(SUNRISE.id, input, spc);
      expect(notifications.notifyUsers).toHaveBeenCalledWith(
        ['spc-2'],
        expect.objectContaining({
          category: 'APPROVAL',
          linkPath: `/activities-to-approve/${ACTIVITY_ID}`,
        }),
      );
    });

    it('lets a District Manager view but not add', async () => {
      await expect(service.create(SUNRISE.id, input, dm)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('reports a society outside the scope as not found', async () => {
      await expect(
        service.create(SUNRISE.id, input, otherOfficer),
      ).rejects.toThrow(NotFoundException);
      await expect(service.create(LOTUS.id, input, officer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('checks the year and that youth and women-headed households are inside the totals', async () => {
      await expect(
        service.create(SUNRISE.id, { ...input, year: last + 1 }, officer),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(
          SUNRISE.id,
          { ...input, youthParticipants: 39 },
          officer,
        ),
      ).rejects.toThrow('Youth are counted inside');
      await expect(
        service.create(
          SUNRISE.id,
          { ...input, womenHeadedHouseholds: 147 },
          officer,
        ),
      ).rejects.toThrow('Women-headed households');
    });

    it('changes only activities of the same society', async () => {
      repository.findActivity.mockResolvedValue(
        row({ societyId: LOTUS.id, society: LOTUS }),
      );
      await expect(
        service.update(SUNRISE.id, ACTIVITY_ID, input, officer),
      ).rejects.toThrow(NotFoundException);
      repository.findActivity.mockResolvedValue(row());
      await service.update(SUNRISE.id, ACTIVITY_ID, input, officer);
      expect(repository.update).toHaveBeenCalled();
    });
  });

  describe('SPC approval (SP06–SP08, M50–M52)', () => {
    it('lets the assigned SPC approve with the UN SDGs, sorted', async () => {
      repository.findActivity.mockResolvedValue(row());
      repository.approve.mockResolvedValue(
        row({
          status: 'APPROVED',
          sdgs: [{ sdg: 4 }, { sdg: 16 }],
          reviewedByName: spc.displayName,
          reviewedAt: new Date('2026-11-02T04:00:00.000Z'),
        }),
      );
      const result = await service.approve(ACTIVITY_ID, { sdgs: [16, 4] }, spc);
      expect(repository.approve).toHaveBeenCalledWith(
        ACTIVITY_ID,
        expect.objectContaining({ id: SUNRISE.id }),
        [4, 16],
        // An older app sends UN SDGs only: recorded without Development Goals.
        null,
        spc,
      );
      expect(result).toMatchObject({
        status: 'APPROVED',
        sdgs: [4, 16],
        classification: {
          state: 'NOT_CLASSIFIED',
          dimensions: [],
          categories: [],
          sdgs: [4, 16],
        },
        review: { by: { displayName: spc.displayName } },
        permissions: { canReview: false, canEdit: false },
      });
      expect(notifications.notifyUsers).toHaveBeenCalledWith(
        [officer.id],
        expect.objectContaining({
          title: 'Activity approved: Youth leadership camp',
        }),
      );
    });

    it.each([
      ['Society Officer', officer],
      ['DDM', ddm],
      ['District Manager', dm],
      ['HQ', hq],
    ])('refuses approval by the %s', async (_label, principal) => {
      repository.findActivity.mockResolvedValue(row());
      await expect(
        service.approve(ACTIVITY_ID, { sdgs: [4] }, principal),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.sendBack(ACTIVITY_ID, {}, principal),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.approve).not.toHaveBeenCalled();
      expect(repository.sendBack).not.toHaveBeenCalled();
    });

    it('hides activities of societies the SPC is not assigned to', async () => {
      repository.findActivity.mockResolvedValue(
        row({ societyId: LOTUS.id, society: LOTUS }),
      );
      await expect(
        service.approve(ACTIVITY_ID, { sdgs: [4] }, spc),
      ).rejects.toThrow(NotFoundException);
    });

    it('passes on a second decision as a conflict', async () => {
      repository.findActivity.mockResolvedValue(row());
      repository.approve.mockRejectedValue(
        new ConflictException(
          'This activity is no longer waiting for approval',
        ),
      );
      await expect(
        service.approve(ACTIVITY_ID, { sdgs: [4] }, spc),
      ).rejects.toThrow(ConflictException);
      expect(notifications.notifyUsers).not.toHaveBeenCalled();
    });

    it('sends it back with the SPC comment and tells the Society Officer', async () => {
      repository.findActivity.mockResolvedValue(row());
      repository.sendBack.mockResolvedValue(
        row({
          status: 'SENT_BACK',
          reviewedByName: spc.displayName,
          reviewedAt: new Date(),
          reviewComment: 'Split the participants by ward',
        }),
      );
      const result = await service.sendBack(
        ACTIVITY_ID,
        { comment: 'Split the participants by ward' },
        spc,
      );
      expect(result).toMatchObject({
        status: 'SENT_BACK',
        review: { comment: 'Split the participants by ward' },
      });
      expect(notifications.notifyUsers).toHaveBeenCalledWith(
        [officer.id],
        expect.objectContaining({ category: 'RETURNED' }),
      );
    });

    it('lists the SPC queue for the assigned societies only', async () => {
      repository.queue.mockResolvedValue({
        waiting: [row()],
        approved: [
          row({
            id: 'a2',
            status: 'APPROVED',
            sdgs: [{ sdg: 6 }],
            reviewedAt: new Date('2026-10-25T04:00:00.000Z'),
          }),
        ],
      });
      const result = await service.queue(spc);
      expect(repository.queue).toHaveBeenCalledWith(spc.societyIds);
      expect(result.societyCount).toBe(2);
      expect(result.waiting[0]).toMatchObject({
        totalParticipants: 38,
        householdsBenefited: 146,
        sentBy: { displayName: officer.displayName },
      });
      expect(result.approvedRecently[0]).toMatchObject({
        sdgs: [6],
        approvedAt: '2026-10-25T04:00:00.000Z',
      });
    });
  });

  describe('Development Goals (issue #169)', () => {
    const approved = new Date('2026-11-16T04:00:00.000Z');

    it('approves with several dimensions, categories and UN SDGs, in catalogue order', async () => {
      repository.findActivity.mockResolvedValue(row());
      repository.approve.mockResolvedValue(
        row({
          status: 'APPROVED',
          sdgs: [{ sdg: 4 }, { sdg: 5 }],
          reviewedByName: spc.displayName,
          reviewedAt: approved,
          classifiedAt: approved,
          goalDimensions: [
            { dimension: 'GOVERNANCE' },
            { dimension: 'SOCIAL' },
          ],
          goalCategories: [
            { category: 'ENVIRONMENT' },
            { category: 'COMMUNITY_EDUCATION' },
          ],
        }),
      );
      const result = await service.approve(
        ACTIVITY_ID,
        {
          sdgs: [5, 4],
          dimensions: ['GOVERNANCE', 'SOCIAL'],
          categories: ['ENVIRONMENT', 'COMMUNITY_EDUCATION'],
        },
        spc,
      );
      expect(repository.approve).toHaveBeenCalledWith(
        ACTIVITY_ID,
        expect.objectContaining({ id: SUNRISE.id }),
        [4, 5],
        {
          dimensions: ['SOCIAL', 'GOVERNANCE'],
          categories: ['COMMUNITY_EDUCATION', 'ENVIRONMENT'],
        },
        spc,
      );
      expect(result.classification).toEqual({
        state: 'CLASSIFIED',
        dimensions: ['SOCIAL', 'GOVERNANCE'],
        categories: ['COMMUNITY_EDUCATION', 'ENVIRONMENT'],
        sdgs: [4, 5],
        classifiedAt: approved.toISOString(),
        classifiedBy: {
          displayName: spc.displayName,
          role: 'PROGRAMME_COORDINATOR',
        },
      });
    });

    it.each([
      [{ dimensions: ['SOCIAL'] }, 'Choose at least one Sarvodaya category'],
      [{ categories: ['CULTURE'] }, 'Choose at least one Sarvodaya dimension'],
      [
        { dimensions: ['SOCIAL'], categories: [] },
        'Choose at least one Sarvodaya category',
      ],
    ])(
      'refuses half a classification %j before anything is saved',
      async (goals, message) => {
        repository.findActivity.mockResolvedValue(row());
        await expect(
          service.approve(ACTIVITY_ID, { sdgs: [4], ...goals } as never, spc),
        ).rejects.toThrow(message);
        expect(repository.approve).not.toHaveBeenCalled();
      },
    );

    it('checks the SPC and scope before the classification', async () => {
      repository.findActivity.mockResolvedValue(row());
      const goals = {
        sdgs: [4],
        dimensions: ['SOCIAL'],
        categories: ['CULTURE'],
      };
      for (const principal of [officer, ddm, dm, hq])
        await expect(
          service.approve(ACTIVITY_ID, goals as never, principal),
        ).rejects.toThrow(ForbiddenException);
      repository.findActivity.mockResolvedValue(
        row({ societyId: LOTUS.id, society: LOTUS }),
      );
      await expect(
        service.approve(ACTIVITY_ID, goals as never, spc),
      ).rejects.toThrow(NotFoundException);
      expect(repository.approve).not.toHaveBeenCalled();
    });

    it('returns null when neither list is sent, and orders what is sent', () => {
      expect(developmentGoals({})).toBeNull();
      expect(
        developmentGoals({
          dimensions: ['ECONOMIC', 'SOCIAL'],
          categories: ['AGRICULTURE', 'CULTURE'],
        }),
      ).toEqual({
        dimensions: ['SOCIAL', 'ECONOMIC'],
        categories: ['CULTURE', 'AGRICULTURE'],
      });
    });

    it.each([
      [{ dimensions: [] }, 'Choose at least one Sarvodaya dimension'],
      [{ categories: [] }, 'Choose at least one Sarvodaya category'],
      [
        { dimensions: ['SOCIAL', 'SOCIAL'] },
        'Choose each Sarvodaya dimension only once',
      ],
      [
        { categories: ['CULTURE', 'CULTURE'] },
        'Choose each Sarvodaya category only once',
      ],
      [{ dimensions: ['SPIRITUAL'] }, 'Each dimension must be one of'],
      [{ categories: ['Culture'] }, 'Each category must be one of the ten'],
      [{ categories: 'CULTURE' }, 'categories must be a list'],
    ])('refuses %j in the request', async (goals, message) => {
      const errors = await validate(
        plainToInstance(ApproveActivityDto, { sdgs: [4], ...goals }),
      );
      expect(JSON.stringify(errors)).toContain(message);
    });

    it('accepts every dimension and category once', async () => {
      expect(
        await validate(
          plainToInstance(ApproveActivityDto, {
            sdgs: [1],
            dimensions: ['SOCIAL', 'ECONOMIC', 'GOVERNANCE'],
            categories: [
              'COMMUNITY_EDUCATION',
              'CHILD_WELLBEING',
              'CULTURE',
              'ECONOMY',
              'GOVERNANCE',
              'HEALTH_NUTRITION',
              'HOUSING_INFRASTRUCTURE',
              'SPIRITUAL_DEVELOPMENT',
              'AGRICULTURE',
              'ENVIRONMENT',
            ],
          }),
        ),
      ).toEqual([]);
    });

    it('never reads the Society Officer sector or dimension as the SPC classification', () => {
      const legacy = row({
        status: 'APPROVED',
        sector: 'Economy',
        dimension: 'ECONOMIC',
        sdgs: [{ sdg: 8 }],
        reviewedByName: spc.displayName,
        reviewedAt: approved,
      });
      expect(toClassification(legacy)).toEqual({
        state: 'NOT_CLASSIFIED',
        dimensions: [],
        categories: [],
        sdgs: [8],
      });
      // Planned before review existed: approved, no reviewer, no UN SDGs.
      expect(
        toClassification(row({ status: 'APPROVED', sdgs: [] })),
      ).toMatchObject({ state: 'NOT_CLASSIFIED', sdgs: [] });
      for (const status of ['WAITING_FOR_SPC', 'SENT_BACK'])
        expect(toClassification(row({ status }))).toMatchObject({
          state: 'PENDING',
          dimensions: [],
          categories: [],
        });
    });
  });

  describe('UN SDG choice', () => {
    it.each([
      [[], 'Choose at least one UN SDG to approve'],
      [[0], 'Each UN SDG is a number from 1 to 17'],
      [[18], 'Each UN SDG is a number from 1 to 17'],
      [[4, 4], 'Choose each UN SDG only once'],
    ])('refuses %j', async (sdgs, message) => {
      const errors = await validate(
        plainToInstance(ApproveActivityDto, { sdgs }),
      );
      expect(JSON.stringify(errors)).toContain(message);
    });

    it('accepts every goal from 1 to 17', async () => {
      const sdgs = Array.from({ length: 17 }, (_, index) => index + 1);
      expect(
        await validate(plainToInstance(ApproveActivityDto, { sdgs })),
      ).toEqual([]);
    });
  });
});
