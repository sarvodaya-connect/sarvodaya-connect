import { ConflictException, Injectable } from '@nestjs/common';
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
} satisfies Prisma.SocietyInclude;
const detailInclude = {
  district: true,
  contacts: true,
  councilMembers: { orderBy: { seatNumber: 'asc' } },
  memberships: { orderBy: [{ year: 'desc' }, { category: 'asc' }] },
  gradeRequests: {
    where: { status: 'PENDING' },
    orderBy: { requestedAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.SocietyInclude;

/** Audit actions that count as a change to the society record (not reads or NIC reveals). */
export const SOCIETY_CHANGE_ACTIONS = [
  'SOCIETY_PROFILE_UPDATED',
  'SOCIETY_COUNCIL_UPDATED',
  'SOCIETY_MEMBERSHIP_UPDATED',
  'MEMBER_NIC_UPDATED',
  'SOCIETY_GRADE_CHANGED',
  'GRADE_CHANGE_REQUESTED',
  'GRADE_CHANGE_APPROVED',
  'GRADE_CHANGE_REJECTED',
  'ANNUAL_SUMMARY_UPDATED',
  'AUDIT_REPORT_UPLOADED',
  'DOCUMENT_UPLOADED',
  'WORK_PLAN_UPDATED',
] as const;

/** A direct grade change made by HQ while editing the record (D05e). */
export interface GradeChange {
  from: 'A' | 'B' | 'C' | null;
  to: 'A' | 'B' | 'C';
  reason: string;
}

function actorFields(principal: Principal) {
  return {
    actorId: principal.id,
    actorName: principal.displayName,
    actorRole: principal.roles[0] ?? null,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class SocietiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SocietyQueryDto, principal: Principal) {
    const where: Prisma.SocietyWhereInput = {
      AND: [societyWhereForPrincipal(principal)],
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.status ? { status: query.status } : {}),
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

  /**
   * Yearly figures, audit report, assigned staff and the latest change for the
   * society record. Read in one transaction so the record is consistent.
   */
  findRecordContext(
    society: { id: string; districtId: string },
    financialYear: number,
  ) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.annualFinancialSummary.findUnique({
          where: {
            societyId_financialYear: { societyId: society.id, financialYear },
          },
        }),
        this.prisma.societyDocument.findFirst({
          where: {
            societyId: society.id,
            documentType: 'AUDIT_REPORT',
            financialYear,
            uploadedAt: { not: null },
          },
          orderBy: [{ uploadedAt: 'desc' }, { version: 'desc' }],
        }),
        this.prisma.platformAccount.findMany({
          where: {
            OR: [
              { societyIds: { has: society.id } },
              { role: 'DISTRICT_MANAGER', districtId: society.districtId },
            ],
          },
          select: { displayName: true, role: true, status: true },
          orderBy: { displayName: 'asc' },
        }),
        this.prisma.platformAuditEvent.findFirst({
          where: {
            societyId: society.id,
            action: { in: [...SOCIETY_CHANGE_ACTIONS] },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]),
    ).then(([summary, auditReport, staff, lastChange]) => ({
      summary,
      auditReport,
      staff,
      lastChange,
    }));
  }

  async updateProfile(
    id: string,
    input: SocietyProfileUpdateDto,
    principal: Principal,
    change: { summary: string; grade?: GradeChange } = {
      summary: `Fields: ${Object.keys(input)
        .filter((key) => input[key as keyof typeof input] !== undefined)
        .join(', ')}`,
    },
  ) {
    try {
      return await this.saveProfile(id, input, principal, change);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `S number ${input.societyCode} is already used by another society`,
        );
      }
      return executeDatabaseOperation(() => Promise.reject(error));
    }
  }

  private saveProfile(
    id: string,
    input: SocietyProfileUpdateDto,
    principal: Principal,
    change: { summary: string; grade?: GradeChange },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { primaryContact, establishedOn } = input;
      const now = new Date();
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
          memberCount: input.memberCount,
          societyCode: input.societyCode,
          ...(input.landline !== undefined
            ? { landline: input.landline || null }
            : {}),
          ...(input.businessDescription !== undefined
            ? { businessDescription: input.businessDescription || null }
            : {}),
          ...(change.grade
            ? {
                grade: change.grade.to,
                gradeChangedAt: now,
                gradeChangedByName: principal.displayName,
                gradeChangedByRole: principal.roles[0] ?? null,
              }
            : {}),
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
      if (change.summary) {
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'SOCIETY_PROFILE_UPDATED',
            targetId: id,
            societyId: id,
            districtId: society.districtId,
            detail: change.summary.slice(0, 2000),
          },
        });
      }
      if (change.grade) {
        const { from, to, reason } = change.grade;
        // D05e: a direct change closes any request waiting for HQ.
        const pending = await tx.gradeChangeRequest.findMany({
          where: { societyId: id, status: 'PENDING' },
        });
        for (const request of pending) {
          const approved = request.toGrade === to;
          await tx.gradeChangeRequest.update({
            where: { id: request.id },
            data: {
              status: approved ? 'APPROVED' : 'REJECTED',
              decidedById: principal.id,
              decidedByName: principal.displayName,
              decidedAt: now,
              decisionComment: approved
                ? `Grade changed directly by HQ: ${reason}`.slice(0, 500)
                : `Grade changed directly by HQ to ${to}: ${reason}`.slice(
                    0,
                    500,
                  ),
            },
          });
        }
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'SOCIETY_GRADE_CHANGED',
            targetId: id,
            societyId: id,
            districtId: society.districtId,
            detail:
              `Grade ${from ?? 'not set'} → ${to} changed directly by HQ · reason: “${reason}”`.slice(
                0,
                2000,
              ),
          },
        });
      }
      return society;
    });
  }

  replaceCouncil(
    id: string,
    input: SocietyCouncilUpdateDto,
    principal: Principal,
  ) {
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const previous = await tx.societyCouncilMember.findMany({
          where: { societyId: id },
        });
        await tx.societyCouncilMember.deleteMany({ where: { societyId: id } });
        await tx.societyCouncilMember.createMany({
          data: input.members.map((member) => ({
            ...(() => {
              const before = previous.find(
                (p) =>
                  p.seatNumber === member.seatNumber &&
                  p.fullName === member.fullName,
              );
              return before
                ? {
                    id: before.id,
                    nicCiphertext: before.nicCiphertext,
                    nicLastFour: before.nicLastFour,
                  }
                : {};
            })(),
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
        const society = await tx.society.findUniqueOrThrow({ where: { id } });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'SOCIETY_COUNCIL_UPDATED',
            targetId: id,
            societyId: id,
            districtId: society.districtId,
            detail:
              'Council updated; NIC retained only for unchanged member identities',
          },
        });
        return tx.societyCouncilMember.findMany({
          where: { societyId: id },
          orderBy: { seatNumber: 'asc' },
        });
      }),
    );
  }

  replaceMembership(
    id: string,
    input: SocietyMembershipUpdateDto,
    principal: Principal,
  ) {
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
        const society = await tx.society.findUniqueOrThrow({ where: { id } });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'SOCIETY_MEMBERSHIP_UPDATED',
            targetId: id,
            societyId: id,
            districtId: society.districtId,
            detail: `Year ${input.year}`,
          },
        });
        return tx.societyMembershipCount.findMany({
          where: { societyId: id, year: input.year },
          orderBy: { category: 'asc' },
        });
      }),
    );
  }

  membershipForPrincipal(principal: Principal, year: number) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findMany({
        where: {
          ...societyWhereForPrincipal(principal),
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
