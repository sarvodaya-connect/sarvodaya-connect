import { ConflictException, Injectable } from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActivityInputDto } from './activities.dto.js';

const ACTIVITY_INCLUDE = {
  sdgs: { select: { sdg: true }, orderBy: { sdg: 'asc' } },
  society: {
    select: { id: true, nameEn: true, societyCode: true, districtId: true },
  },
} as const;

/** How far back the "Approved recently" list goes, and how long it can be. */
const RECENT_APPROVALS_DAYS = 30;
const RECENT_APPROVALS_LIMIT = 20;
/** The waiting queue is bounded; an SPC covers a few dozen societies at most. */
const WAITING_LIMIT = 200;

function actorFields(principal: Principal) {
  return {
    actorId: principal.id,
    actorName: principal.displayName,
    actorRole: principal.roles[0] ?? null,
  };
}

function activityFields(input: ActivityInputDto) {
  return {
    year: input.year,
    month: input.month,
    name: input.name,
    description: input.description,
    sector: input.sector,
    dimension: input.dimension,
    datesLabel: input.datesLabel ?? null,
    allocatedCost: input.allocatedCost,
    femaleParticipants: input.femaleParticipants ?? null,
    maleParticipants: input.maleParticipants ?? null,
    youthParticipants: input.youthParticipants ?? null,
    householdsBenefited: input.householdsBenefited ?? null,
    womenHeadedHouseholds: input.womenHeadedHouseholds ?? null,
    partners: input.partners ?? null,
    resourcesNeeded: input.resourcesNeeded ?? null,
    volunteerHours: input.volunteerHours ?? null,
  };
}

interface SocietyRef {
  id: string;
  districtId: string;
}

