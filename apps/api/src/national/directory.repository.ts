import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REGISTRAR_DOCUMENT_TYPES } from '../documents/upload-rules.js';

export const directoryInclude = (startYear: number) =>
  ({
    district: { select: { id: true, nameEn: true } },
    gradeRequests: {
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'desc' },
      take: 1,
      select: { fromGrade: true, toGrade: true, requestedAt: true },
    },
    annualSummaries: {
      where: { financialYear: startYear },
      select: { totalProfit: true, totalExpenses: true },
    },
    // The Exco's seats, groups and offices, so the list can show whether it
    // is complete (25 rows at most per society).
    councilMembers: {
      where: { isActive: true },
      select: {
        seatNumber: true,
        seatType: true,
        position: true,
        isActive: true,
      },
    },
  }) satisfies Prisma.SocietyInclude;

export type DirectoryRecord = Prisma.SocietyGetPayload<{
  include: ReturnType<typeof directoryInclude>;
}>;

/** PostgreSQL access for the society directory (D04, M66) and summary (M67). */
@Injectable()
export class DirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async page(
    where: Prisma.SocietyWhereInput,
    startYear: number,
    page: number,
    pageSize: number,
  ) {
    // Two plain queries: Prisma would run the included relations of a batched
    // transaction in parallel on one connection.
    const [records, totalItems] = await executeDatabaseOperation(() =>
      Promise.all([
        this.prisma.society.findMany({
          where,
          include: directoryInclude(startYear),
          orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.society.count({ where }),
      ]),
    );
    return { records, totalItems };
  }

  count(where: Prisma.SocietyWhereInput) {
    return executeDatabaseOperation(() => this.prisma.society.count({ where }));
  }

  async gradeCounts(where: Prisma.SocietyWhereInput) {
    const rows = await executeDatabaseOperation(() =>
      this.prisma.society.groupBy({
        by: ['grade'],
        where,
        _count: { _all: true },
      }),
    );
    const count = (grade: 'A' | 'B' | 'C') =>
      rows.find((row) => row.grade === grade)?._count._all ?? 0;
    return { A: count('A'), B: count('B'), C: count('C') };
  }

  /** The SPCs and Society Officers assigned to any of these societies. */
  staffFor(societyIds: string[]) {
    if (societyIds.length === 0) return Promise.resolve([]);
    return executeDatabaseOperation(() =>
      this.prisma.platformAccount.findMany({
        where: {
          role: { in: ['PROGRAMME_COORDINATOR', 'SOCIETY_OFFICER'] },
          status: { not: 'DISABLED' },
          societyIds: { hasSome: societyIds },
        },
        select: {
          id: true,
          displayName: true,
          role: true,
          status: true,
          societyIds: true,
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      }),
    );
  }

  /** The societies an SPC account covers, or null when there is no such SPC. */
  async spcSocietyIds(spcId: string) {
    const account = await executeDatabaseOperation(() =>
      this.prisma.platformAccount.findFirst({
        where: { id: spcId, role: 'PROGRAMME_COORDINATOR' },
        select: { societyIds: true },
      }),
    );
    return account?.societyIds ?? null;
  }

  summary(id: string, startYear: number, planYear: number) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id },
        include: {
          ...directoryInclude(startYear),
          contacts: { where: { isPrimary: true }, take: 1 },
          memberships: { orderBy: { year: 'desc' } },
          documents: {
            where: {
              financialYear: startYear,
              documentType: { in: [...REGISTRAR_DOCUMENT_TYPES] },
              uploadedAt: { not: null },
            },
            select: { documentType: true },
          },
          workPlanActivities: {
            where: { year: planYear },
            include: { sdgs: { orderBy: { sdg: 'asc' } } },
            orderBy: [{ reviewedAt: 'desc' }, { month: 'desc' }],
          },
        },
      }),
    );
  }
}
