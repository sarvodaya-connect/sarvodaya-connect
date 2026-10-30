import {
  BadRequestException,
  ForbiddenException,
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
import { hasRole } from '../auth/principal.js';
import { latestCompletedFinancialYear } from './financial-year.js';
import {
  actorReference,
  toAnnualSummary,
  toGradeRequest,
} from './society-record.mappers.js';
import { recordPermissions } from './society-record.policy.js';
import type { GradeChange } from './societies.repository.js';
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

/** M06e: 10 digits such as 037 000 0000, or +94 and 9 digits. */
export function normaliseLandline(value: string): string | null {
  const compact = value.replace(/[\s-]/g, '');
  if (/^0\d{9}$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3, 6)} ${compact.slice(6)}`;
  }
  if (/^\+94\d{9}$/.test(compact)) {
    return `+94 ${compact.slice(3, 5)} ${compact.slice(5, 8)} ${compact.slice(8)}`;
  }
  return null;
}

const lkrOrPlain = (value: number) => value.toLocaleString('en-GB');

/** "Members 412 → 418; landline added" for the change history. */
export function describeProfileChange(
  before: {
    nameEn: string;
    nameLocal?: string | null;
    memberCount?: number | null;
    landline?: string | null;
    addressLine?: string | null;
    dsDivision?: string | null;
    gnDivision?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    businessDescription?: string | null;
    village?: string | null;
    establishedOn?: Date | null;
    societyCode: string;
  },
  input: SocietyProfileUpdateDto,
): string {
  const parts: string[] = [];
  const text = (
    label: string,
    previous: string | null | undefined,
    next: string | undefined,
  ) => {
    if (next === undefined || (previous ?? '') === next) return;
    if (!previous) parts.push(`${label} added`);
    else if (!next) parts.push(`${label} removed`);
    else parts.push(`${label} changed`);
  };
  if (input.nameEn !== undefined && input.nameEn !== before.nameEn)
    parts.push(`Name ${before.nameEn} → ${input.nameEn}`);
  text('Name in Sinhala or Tamil', before.nameLocal, input.nameLocal);
  if (
    input.societyCode !== undefined &&
    input.societyCode !== before.societyCode
  )
    parts.push(`S number ${before.societyCode} → ${input.societyCode}`);
  if (
    input.memberCount !== undefined &&
    input.memberCount !== (before.memberCount ?? null)
  ) {
    parts.push(
      before.memberCount == null
        ? `Members entered: ${lkrOrPlain(input.memberCount)}`
        : `Members ${lkrOrPlain(before.memberCount)} → ${lkrOrPlain(input.memberCount)}`,
    );
  }
  text('Landline', before.landline, input.landline);
  text('Address', before.addressLine, input.addressLine);
  text('DS division', before.dsDivision, input.dsDivision);
  text('GN division', before.gnDivision, input.gnDivision);
  text(
    'Business description',
    before.businessDescription,
    input.businessDescription,
  );
  text('Village', before.village, input.village);
  if (
    input.establishedOn !== undefined &&
    input.establishedOn !== before.establishedOn?.toISOString().slice(0, 10)
  )
    parts.push('Established date changed');
  if (input.primaryContact) parts.push('Primary contact updated');
  if (
    (input.latitude !== undefined && input.latitude !== before.latitude) ||
    (input.longitude !== undefined && input.longitude !== before.longitude)
  )
    parts.push('Map location changed');
  return parts.join('; ');
}

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
    const year = latestCompletedFinancialYear();
    const context = await this.repository.findRecordContext(record, year);
    const pending = record.gradeRequests?.[0];
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
      // SC-65: V4 society record.
      memberCount: record.memberCount ?? null,
      landline: record.landline ?? null,
      businessDescription: record.businessDescription ?? null,
      grade: record.grade ?? null,
      ...(record.gradeChangedAt
        ? {
            gradeChangedAt: record.gradeChangedAt.toISOString(),
            gradeChangedBy: actorReference(
              record.gradeChangedByName,
              record.gradeChangedByRole,
            ),
          }
        : {}),
      openGradeRequest: pending ? toGradeRequest(pending) : null,
      staff: context.staff.map((account) => ({
        role: account.role,
        displayName: account.displayName,
        accountStatus: account.status,
      })),
      annualSummary: toAnnualSummary(
        record.id,
        year,
        context.summary,
        context.auditReport,
      ),
      ...(context.lastChange
        ? {
            lastChange: {
              at: context.lastChange.createdAt.toISOString(),
              by: actorReference(
                context.lastChange.actorName,
                context.lastChange.actorRole,
              ),
            },
          }
        : {}),
      permissions: recordPermissions(principal, record),
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
    const isHq = hasRole(principal, 'HQ_ADMIN');
    if (input.societyCode !== undefined && !isHq) {
      throw new ForbiddenException('Only HQ can correct the S number');
    }
    if (
      (input.grade !== undefined || input.gradeReason !== undefined) &&
      !isHq
    ) {
      throw new ForbiddenException(
        'Only HQ can change a grade. Send a grade-change request instead',
      );
    }
    const latitude = input.latitude ?? current.latitude;
    const longitude = input.longitude ?? current.longitude;
    if ((latitude == null) !== (longitude == null)) {
      throw new BadRequestException(
        'Latitude and longitude must be supplied together',
      );
    }
    if (input.landline) {
      const landline = normaliseLandline(input.landline);
      if (!landline) {
        throw new BadRequestException(
          'Enter a 10-digit number, for example 037 000 0000, or leave the landline empty',
        );
      }
      input.landline = landline;
    }
    let grade: GradeChange | undefined;
    if (input.grade !== undefined && input.grade !== current.grade) {
      if (!input.gradeReason) {
        throw new BadRequestException(
          'Enter a reason for the grade change. It is shown in the grade history',
        );
      }
      grade = {
        from: current.grade ?? null,
        to: input.grade,
        reason: input.gradeReason,
      };
    }
    const { grade: _grade, gradeReason: _reason, ...profile } = input;
    const summary = describeProfileChange(current, profile);
    // Saving unchanged values (for example a retried request) is not a change.
    if (!summary && !grade) return this.getById(id, principal);
    await this.repository.updateProfile(id, profile, principal, {
      summary,
      ...(grade ? { grade } : {}),
    });
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
