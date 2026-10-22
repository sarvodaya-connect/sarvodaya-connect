import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { Principal } from '../auth/principal.js';
import type { ActivityInputDto, ActivityQueryDto } from './dto/activity.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';

@Injectable()
export class ActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private scope(principal: Principal): Prisma.ActivityReportWhereInput {
    if (principal.roles.includes('HQ_ADMIN')) return {};
    if (principal.roles.includes('DISTRICT_MANAGER'))
      return { society: { districtId: { in: principal.districtIds } } };
    if (principal.roles.includes('SOCIETY_OFFICER'))
      return { societyId: { in: principal.societyIds } };
    return { id: { in: [] } };
  }

  async canAccessSociety(id: string, principal: Principal) {
    if (
      !principal.roles.includes('HQ_ADMIN') &&
      (!principal.roles.includes('SOCIETY_OFFICER') ||
        !principal.societyIds.includes(id))
    )
      return null;
    const where: Prisma.SocietyWhereInput = { id };
    return executeDatabaseOperation(() =>
      this.prisma.society.findFirst({ where, select: { id: true } }),
    );
  }

  async create(
    input: ActivityInputDto,
    principal: Principal,
    status: 'DRAFT' | 'SUBMITTED',
  ) {
    return executeDatabaseOperation(async () => {
      const classification = await this.prisma.activityClassification.upsert({
        where: {
          sector_dimension: {
            sector: input.sector.trim(),
            dimension: input.dimension,
          },
        },
        create: {
          sector: input.sector.trim(),
          dimension: input.dimension,
        },
        update: {},
      });
      return this.prisma.activityReport.create({
        data: {
          societyId: input.societyId,
          classificationId: classification.id,
          sdgs: input.sdgs ?? [],
          title: input.title.trim(),
          description: input.description.trim(),
          activityDate: new Date(input.activityDate),
          location: input.location.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          femaleParticipants: input.femaleParticipants,
          maleParticipants: input.maleParticipants,
          otherParticipants: input.otherParticipants ?? 0,
          outcomes: input.outcomes?.trim(),
          status,
          submittedById: principal.id,
          submittedAt: status === 'SUBMITTED' ? new Date() : null,
        },
        include: {
          society: { include: { district: true } },
          classification: true,
        },
      });
    });
  }

  async find(id: string, principal: Principal) {
    return executeDatabaseOperation(() =>
      this.prisma.activityReport.findFirst({
        where: { id, ...this.scope(principal) },
        include: {
          society: { include: { district: true } },
          classification: true,
        },
      }),
    );
  }

  async updateDraft(id: string, input: ActivityInputDto, ownerId: string) {
    return executeDatabaseOperation(async () => {
      const classification = await this.prisma.activityClassification.upsert({
        where: {
          sector_dimension: {
            sector: input.sector.trim(),
            dimension: input.dimension,
          },
        },
        create: {
          sector: input.sector.trim(),
          dimension: input.dimension,
        },
        update: {},
      });
      const changed = await this.prisma.activityReport.updateMany({
        where: { id, submittedById: ownerId, status: 'DRAFT' },
        data: {
          classificationId: classification.id,
          sdgs: input.sdgs ?? [],
          title: input.title.trim(),
          description: input.description.trim(),
          activityDate: new Date(input.activityDate),
          location: input.location.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          femaleParticipants: input.femaleParticipants,
          maleParticipants: input.maleParticipants,
          otherParticipants: input.otherParticipants ?? 0,
          outcomes: input.outcomes?.trim(),
        },
      });
      if (changed.count !== 1) return null;
      return this.prisma.activityReport.findUnique({
        where: { id },
        include: {
          society: { include: { district: true } },
          classification: true,
        },
      });
    });
  }

  async submit(id: string, ownerId: string) {
    return executeDatabaseOperation(async () => {
      const changed = await this.prisma.activityReport.updateMany({
        where: {
          id,
          submittedById: ownerId,
          status: { in: ['DRAFT', 'RESUBMITTED'] },
        },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });
      if (changed.count !== 1) return null;
      return this.prisma.activityReport.findUnique({
        where: { id },
        include: {
          society: { include: { district: true } },
          classification: true,
        },
      });
    });
  }

  async list(query: ActivityQueryDto, principal: Principal) {
    const where: Prisma.ActivityReportWhereInput = {
      AND: [
        this.scope(principal),
        {
          ...(query.societyId ? { societyId: query.societyId } : {}),
          ...(query.districtId
            ? { society: { districtId: query.districtId } }
            : {}),
          ...(query.status
            ? {
                status:
                  query.status as Prisma.EnumActivityReportStatusFilter['equals'],
              }
            : {}),
          ...(query.sector || query.dimension
            ? {
                classification: {
                  ...(query.sector
                    ? { sector: { equals: query.sector, mode: 'insensitive' } }
                    : {}),
                  ...(query.dimension
                    ? {
                        dimension:
                          query.dimension as Prisma.EnumActivityDimensionFilter['equals'],
                      }
                    : {}),
                },
              }
            : {}),
          ...(query.from || query.to
            ? {
                activityDate: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              }
            : {}),
        },
      ],
    };
    return executeDatabaseOperation(async () => {
      const [data, totalItems] = await this.prisma.$transaction([
        this.prisma.activityReport.findMany({
          where,
          include: {
            society: { include: { district: true } },
            classification: true,
          },
          orderBy: [{ activityDate: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.activityReport.count({ where }),
      ]);
      return {
        data,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / query.pageSize),
        },
      };
    });
  }

  async summary(query: ActivityQueryDto, principal: Principal) {
    const scope = this.scope(principal);
    const where: Prisma.ActivityReportWhereInput = {
      AND: [
        scope,
        {
          status: 'APPROVED',
          ...(query.societyId ? { societyId: query.societyId } : {}),
          ...(query.districtId
            ? { society: { districtId: query.districtId } }
            : {}),
          ...(query.sector || query.dimension
            ? {
                classification: {
                  ...(query.sector
                    ? { sector: { equals: query.sector, mode: 'insensitive' } }
                    : {}),
                  ...(query.dimension
                    ? {
                        dimension:
                          query.dimension as Prisma.EnumActivityDimensionFilter['equals'],
                      }
                    : {}),
                },
              }
            : {}),
          ...(query.from || query.to
            ? {
                activityDate: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              }
            : {}),
        },
      ],
    };
    const approved = await executeDatabaseOperation(() =>
      this.prisma.activityReport.findMany({
        where,
        include: { classification: true },
        orderBy: [{ activityDate: 'desc' }, { id: 'asc' }],
      }),
    );
    const bySector = new Map<
      string,
      { sector: string; activities: number; participants: number }
    >();
    for (const item of approved) {
      const row = bySector.get(item.classification.sector) ?? {
        sector: item.classification.sector,
        activities: 0,
        participants: 0,
      };
      row.activities += 1;
      row.participants +=
        item.femaleParticipants +
        item.maleParticipants +
        item.otherParticipants;
      bySector.set(row.sector, row);
    }
    return {
      activityCount: approved.length,
      participantCount: approved.reduce(
        (sum, item) =>
          sum +
          item.femaleParticipants +
          item.maleParticipants +
          item.otherParticipants,
        0,
      ),
      bySector: [...bySector.values()].sort((a, b) =>
        a.sector.localeCompare(b.sector),
      ),
    };
  }
}
