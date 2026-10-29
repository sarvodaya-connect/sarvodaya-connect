import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MembershipCategory } from '../generated/prisma/client.js';
import type { Principal } from '../auth/principal.js';
import { SocietyQueryDto } from './dto/society-query.dto.js';
import type {
  SocietyCouncilUpdateDto,
  SocietyMembershipUpdateDto,
  SocietyProfileUpdateDto,
} from './dto/society-updates.dto.js';
import {
  assertCanEditSociety,
  canViewSociety,
} from './society-access.policy.js';
import {
  SocietiesRepository,
  type SocietyRecord,
  type SocietySummaryRecord,
} from './societies.repository.js';

export const MEMBERSHIP_CATEGORY_VALUES: readonly MembershipCategory[] = [
  'CHILDREN',
  'YOUTH',
  'MOTHERS',
  'ORDINARY',
  'ELDERS_COUNCIL',
];

function membershipSummary(
  records: SocietyRecord['memberships'],
  year: number,
) {
  const categories = MEMBERSHIP_CATEGORY_VALUES.map((category) => {
    const row = records.find(
      (entry) => entry.year === year && entry.category === category,
    );
    const female = row?.female ?? 0;
    const male = row?.male ?? 0;
    return { category, female, male, total: female + male };
  });
  const femaleTotal = categories.reduce(
    (total, category) => total + category.female,
    0,
  );
  const maleTotal = categories.reduce(
    (total, category) => total + category.male,
    0,
  );
  return {
    year,
    categories,
    femaleTotal,
    maleTotal,
    overallTotal: femaleTotal + maleTotal,
  };
}

