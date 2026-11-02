import { Injectable, NotFoundException } from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanDecideGrade } from './society-record.policy.js';
import { actorReference, toGradeRequest } from './society-record.mappers.js';

export const GRADE_QUEUE_STATUSES = [
  'WAITING',
  'APPROVED',
  'REJECTED',
  'ALL',
] as const;
export type GradeQueueStatus = (typeof GRADE_QUEUE_STATUSES)[number];

const DAY_MS = 24 * 3600_000;

const societyFields = {
  id: true,
  nameEn: true,
  societyCode: true,
  grade: true,
  district: { select: { nameEn: true } },
} as const;

/**
 * V5 D22 / D22r: the national grade-change queue that HQ works through.
 * Only HQ decides grades, so only HQ sees the queue; requesters follow their
 * own requests on the society record.
 */
@Injectable()
export class GradeQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status: GradeQueueStatus, principal: Principal, now = new Date()) {
    assertCanDecideGrade(principal);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [rows, waiting, approved, rejected, decided] = await Promise.all([
      this.prisma.gradeChangeRequest.findMany({
        where:
          status === 'ALL'
            ? {}
            : { status: status === 'WAITING' ? 'PENDING' : status },
        include: { society: { select: societyFields } },
        // Waiting requests oldest first; decided ones newest first.
        orderBy:
          status === 'WAITING'
            ? { requestedAt: 'asc' }
            : [
                { decidedAt: { sort: 'desc', nulls: 'first' } },
                { requestedAt: 'desc' },
              ],
        take: 200,
      }),
      this.prisma.gradeChangeRequest.findMany({
        where: { status: 'PENDING' },
        select: { requestedAt: true },
      }),
      this.prisma.gradeChangeRequest.count({
        where: { status: 'APPROVED', decidedAt: { gte: monthStart } },
      }),
      this.prisma.gradeChangeRequest.count({
        where: { status: 'REJECTED', decidedAt: { gte: monthStart } },
      }),
      this.prisma.gradeChangeRequest.findMany({
        where: { decidedAt: { gte: new Date(now.getTime() - 90 * DAY_MS) } },
        select: { requestedAt: true, decidedAt: true },
      }),
    ]);
    const oldest = waiting.reduce<Date | null>(
      (min, row) => (!min || row.requestedAt < min ? row.requestedAt : min),
      null,
    );
    const decisionDays = decided
      .filter((row) => row.decidedAt)
      .map(
        (row) =>
          (row.decidedAt!.getTime() - row.requestedAt.getTime()) / DAY_MS,
      );
    return {
      summary: {
        waiting: waiting.length,
        oldestWaitingDays: oldest
          ? Math.floor((now.getTime() - oldest.getTime()) / DAY_MS)
          : null,
        approvedThisMonth: approved,
        rejectedThisMonth: rejected,
        // Over decisions in the last 90 days; null when there were none.
        averageDecisionDays: decisionDays.length
          ? Math.round(
              (decisionDays.reduce((a, b) => a + b, 0) / decisionDays.length) *
                10,
            ) / 10
          : null,
      },
      data: rows.map((row) => ({
        ...toGradeRequest(row),
        society: {
          id: row.society.id,
          name: row.society.nameEn,
          societyCode: row.society.societyCode,
          district: row.society.district.nameEn,
        },
      })),
    };
  }

  async detail(id: string, principal: Principal) {
    assertCanDecideGrade(principal);
    const request = await this.prisma.gradeChangeRequest.findUnique({
      where: { id },
      include: {
        society: {
          select: {
            ...societyFields,
            memberCount: true,
            updatedAt: true,
            gradeChangedAt: true,
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Grade-change request not found');
    const societyId = request.society.id;
    const latestPlanYear = await this.prisma.workPlanActivity.aggregate({
      where: { societyId },
      _max: { year: true },
    });
    const [excoMembers, planActivities, requests, directChanges] =
      await Promise.all([
        this.prisma.societyCouncilMember.count({
          where: { societyId, isActive: true },
        }),
        latestPlanYear._max.year
          ? this.prisma.workPlanActivity.count({
              where: { societyId, year: latestPlanYear._max.year },
            })
          : 0,
        this.prisma.gradeChangeRequest.findMany({
          where: { societyId },
          orderBy: { requestedAt: 'desc' },
        }),
        this.prisma.platformAuditEvent.findMany({
          where: { societyId, action: 'SOCIETY_GRADE_CHANGED' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            actorName: true,
            actorRole: true,
            detail: true,
            createdAt: true,
          },
        }),
      ]);
    // D22r grade history: requests, HQ decisions and direct HQ changes, newest first.
    const history = [
      ...requests.flatMap((row) => [
        {
          id: `${row.id}:requested`,
          kind: 'REQUESTED' as const,
          fromGrade: row.fromGrade,
          toGrade: row.toGrade,
          actor: actorReference(row.requestedByName, row.requestedByRole),
          at: row.requestedAt.toISOString(),
          note: row.reason,
        },
        ...(row.decidedAt
          ? [
              {
                id: `${row.id}:decided`,
                kind:
                  row.status === 'APPROVED'
                    ? ('APPROVED' as const)
                    : ('REJECTED' as const),
                fromGrade: row.fromGrade,
                toGrade: row.toGrade,
                actor: actorReference(row.decidedByName, 'HQ_ADMIN'),
                at: row.decidedAt.toISOString(),
                note: row.decisionComment ?? undefined,
              },
            ]
          : []),
      ]),
      ...directChanges.map((event) => ({
        id: event.id,
        kind: 'CHANGED_BY_HQ' as const,
        actor: actorReference(event.actorName, event.actorRole),
        at: event.createdAt.toISOString(),
        note: event.detail,
      })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return {
      ...toGradeRequest(request),
      society: {
        id: societyId,
        name: request.society.nameEn,
        societyCode: request.society.societyCode,
        district: request.society.district.nameEn,
        grade: request.society.grade,
        gradeChangedAt: request.society.gradeChangedAt?.toISOString() ?? null,
        memberCount: request.society.memberCount,
        excoMembers,
        planYear: latestPlanYear._max.year ?? null,
        planActivities,
        updatedAt: request.society.updatedAt.toISOString(),
      },
      history,
    };
  }
}
