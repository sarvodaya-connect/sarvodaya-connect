import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocietyQueryDto } from './dto/society-query.dto.js';
import type {
  SocietyProfileUpdateDto,
  SocietyCouncilUpdateDto,
  SocietyMembershipUpdateDto,
} from './dto/society-updates.dto.js';
import type { Principal } from '../auth/principal.js';
import { societyWhereForPrincipal } from './society-access.policy.js';

const include = {
  district: true,
  contacts: true,
  assignments: { where: { revokedAt: null } },
  memberships: { where: { year: new Date().getUTCFullYear() } },
  gradeChangeRequests: { where: { status: 'PENDING' }, select: { id: true }, take: 1 },
} satisfies Prisma.SocietyInclude;
const detailInclude = {
  district: true,
  contacts: true,
  councilMembers: { orderBy: { seatNumber: 'asc' } },
  memberships: { orderBy: [{ year: 'desc' }, { category: 'asc' }] },
  auditEvents: { orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }] },
  assignments: { where: { revokedAt: null } },
  gradeChangeRequests: { where: { status: 'PENDING' }, select: { id: true }, take: 1 },
} satisfies Prisma.SocietyInclude;

@Injectable()
export class SocietiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async nationalOverview(now = new Date()) {
    const staleBefore = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const [registered, active, byGrade, districts, waiting, waitingCount, activeDelegations, latestChanges, locations, activeIncident] = await executeDatabaseOperation(() => Promise.all([
      this.prisma.society.count(),
      this.prisma.society.count({ where: { status: 'ACTIVE' } }),
      this.prisma.society.groupBy({ by: ['grade'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      this.prisma.district.findMany({
        select: { id: true, code: true, nameEn: true, societies: { where: { status: 'ACTIVE' }, select: { grade: true, updatedAt: true } } },
        orderBy: { nameEn: 'asc' },
      }),
      this.prisma.gradeChangeRequest.findMany({ where: { status: 'PENDING' }, include: { society: { include: { district: { select: { id: true, nameEn: true } } } } }, orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }], take: 5 }),
      this.prisma.gradeChangeRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.districtDelegation.count({ where: { startsAt: { lte: now }, endsAt: { gt: now }, revokedAt: null } }),
      this.prisma.societyAuditEvent.findMany({ include: { society: { select: { id: true, societyCode: true, nameEn: true, district: { select: { id: true, nameEn: true } } } } }, orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }], take: 8 }),
      this.prisma.society.findMany({ where: { latitude: { not: null }, longitude: { not: null } }, select: { id: true, societyCode: true, nameEn: true, grade: true, latitude: true, longitude: true, district: { select: { nameEn: true } } }, orderBy: { nameEn: 'asc' } }),
      this.prisma.emergencyIncident.findFirst({ where: { status: 'ACTIVE' }, include: { district: { select: { nameEn: true } }, _count: { select: { assessments: true, actions: true } } }, orderBy: [{ activatedAt: 'desc' }, { id: 'asc' }] }),
    ]));
    const grades = { A: 0, B: 0, C: 0 };
    for (const row of byGrade) grades[row.grade] = row._count._all;
    const districtRows = districts.map((district) => ({
      id: district.id,
      code: district.code,
      nameEn: district.nameEn,
      active: district.societies.length,
      grades: district.societies.reduce((counts, society) => ({ ...counts, [society.grade]: counts[society.grade] + 1 }), { A: 0, B: 0, C: 0 }),
      stale: district.societies.filter((society) => society.updatedAt < staleBefore).length,
    }));
    return {
      asOf: now.toISOString(),
      registeredSocieties: registered,
      activeSocieties: active,
      gradeCounts: grades,
      pendingGradeRequests: waiting.map((request) => ({
        id: request.id, societyId: request.societyId, societyName: request.society.nameEn,
        societyCode: request.society.societyCode, district: request.society.district,
        currentGrade: request.currentGrade, proposedGrade: request.proposedGrade,
        requestedByName: request.requestedByName, requestedAt: request.requestedAt.toISOString(),
      })),
      pendingGradeRequestCount: waitingCount,
      activeDdmDelegations: activeDelegations,
      districts: districtRows,
      latestChanges: latestChanges.map((event) => ({
        id: event.id, societyId: event.societyId, societyName: event.society.nameEn,
        societyCode: event.society.societyCode, districtName: event.society.district.nameEn,
        eventType: event.eventType, summary: event.summary,
        actorName: event.actorDisplayName, occurredAt: event.occurredAt.toISOString(),
      })),
      locations: locations.map((row) => ({
        id: row.id, societyCode: row.societyCode, nameEn: row.nameEn,
        grade: row.grade, latitude: row.latitude!, longitude: row.longitude!, districtName: row.district.nameEn,
      })),
      activeIncident: activeIncident ? {
        title: activeIncident.title,
        districtName: activeIncident.district.nameEn,
        activatedAt: activeIncident.activatedAt.toISOString(),
        assessmentCount: activeIncident._count.assessments,
        actionCount: activeIncident._count.actions,
      } : null,
      staleSocieties: await this.prisma.society.count({ where: { updatedAt: { lt: staleBefore } } }),
      annualPlanCoverage: null,
      accountActivation: null,
    };
  }

  async list(query: SocietyQueryDto, principal: Principal, delegatedDistrictIds: readonly string[]) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const filters: Prisma.SocietyWhereInput = {
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
      ...(query.dsDivision ? { dsDivision: { equals: query.dsDivision, mode: 'insensitive' } } : {}),
      ...(query.spcUserId ? { assignments: { some: { role: 'SPC', userId: query.spcUserId, revokedAt: null } } } : {}),
      ...(query.freshness === 'STALE' ? { updatedAt: { lt: cutoff } } : {}),
      ...(query.freshness === 'RECENT' ? { updatedAt: { gte: cutoff } } : {}),
      ...(query.gradeRequest === 'OPEN'
        ? { gradeChangeRequests: { some: { status: 'PENDING' } } }
        : query.gradeRequest === 'NONE'
          ? { gradeChangeRequests: { none: { status: 'PENDING' } } }
          : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                nameEn: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                nameLocal: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                societyCode: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const where: Prisma.SocietyWhereInput = {
      AND: [societyWhereForPrincipal(principal, delegatedDistrictIds), filters],
    };

    const [records, totalItems] = await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.society.findMany({
          where,
          include,
          orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.society.count({ where }),
      ]),
    );

    return { records, totalItems };
  }

  findById(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({ where: { id }, include: detailInclude }),
    );
  }

  activeDelegatedDistrictIds(principal: Principal, now = new Date()) {
    if (!principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) return Promise.resolve([] as string[]);
    return executeDatabaseOperation(async () => {
      const delegations = await this.prisma.districtDelegation.findMany({
        where: { deputyUserId: principal.id, startsAt: { lte: now }, endsAt: { gt: now }, revokedAt: null },
        select: { districtId: true },
      });
      return delegations.map(({ districtId }) => districtId);
    });
  }

  updateProfile(id: string, input: SocietyProfileUpdateDto) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const { primaryContact, establishedOn } = input;
        const society = await tx.society.update({
          where: { id },
          data: {
            nameEn: input.nameEn,
            nameLocal: input.nameLocal,
            dsDivision: input.dsDivision,
            gnDivision: input.gnDivision,
            village: input.village,
            addressLine: input.addressLine,
            latitude: input.latitude,
            longitude: input.longitude,
            ...(establishedOn
              ? { establishedOn: new Date(`${establishedOn}T00:00:00.000Z`) }
              : {}),
          },
        });
        if (primaryContact) {
          const current = await tx.societyContact.findFirst({
            where: { societyId: id, isPrimary: true },
          });
          const contactData = {
            label: primaryContact.position ?? 'Primary contact',
            fullName: primaryContact.fullName,
            position: primaryContact.position,
            phone: primaryContact.phone,
            email: primaryContact.email,
            isPrimary: true,
          };
          if (current) {
            await tx.societyContact.updateMany({
              where: { societyId: id, isPrimary: true },
              data: { isPrimary: false },
            });
            await tx.societyContact.update({
              where: { id: current.id },
              data: contactData,
            });
          } else {
            await tx.societyContact.create({
              data: { societyId: id, ...contactData },
            });
          }
        }
        return society;
      }),
    );
  }

  replaceCouncil(id: string, input: SocietyCouncilUpdateDto) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.societyCouncilMember.deleteMany({ where: { societyId: id } });
        await tx.societyCouncilMember.createMany({
          data: input.members.map((member) => ({
            societyId: id,
            seatNumber: member.seatNumber,
            fullName: member.fullName,
            position: member.position,
            seatType: member.seatType,
            phone: member.phone,
            email: member.email,
            age: member.age,
            isActive: member.isActive,
            isPrimaryContact: member.isPrimaryContact,
            ...(member.appointedOn
              ? { appointedOn: new Date(`${member.appointedOn}T00:00:00.000Z`) }
              : {}),
            ...(member.endedOn
              ? { endedOn: new Date(`${member.endedOn}T00:00:00.000Z`) }
              : {}),
          })),
        });
        return tx.societyCouncilMember.findMany({
          where: { societyId: id },
          orderBy: { seatNumber: 'asc' },
        });
      }),
    );
  }

  replaceMembership(id: string, input: SocietyMembershipUpdateDto) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.societyMembershipCount.deleteMany({
          where: { societyId: id, year: input.year },
        });
        await tx.societyMembershipCount.createMany({
          data: input.categories.map((category) => ({
            societyId: id,
            year: input.year,
            category: category.category,
            female: category.female,
            male: category.male,
          })),
        });
        return tx.societyMembershipCount.findMany({
          where: { societyId: id, year: input.year },
          orderBy: { category: 'asc' },
        });
      }),
    );
  }

  membershipForPrincipal(principal: Principal, year: number, delegatedDistrictIds: readonly string[] = []) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findMany({
        where: {
          ...societyWhereForPrincipal(principal, delegatedDistrictIds),
          memberships: { some: { year } },
        },
        include: {
          district: true,
          memberships: { where: { year }, orderBy: { category: 'asc' } },
        },
        orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
      }),
    );
  }
}

export type SocietyRecord = NonNullable<
  Awaited<ReturnType<SocietiesRepository['findById']>>
>;

export type SocietySummaryRecord = Prisma.SocietyGetPayload<{
  include: typeof include;
}>;
