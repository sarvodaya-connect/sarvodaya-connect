import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MembershipCategory } from '../generated/prisma/client.js';
import type { Principal } from '../auth/principal.js';
import { SocietyQueryDto } from './dto/society-query.dto.js';
import { MAX_MEMBERS } from './dto/society-updates.dto.js';
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
  MAP_POINT_LIMIT,
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

const STAFF_ORDER = [
  'DISTRICT_MANAGER',
  'DEPUTY_DISTRICT_MANAGER',
  'PROGRAMME_COORDINATOR',
  'SOCIETY_OFFICER',
];
function staffOrder(role: string) {
  const index = STAFF_ORDER.indexOf(role);
  return index === -1 ? STAFF_ORDER.length : index;
}

/** Whole years between a date of birth and a day (V5: age comes from the date of birth). */
export function ageOn(dateOfBirth: Date, day: Date) {
  let age = day.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    day.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (day.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      day.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** V5: every society's Exco has 25 seats. */
export const EXCO_SEATS = 25;

/** The offices chosen from the Exco members (V5 D05c, M07o). */
export const OFFICE_BEARERS = ['President', 'Secretary', 'Treasurer'] as const;

const expectedCouncilSeats: Record<MembershipCategory, number> = {
  CHILDREN: 3,
  YOUTH: 3,
  MOTHERS: 3,
  ORDINARY: 9,
  ELDERS_COUNCIL: 7,
};

/**
 * The 25 Exco seats. The Exco may be saved while it is still being entered
 * (a new society starts with none; its Society Officer adds them), so:
 * - every seat entered must keep its category within the agreed number
 *   (3 children, 3 youth, 3 mothers, 9 ordinary, 7 elders' council), and
 *   children's and youth seats within their age range;
 * - each office (President, Secretary, Treasurer) is held by at most one member;
 * - once all 25 seats are entered, each category has exactly its number.
 * Choosing all three offices is asked for by the dashboard and phone, not
 * enforced here, so existing full Excos without one keep saving as before.
 * Used when HQ creates a society (D05n) and whenever the Exco is edited.
 */
export function assertValidCouncil(
  members: SocietyCouncilUpdateDto['members'],
) {
  const totals = new Map<MembershipCategory, number>();
  const today = new Date();
  for (const member of members) {
    totals.set(member.seatType, (totals.get(member.seatType) ?? 0) + 1);
    if (
      member.dateOfBirth &&
      new Date(`${member.dateOfBirth}T00:00:00.000Z`) > today
    ) {
      throw new BadRequestException(
        `Council seat ${member.seatNumber} has a date of birth in the future`,
      );
    }
    const age = member.dateOfBirth
      ? ageOn(new Date(`${member.dateOfBirth}T00:00:00.000Z`), today)
      : member.age;
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
      age != null &&
      ((member.seatType === 'CHILDREN' && (age < 7 || age > 14)) ||
        (member.seatType === 'YOUTH' && (age < 15 || age > 25)))
    ) {
      throw new BadRequestException(
        `Council seat ${member.seatNumber} age does not match its category`,
      );
    }
  }
  const complete = members.length === EXCO_SEATS;
  for (const [category, expected] of Object.entries(expectedCouncilSeats)) {
    const total = totals.get(category as MembershipCategory) ?? 0;
    const name = category.toLowerCase().replaceAll('_', ' ');
    if (total > expected) {
      throw new BadRequestException(
        `Council can have only ${expected} ${name} seats`,
      );
    }
    if (complete && total !== expected) {
      throw new BadRequestException(
        `Council must contain ${expected} ${name} seats`,
      );
    }
  }
  for (const office of OFFICE_BEARERS) {
    const holders = members.filter(
      (member) => member.position.trim().toLowerCase() === office.toLowerCase(),
    ).length;
    if (holders > 1) throw new BadRequestException(`Choose only one ${office}`);
  }
}

const GROUP_NAMES: Record<MembershipCategory, string> = {
  CHILDREN: "children's",
  YOUTH: 'youth',
  MOTHERS: "mothers'",
  ORDINARY: 'ordinary',
  ELDERS_COUNCIL: "elders' council",
};

/**
 * Whether the Exco is complete, and what is still missing, in plain words.
 * Complete means all of:
 * - 25 seats (1–25), each held by one active member;
 * - the agreed groups: 3 children, 3 youth, 3 mothers, 9 ordinary and
 *   7 elders' council;
 * - exactly one President, one Secretary and one Treasurer.
 * An Exco can be saved before then (a new society starts with none), so a
 * partly entered or older record is reported as incomplete, never refused.
 * The dashboard and the phone show this status rather than working it out.
 */
export function excoStatus(
  members: {
    seatNumber: number | null;
    isActive: boolean;
    seatType?: MembershipCategory | null;
    position?: string | null;
  }[],
) {
  const active = members.filter(
    (member) =>
      member.isActive &&
      member.seatNumber != null &&
      member.seatNumber >= 1 &&
      member.seatNumber <= EXCO_SEATS,
  );
  const seats = new Set(active.map((member) => member.seatNumber));
  const filledSeats = seats.size;
  const problems: string[] = [];
  const toFill = EXCO_SEATS - filledSeats;
  if (filledSeats === 0)
    problems.push('No Exco members have been entered yet.');
  else if (toFill > 0)
    problems.push(
      `${toFill} of ${EXCO_SEATS} ${toFill === 1 ? 'seat is' : 'seats are'} still to fill.`,
    );
  if (active.length > filledSeats)
    problems.push('More than one active member holds the same seat.');
  for (const [category, expected] of Object.entries(expectedCouncilSeats)) {
    const total = active.filter(
      (member) => member.seatType === category,
    ).length;
    if (total > expected || (toFill <= 0 && total !== expected))
      problems.push(
        `${total} ${GROUP_NAMES[category as MembershipCategory]} seats are recorded; the Exco has ${expected}.`,
      );
  }
  const missingOffices: string[] = [];
  for (const office of OFFICE_BEARERS) {
    const holders = active.filter(
      (member) =>
        member.position?.trim().toLowerCase() === office.toLowerCase(),
    ).length;
    if (holders === 0) missingOffices.push(office);
    if (holders > 1)
      problems.push(
        `${holders} members are recorded as ${office}; choose one.`,
      );
  }
  if (missingOffices.length && filledSeats > 0)
    problems.push(
      `No ${missingOffices.join(', ').replace(/, ([^,]*)$/, ' or $1')} chosen yet.`,
    );
  return {
    filledSeats,
    totalSeats: EXCO_SEATS,
    complete: problems.length === 0 && missingOffices.length === 0,
    missingOffices,
    problems,
  };
}

/**
 * Issue #141: female and male members come together and the total is always
 * worked out here, never taken from the app. A total sent alone (by an app
 * from before #141) is accepted only while the society has no split, or when
 * it already equals the split, so it cannot contradict the female and male
 * counts. Sets `input.memberCount` to the total to save.
 */
export function memberSplit(
  input: SocietyProfileUpdateDto,
  current: {
    femaleMembers?: number | null;
    maleMembers?: number | null;
  },
) {
  const { femaleMembers: female, maleMembers: male } = input;
  if ((female === undefined) !== (male === undefined)) {
    throw new BadRequestException(
      'Enter both the female and the male members. The total is worked out from them',
    );
  }
  if (female !== undefined && male !== undefined) {
    const total = female + male;
    if (total > MAX_MEMBERS) {
      throw new BadRequestException(
        'Female and male members together cannot be more than 1,000,000',
      );
    }
    if (input.memberCount !== undefined && input.memberCount !== total) {
      throw new BadRequestException(
        'The total members must be the female plus the male members',
      );
    }
    input.memberCount = total;
    return;
  }
  const currentFemale = current.femaleMembers;
  const currentMale = current.maleMembers;
  if (
    input.memberCount !== undefined &&
    currentFemale != null &&
    currentMale != null &&
    input.memberCount !== currentFemale + currentMale
  ) {
    throw new BadRequestException(
      'This society records female and male members. Update those instead; the total is worked out from them',
    );
  }
}

/**
 * Issue #143: members under 18 are a part of the total, never added to it.
 * They can be entered only with the female/male split and never be more than
 * female + male. Changing the split must not leave them above the new total.
 * Runs after [memberSplit], which has already checked the split itself.
 */
export function checkUnder18(
  input: SocietyProfileUpdateDto,
  current: {
    femaleMembers?: number | null;
    maleMembers?: number | null;
    under18Members?: number | null;
  },
) {
  const female = input.femaleMembers ?? current.femaleMembers ?? null;
  const male = input.maleMembers ?? current.maleMembers ?? null;
  const total = female !== null && male !== null ? female + male : null;
  const sent = input.under18Members;
  if (sent !== undefined && total === null) {
    throw new BadRequestException(
      'Enter the female and male members together with the under 18s. Under 18s are a part of that total',
    );
  }
  const under18 = sent ?? current.under18Members ?? null;
  if (under18 === null || total === null || under18 <= total) return;
  throw new BadRequestException(
    sent !== undefined
      ? 'Under 18s are a part of the total members, so they cannot be more than the female plus the male members'
      : `This society records ${under18} members under 18. Female plus male members cannot be fewer than that; change the under 18s as well`,
  );
}

/**
 * Issue #143: whether a save changes a membership figure, so only those saves
 * move the membership Last updated time. Unchanged values (a retry) do not.
 */
export function changesMembership(
  input: SocietyProfileUpdateDto,
  current: {
    memberCount?: number | null;
    femaleMembers?: number | null;
    maleMembers?: number | null;
    under18Members?: number | null;
  },
) {
  return (
    ['memberCount', 'femaleMembers', 'maleMembers', 'under18Members'] as const
  ).some(
    (field) =>
      input[field] !== undefined && input[field] !== (current[field] ?? null),
  );
}

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
    femaleMembers?: number | null;
    maleMembers?: number | null;
    under18Members?: number | null;
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
  const split = (label: string, previous?: number | null, next?: number) => {
    if (next === undefined || next === (previous ?? null)) return;
    parts.push(
      previous == null
        ? `${label} entered: ${lkrOrPlain(next)}`
        : `${label} ${lkrOrPlain(previous)} → ${lkrOrPlain(next)}`,
    );
  };
  split('Female members', before.femaleMembers, input.femaleMembers);
  split('Male members', before.maleMembers, input.maleMembers);
  split('Under 18s', before.under18Members, input.under18Members);
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

  /** Map pins for HQ (national), a DM (their district) and SPC, DDM and Society Officer (their societies and any current DDM grant). */
  async map(principal: Principal) {
    const [rows, withoutLocation] = await this.repository.mapPoints(principal);
    return {
      points: rows.slice(0, MAP_POINT_LIMIT).map((row) => ({
        id: row.id,
        name: row.nameEn,
        societyCode: row.societyCode,
        grade: row.grade,
        status: row.status,
        latitude: row.latitude!,
        longitude: row.longitude!,
        district: row.district.nameEn,
      })),
      withoutLocation,
      truncated: rows.length > MAP_POINT_LIMIT,
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
        ...(() => {
          const age = member.dateOfBirth
            ? ageOn(member.dateOfBirth, new Date())
            : member.age;
          return age != null ? { age } : {};
        })(),
        ...(member.dateOfBirth
          ? { dateOfBirth: member.dateOfBirth.toISOString().slice(0, 10) }
          : {}),
        ...(member.profession ? { profession: member.profession } : {}),
        ...(member.addressLine ? { addressLine: member.addressLine } : {}),
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
      femaleMembers: record.femaleMembers ?? null,
      maleMembers: record.maleMembers ?? null,
      under18Members: record.under18Members ?? null,
      membershipUpdatedAt: record.membershipUpdatedAt?.toISOString() ?? null,
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
      excoStatus: excoStatus(record.councilMembers),
      // V5 D05 order: DM, DDM, SPC, Society Officer.
      staff: [...context.staff]
        .sort((a, b) => staffOrder(a.role) - staffOrder(b.role))
        .map((account) => ({
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
    memberSplit(input, current);
    checkUnder18(input, current);
    const membershipChanged = changesMembership(input, current);
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
      membershipChanged,
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
    assertValidCouncil(input.members);
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
