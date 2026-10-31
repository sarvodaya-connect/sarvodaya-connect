import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Principal } from '../auth/principal.js';
import { USER_DIRECTORY, type UserDirectory } from '../auth/user-directory.js';
import type { CreateDistrictDelegationDto } from './district-delegations.dto.js';

@Injectable()
export class DistrictDelegationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  async list(principal: Principal) {
    const where = principal.roles.includes('HQ_ADMIN') ? {} : principal.roles.includes('DISTRICT_MANAGER')
      ? { districtId: { in: principal.districtIds } }
      : { deputyUserId: principal.id };
    const rows = await this.prisma.districtDelegation.findMany({
      where,
      include: { district: { select: { id: true, code: true, nameEn: true } } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    });
    const now = new Date();
    return { data: rows.map((row) => ({
      id: row.id,
      district: row.district,
      deputyUserId: row.deputyUserId,
      grantedById: row.grantedById,
      grantedByName: row.grantedByName,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      active: row.revokedAt === null && row.startsAt <= now && row.endsAt > now,
    })) };
  }

  async create(input: CreateDistrictDelegationDto, principal: Principal) {
    if (!principal.roles.includes('DISTRICT_MANAGER')) throw new ForbiddenException('Only a District Manager can grant temporary DDM visibility');
    if (!principal.districtIds.includes(input.districtId)) throw new ForbiddenException('Delegation must be within your assigned district');
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    const now = new Date();
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt || endsAt <= now) {
      throw new BadRequestException('Choose a valid future access window');
    }
    const deputyIds = await this.users.findDeputyManagerIds(input.districtId);
    if (!deputyIds.includes(input.deputyUserId)) throw new ForbiddenException('That DDM is not assigned to your district');
    const active = await this.prisma.districtDelegation.findFirst({
      where: { deputyUserId: input.deputyUserId, districtId: input.districtId, revokedAt: null, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (active) throw new ConflictException('This DDM already has an overlapping district delegation');
    const record = await this.prisma.districtDelegation.create({ data: {
      districtId: input.districtId,
      deputyUserId: input.deputyUserId,
      grantedById: principal.id,
      grantedByName: principal.displayName,
      startsAt,
      endsAt,
    }, include: { district: { select: { id: true, code: true, nameEn: true } } } });
    return { ...record, startsAt: record.startsAt.toISOString(), endsAt: record.endsAt.toISOString(), active: record.startsAt <= now && record.endsAt > now };
  }

  async revoke(id: string, principal: Principal) {
    const record = await this.prisma.districtDelegation.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Delegation not found');
    if (!principal.roles.includes('DISTRICT_MANAGER') || !principal.districtIds.includes(record.districtId) || principal.id !== record.grantedById) {
      throw new ForbiddenException('Only the District Manager who granted this access can revoke it');
    }
    if (record.revokedAt) throw new ConflictException('This delegation was already revoked');
    const revokedAt = new Date();
    await this.prisma.districtDelegation.update({ where: { id }, data: { revokedAt, revokedById: principal.id } });
    return { id, revokedAt: revokedAt.toISOString(), active: false };
  }
}