/** PostgreSQL access for activities and their UN SDGs. No access rules live here. */
@Injectable()
export class ActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSociety(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id },
        select: { id: true, nameEn: true, societyCode: true, districtId: true },
      }),
    );
  }

  findActivity(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.workPlanActivity.findUnique({
        where: { id },
        include: ACTIVITY_INCLUDE,
      }),
    );
  }

  /** Saves a new activity as waiting for the SPC and records it in the society history. */
  create(society: SocietyRef, input: ActivityInputDto, principal: Principal) {
    const now = new Date();
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const activity = await tx.workPlanActivity.create({
          data: {
            ...activityFields(input),
            societyId: society.id,
            status: 'WAITING_FOR_SPC',
            submittedAt: now,
            createdById: principal.id,
            createdByName: principal.displayName,
            createdByRole: principal.roles[0] ?? null,
            updatedByName: principal.displayName,
            updatedByRole: principal.roles[0] ?? null,
          },
          include: ACTIVITY_INCLUDE,
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'WORK_PLAN_UPDATED',
            targetId: activity.id,
            societyId: society.id,
            districtId: society.districtId,
            detail:
              `Activity “${input.name}” added to the ${input.year} work plan and sent to the SPC`.slice(
                0,
                2000,
              ),
          },
        });
        return activity;
      }),
    );
  }

  /**
   * Changes an activity that is waiting or was sent back, and sends it to the
   * SPC again. Approved activities count in the dashboards, so they stay as
   * they are.
   */
  update(
    activityId: string,
    society: SocietyRef,
    input: ActivityInputDto,
    principal: Principal,
  ) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const changed = await tx.workPlanActivity.updateMany({
          where: {
            id: activityId,
            status: { in: ['WAITING_FOR_SPC', 'SENT_BACK'] },
          },
          data: {
            ...activityFields(input),
            status: 'WAITING_FOR_SPC',
            submittedAt: new Date(),
            updatedByName: principal.displayName,
            updatedByRole: principal.roles[0] ?? null,
          },
        });
        if (changed.count === 0) {
          throw new ConflictException(
            'This activity is already approved and can no longer be changed',
          );
        }
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'WORK_PLAN_UPDATED',
            targetId: activityId,
            societyId: society.id,
            districtId: society.districtId,
            detail:
              `Activity “${input.name}” changed and sent to the SPC again`.slice(
                0,
                2000,
              ),
          },
        });
        return tx.workPlanActivity.findUniqueOrThrow({
          where: { id: activityId },
          include: ACTIVITY_INCLUDE,
        });
      }),
    );
  }

  /** Approves a waiting activity with its UN SDGs. A second decision is refused. */
  approve(
    activityId: string,
    society: SocietyRef & { name: string },
    sdgs: number[],
    principal: Principal,
  ) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const decided = await tx.workPlanActivity.updateMany({
          where: { id: activityId, status: 'WAITING_FOR_SPC' },
          data: {
            status: 'APPROVED',
            reviewedById: principal.id,
            reviewedByName: principal.displayName,
            reviewedAt: new Date(),
            reviewComment: null,
          },
        });
        if (decided.count === 0) {
          throw new ConflictException(
            'This activity is no longer waiting for approval',
          );
        }
        await tx.workPlanActivitySdg.deleteMany({ where: { activityId } });
        await tx.workPlanActivitySdg.createMany({
          data: sdgs.map((sdg) => ({ activityId, sdg })),
        });
        const activity = await tx.workPlanActivity.findUniqueOrThrow({
          where: { id: activityId },
          include: ACTIVITY_INCLUDE,
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'WORK_PLAN_UPDATED',
            targetId: activityId,
            societyId: society.id,
            districtId: society.districtId,
            detail:
              `Activity “${activity.name}” approved by the SPC · UN SDG ${sdgs.join(', ')}`.slice(
                0,
                2000,
              ),
          },
        });
        return activity;
      }),
    );
  }

  /** Sends a waiting activity back to the Society Officer. */
  sendBack(
    activityId: string,
    society: SocietyRef,
    comment: string | undefined,
    principal: Principal,
  ) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const decided = await tx.workPlanActivity.updateMany({
          where: { id: activityId, status: 'WAITING_FOR_SPC' },
          data: {
            status: 'SENT_BACK',
            reviewedById: principal.id,
            reviewedByName: principal.displayName,
            reviewedAt: new Date(),
            reviewComment: comment ?? null,
          },
        });
        if (decided.count === 0) {
          throw new ConflictException(
            'This activity is no longer waiting for approval',
          );
        }
        const activity = await tx.workPlanActivity.findUniqueOrThrow({
          where: { id: activityId },
          include: ACTIVITY_INCLUDE,
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'WORK_PLAN_UPDATED',
            targetId: activityId,
            societyId: society.id,
            districtId: society.districtId,
            detail: (comment
              ? `Activity “${activity.name}” sent back by the SPC · “${comment}”`
              : `Activity “${activity.name}” sent back by the SPC`
            ).slice(0, 2000),
          },
        });
        return activity;
      }),
    );
  }

  /** SP06 / M50: waiting activities and recent approvals for the SPC's societies. */
  async queue(societyIds: string[], now = new Date()) {
    if (societyIds.length === 0) return { waiting: [], approved: [] };
    const since = new Date(
      now.getTime() - RECENT_APPROVALS_DAYS * 24 * 60 * 60 * 1000,
    );
    const [waiting, approved] = await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.workPlanActivity.findMany({
          where: { societyId: { in: societyIds }, status: 'WAITING_FOR_SPC' },
          include: ACTIVITY_INCLUDE,
          orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
          take: WAITING_LIMIT,
        }),
        this.prisma.workPlanActivity.findMany({
          where: {
            societyId: { in: societyIds },
            status: 'APPROVED',
            reviewedAt: { gte: since },
          },
          include: ACTIVITY_INCLUDE,
          orderBy: [{ reviewedAt: 'desc' }, { id: 'asc' }],
          take: RECENT_APPROVALS_LIMIT,
        }),
      ]),
    );
    return { waiting, approved };
  }

  /** Active SPC accounts assigned to the society, who are told about new activities. */
  async spcRecipientIds(societyId: string) {
    const accounts = await executeDatabaseOperation(() =>
      this.prisma.platformAccount.findMany({
        where: {
          role: 'PROGRAMME_COORDINATOR',
          status: 'ACTIVE',
          societyIds: { has: societyId },
        },
        select: { id: true },
      }),
    );
    return accounts.map((account) => account.id);
  }
}

export type ActivityRow = NonNullable<
  Awaited<ReturnType<ActivitiesRepository['findActivity']>>
>;
