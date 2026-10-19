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
} satisfies Prisma.SocietyInclude;
const detailInclude = {
  district: true,
  contacts: true,
  councilMembers: { orderBy: { seatNumber: 'asc' } },
  memberships: { orderBy: [{ year: 'desc' }, { category: 'asc' }] },
} satisfies Prisma.SocietyInclude;

@Injectable()
export class SocietiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SocietyQueryDto) {
    const where: Prisma.SocietyWhereInput = {
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
