import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { hasRole, type Principal } from '../auth/principal.js';
import { NicVaultService } from '../identity/nic-vault.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AssignStaffDto,
  CreateSocietyDto,
} from './dto/society-admin.dto.js';
import { assertValidCouncil } from './societies.service.js';
import { canViewSociety } from './society-access.policy.js';

const STAFF_ROLES = [
  'DISTRICT_MANAGER',
  'DEPUTY_DISTRICT_MANAGER',
  'PROGRAMME_COORDINATOR',
  'SOCIETY_OFFICER',
] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const accountFields = {
  id: true,
  displayName: true,
  username: true,
  role: true,
  status: true,
  districtId: true,
  societyIds: true,
} as const;

/** The office bearers V5 D05c asks for before a new society can be saved. */
const OFFICE_BEARERS = ['President', 'Secretary', 'Treasurer'] as const;

function assertHq(principal: Principal) {
  if (!hasRole(principal, 'HQ_ADMIN'))
    throw new ForbiddenException('Only HQ can do this');
}

/**
 * V5 D05a "Assign responsible staff" and D05n/D05c "Create a society
 * record". Both are HQ only. The society record itself lists the staff.
 */
@Injectable()
export class SocietyAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nicVault: NicVaultService,
  ) {}

  private async visibleSociety(id: string, principal: Principal) {
    const society = await this.prisma.society.findUnique({
      where: { id },
      select: { id: true, nameEn: true, societyCode: true, districtId: true },
    });
    // 404 rather than 403, so a society outside the scope is not revealed.
    if (!society || !canViewSociety(principal, society))
      throw new NotFoundException('Society not found');
    return society;
  }

  /** D05a choices: active accounts of each role in the society's district. */
  async staffOptions(id: string, principal: Principal) {
    assertHq(principal);
    const society = await this.visibleSociety(id, principal);
    const rows = await this.prisma.platformAccount.findMany({
      where: {
        districtId: society.districtId,
        status: 'ACTIVE',
        role: { in: [...STAFF_ROLES] },
      },
      select: accountFields,
      orderBy: { displayName: 'asc' },
    });
    const of = (role: StaffRole) =>
      rows
        .filter((row) => row.role === role)
        .map((row) => ({
          id: row.id,
          displayName: row.displayName,
          username: row.username,
          assignedHere: row.societyIds.includes(society.id),
          // A Society Officer looks after one society; choosing them moves them here.
          otherSocieties: row.societyIds.filter((other) => other !== society.id)
            .length,
        }));
    return {
      districtManagers: of('DISTRICT_MANAGER'),
      deputies: of('DEPUTY_DISTRICT_MANAGER'),
      coordinators: of('PROGRAMME_COORDINATOR'),
      officers: of('SOCIETY_OFFICER'),
    };
  }

  /**
   * D05a: one DDM, one SPC and one Society Officer per society. Choosing
   * someone replaces whoever held that role here; a Society Officer moves from
   * their old society. Everyone whose access changes is signed out, so their
   * next request uses the new scope.
   */
  async assign(id: string, input: AssignStaffDto, principal: Principal) {
    assertHq(principal);
    const society = await this.visibleSociety(id, principal);
    const wanted: [StaffRole, string | null][] = [
      ['DEPUTY_DISTRICT_MANAGER', input.deputyId],
      ['PROGRAMME_COORDINATOR', input.coordinatorId],
      ['SOCIETY_OFFICER', input.officerId],
    ];
    const chosenIds = wanted.flatMap(([, accountId]) =>
      accountId ? [accountId] : [],
    );
    const chosen = await this.prisma.platformAccount.findMany({
      where: { id: { in: chosenIds } },
      select: accountFields,
    });
    for (const [role, accountId] of wanted) {
      if (!accountId) continue;
      const account = chosen.find((row) => row.id === accountId);
      if (!account || account.role !== role)
        throw new BadRequestException('Choose an account with the right role');
      if (account.status !== 'ACTIVE')
        throw new BadRequestException(
          `${account.displayName}'s account is not active`,
        );
      if (account.districtId !== society.districtId)
        throw new BadRequestException(
          `${account.displayName} works in a different district`,
        );
    }
    const changed: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const [role, accountId] of wanted) {
        const holders = await tx.platformAccount.findMany({
          where: { role, societyIds: { has: society.id } },
          select: accountFields,
        });
        for (const holder of holders) {
          if (holder.id === accountId) continue;
          await tx.platformAccount.update({
            where: { id: holder.id },
            data: {
              societyIds: holder.societyIds.filter(
                (other) => other !== society.id,
              ),
            },
          });
          changed.push(holder.id);
        }
        const account = chosen.find((row) => row.id === accountId);
        if (account && !account.societyIds.includes(society.id)) {
          await tx.platformAccount.update({
            where: { id: account.id },
            data: {
              societyIds:
                role === 'SOCIETY_OFFICER'
                  ? [society.id]
                  : [...account.societyIds, society.id],
            },
          });
          changed.push(account.id);
        }
      }
      if (changed.length) {
        await tx.accountSession.deleteMany({
          where: { accountId: { in: changed } },
        });
        await tx.platformAuditEvent.create({
          data: {
            actorId: principal.id,
            actorName: principal.displayName,
            actorRole: principal.roles[0] ?? null,
            action: 'SOCIETY_STAFF_ASSIGNED',
            targetId: society.id,
            societyId: society.id,
            districtId: society.districtId,
            detail: `Responsible staff changed for ${society.nameEn}; ${changed.length} account(s) signed out`,
          },
        });
      }
    });
    return { changedAccounts: changed.length };
  }

  /** D05n / D05c: HQ creates a society with its details, starting grade and all 25 Exco members. */
  async create(input: CreateSocietyDto, principal: Principal) {
    assertHq(principal);
    const code = input.societyCode.trim().toUpperCase();
    const existing = await this.prisma.society.findUnique({
      where: { societyCode: code },
      select: { nameEn: true },
    });
    if (existing)
      throw new ConflictException(
        `${code} is already used by ${existing.nameEn}. Check the number on the registration.`,
      );
    if (
      !(await this.prisma.district.findUnique({
        where: { id: input.districtId },
      }))
    )
      throw new BadRequestException('Select a valid district');
    assertValidCouncil(input.council);
    // V5 D05c / M07e: a new society's 25 seats are complete records.
    for (const member of input.council) {
      const missing = [
        !member.nic && 'NIC',
        !member.dateOfBirth && 'date of birth',
        !member.addressLine && 'address',
        !member.profession && 'profession',
        !member.phone && 'phone number',
      ].filter(Boolean);
      if (missing.length)
        throw new BadRequestException(
          `Exco member ${member.seatNumber}: enter the ${missing.join(', ')}`,
        );
    }
    for (const office of OFFICE_BEARERS) {
      if (
        !input.council.some(
          (member) =>
            member.position.trim().toLowerCase() === office.toLowerCase(),
        )
      )
        throw new BadRequestException(
          `Choose the ${office} from the 25 Exco members`,
        );
    }
    const now = new Date();
    const society = await this.prisma.$transaction(async (tx) => {
      const created = await tx.society.create({
        data: {
          societyCode: code,
          nameEn: input.nameEn,
          nameLocal: input.nameLocal,
          districtId: input.districtId,
          dsDivision: input.dsDivision,
          gnDivision: input.gnDivision,
          addressLine: input.addressLine,
          memberCount: input.memberCount,
          landline: input.landline || null,
          businessDescription: input.businessDescription || null,
          latitude: input.latitude,
          longitude: input.longitude,
          status: 'ACTIVE',
          grade: input.grade,
          gradeChangedAt: now,
          gradeChangedByName: principal.displayName,
          gradeChangedByRole: principal.roles[0] ?? null,
        },
      });
      await tx.societyCouncilMember.createMany({
        data: input.council.map((member) => ({
          societyId: created.id,
          seatNumber: member.seatNumber,
          fullName: member.fullName,
          position: member.position,
          seatType: member.seatType,
          phone: member.phone,
          email: member.email,
          age: member.age,
          profession: member.profession,
          addressLine: member.addressLine,
          ...(member.dateOfBirth
            ? { dateOfBirth: new Date(`${member.dateOfBirth}T00:00:00.000Z`) }
            : {}),
          isActive: true,
          isPrimaryContact: member.isPrimaryContact,
        })),
      });
      await tx.platformAuditEvent.create({
        data: {
          actorId: principal.id,
          actorName: principal.displayName,
          actorRole: principal.roles[0] ?? null,
          action: 'SOCIETY_CREATED',
          targetId: created.id,
          societyId: created.id,
          districtId: created.districtId,
          detail: `Society ${code} created with grade ${input.grade} and 25 Exco members`,
        },
      });
      return created;
    });
    // NICs are encrypted by the NIC vault; they never go into the audit log.
    const withNic = input.council.filter((member) => member.nic);
    if (withNic.length) {
      const members = await this.prisma.societyCouncilMember.findMany({
        where: { societyId: society.id },
        select: { id: true, seatNumber: true },
      });
      for (const member of withNic) {
        const row = members.find(
          (item) => item.seatNumber === member.seatNumber,
        )!;
        await this.nicVault.set(society.id, row.id, member.nic!, principal);
      }
    }
    return { id: society.id, societyCode: society.societyCode };
  }
}