function summary(record: SocietySummaryRecord) {
  const primary = record.contacts?.find((contact) => contact.isPrimary);
  const present = [
    record.establishedOn,
    record.addressLine,
    record.village,
    record.gnDivision,
    record.dsDivision,
    primary?.fullName,
    primary?.phone,
    record.latitude != null && record.longitude != null,
  ].filter(Boolean).length;
  return {
    id: record.id,
    societyCode: record.societyCode,
    nameEn: record.nameEn,
    ...(record.nameLocal ? { nameLocal: record.nameLocal } : {}),
    district: {
      id: record.district.id,
      code: record.district.code,
      nameEn: record.district.nameEn,
    },
    status: record.status,
    verificationStatus: 'UNVERIFIED' as const,
    profileCompleteness: Math.round((present / 8) * 100),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const expectedCouncilSeats: Record<MembershipCategory, number> = {
  CHILDREN: 3,
  YOUTH: 3,
  MOTHERS: 3,
  ORDINARY: 9,
  ELDERS_COUNCIL: 7,
};

@Injectable()
export class SocietiesService {
  constructor(private readonly repository: SocietiesRepository) {}

  async list(query: SocietyQueryDto, principal: Principal) {
    if (query.verificationStatus && query.verificationStatus !== 'UNVERIFIED') {
      return {
        data: [],
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems: 0,
          totalPages: 0,
        },
      };
    }
    const { records, totalItems } = await this.repository.list(
      query,
      principal,
    );
    return {
      data: records.map(summary),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async getById(id: string, principal: Principal) {
    const record = await this.repository.findById(id);
    if (!record) throw new NotFoundException('Society not found');
    if (!canViewSociety(principal, record))
      throw new NotFoundException('Society not found');
    return {
      ...summary(record),
      ...(record.establishedOn
        ? { establishedOn: record.establishedOn.toISOString().slice(0, 10) }
        : {}),
      address: {
        ...(record.addressLine ? { addressLine: record.addressLine } : {}),
        ...(record.village ? { village: record.village } : {}),
        ...(record.gnDivision ? { gnDivision: record.gnDivision } : {}),
        ...(record.dsDivision ? { dsDivision: record.dsDivision } : {}),
      },
      ...(record.latitude != null && record.longitude != null
        ? {
            location: {
              latitude: record.latitude,
              longitude: record.longitude,
            },
          }
        : {}),
      contacts: record.contacts.map((contact) => ({
        id: contact.id,
        ...(contact.label ? { label: contact.label } : {}),
        ...(contact.fullName ? { fullName: contact.fullName } : {}),
        ...(contact.position ? { position: contact.position } : {}),
        ...(contact.phone ? { phone: contact.phone } : {}),
        ...(contact.email ? { email: contact.email } : {}),
        isPrimary: contact.isPrimary,
      })),
      committee: record.councilMembers.map((member) => ({
        id: member.id,
        seatNumber: member.seatNumber,
        nicMasked: member.nicLastFour ? `••••${member.nicLastFour}` : undefined,
        fullName: member.fullName,
        position: member.position,
        seatType: member.seatType,
        ...(member.phone ? { phone: member.phone } : {}),
        ...(member.email ? { email: member.email } : {}),
        ...(member.age != null ? { age: member.age } : {}),
        ...(member.appointedOn
          ? { appointedOn: member.appointedOn.toISOString().slice(0, 10) }
          : {}),
        ...(member.endedOn
          ? { endedOn: member.endedOn.toISOString().slice(0, 10) }
          : {}),
        isActive: member.isActive,
        isPrimaryContact: member.isPrimaryContact,
      })),
      ...(record.memberships.length > 0
        ? {
            membership: membershipSummary(
              record.memberships,
              record.memberships[0]!.year,
            ),
          }
        : {}),
      documents: [],
      history: [],
      createdAt: record.createdAt.toISOString(),
    };
  }

  async updateProfile(
    id: string,
    input: SocietyProfileUpdateDto,
    principal: Principal,
  ) {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException(
        'Provide at least one profile field to update',
      );
    }
    const current = await this.repository.findById(id);
    if (!current) throw new NotFoundException('Society not found');
    assertCanEditSociety(principal, current);
    const latitude = input.latitude ?? current.latitude;
    const longitude = input.longitude ?? current.longitude;
    if ((latitude == null) !== (longitude == null)) {
      throw new BadRequestException(
        'Latitude and longitude must be supplied together',
      );
    }
    await this.repository.updateProfile(id, input, principal);
    return this.getById(id, principal);
  }

  async updateCouncil(
    id: string,
    input: SocietyCouncilUpdateDto,
    principal: Principal,
  ) {
    const current = await this.repository.findById(id);
    if (!current) throw new NotFoundException('Society not found');
    assertCanEditSociety(principal, current);
    const totals = new Map<MembershipCategory, number>();
    for (const member of input.members) {
      totals.set(member.seatType, (totals.get(member.seatType) ?? 0) + 1);
      if (
        member.appointedOn &&
        member.endedOn &&
        member.endedOn < member.appointedOn
      ) {
        throw new BadRequestException(
          `Council seat ${member.seatNumber} has an invalid date range`,
        );
      }
      if (
        member.age != null &&
        ((member.seatType === 'CHILDREN' &&
          (member.age < 7 || member.age > 14)) ||
          (member.seatType === 'YOUTH' && (member.age < 15 || member.age > 25)))
      ) {
        throw new BadRequestException(
          `Council seat ${member.seatNumber} age does not match its category`,
        );
      }
    }
    for (const [category, expected] of Object.entries(expectedCouncilSeats)) {
      if (totals.get(category as MembershipCategory) !== expected) {
        throw new BadRequestException(
          `Council must contain ${expected} ${category.toLowerCase().replaceAll('_', ' ')} seats`,
        );
      }
    }
    await this.repository.replaceCouncil(id, input, principal);
    return this.getById(id, principal);
  }

  async updateMembership(
    id: string,
    input: SocietyMembershipUpdateDto,
    principal: Principal,
  ) {
    const current = await this.repository.findById(id);
    if (!current) throw new NotFoundException('Society not found');
    assertCanEditSociety(principal, current);
    if (
      new Set(input.categories.map((row) => row.category)).size !==
        MEMBERSHIP_CATEGORY_VALUES.length ||
      MEMBERSHIP_CATEGORY_VALUES.some(
        (category) =>
          !input.categories.some((row) => row.category === category),
      )
    ) {
      throw new BadRequestException(
        'Membership data must contain each of the five categories exactly once',
      );
    }
    await this.repository.replaceMembership(id, input, principal);
    return this.getById(id, principal);
  }

  async membership(year: number, principal: Principal) {
    const societies = await this.repository.membershipForPrincipal(
      principal,
      year,
    );
    const rows = societies.map((society) => ({
      societyId: society.id,
      societyCode: society.societyCode,
      societyName: society.nameEn,
      districtName: society.district.nameEn,
      ...membershipSummary(society.memberships, year),
    }));
    const categories = MEMBERSHIP_CATEGORY_VALUES.map((category) => {
      const female = rows.reduce(
        (sum, row) =>
          sum +
          row.categories.find((entry) => entry.category === category)!.female,
        0,
      );
      const male = rows.reduce(
        (sum, row) =>
          sum +
          row.categories.find((entry) => entry.category === category)!.male,
        0,
      );
      return { category, female, male, total: female + male };
    });
    const femaleTotal = categories.reduce(
      (sum, category) => sum + category.female,
      0,
    );
    const maleTotal = categories.reduce(
      (sum, category) => sum + category.male,
      0,
    );
    return {
      year,
      societies: rows,
      categories,
      femaleTotal,
      maleTotal,
      overallTotal: femaleTotal + maleTotal,
    };
  }
}
