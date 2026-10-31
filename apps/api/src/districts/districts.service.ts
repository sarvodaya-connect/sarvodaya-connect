import { Injectable } from '@nestjs/common';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Principal } from '../auth/principal.js';

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: Principal) {
    let where: object = {};
    if (principal.roles.includes('DISTRICT_MANAGER')) where = { id: { in: principal.districtIds } };
    else if (principal.roles.includes('DEPUTY_DISTRICT_MANAGER')) {
      const [delegated, assigned] = await Promise.all([
        this.prisma.districtDelegation.findMany({ where: { deputyUserId: principal.id, startsAt: { lte: new Date() }, endsAt: { gt: new Date() }, revokedAt: null }, select: { districtId: true } }),
        this.prisma.society.findMany({ where: { id: { in: principal.societyIds } }, select: { districtId: true } }),
      ]);
      where = { id: { in: [...new Set([...delegated.map((row) => row.districtId), ...assigned.map((row) => row.districtId)])] } };
    } else if (!principal.roles.includes('HQ_ADMIN')) {
      where = { societies: { some: { id: { in: principal.societyIds } } } };
    }
    const districts = await executeDatabaseOperation(() =>
      this.prisma.district.findMany({
        where,
        include: {
          _count: {
            select: { societies: true },
          },
        },
        orderBy: { nameEn: 'asc' },
      }),
    );

    return {
      data: districts.map((district) => ({
        id: district.id,
        code: district.code,
        nameEn: district.nameEn,
        societyCount: district._count.societies,
      })),
    };
  }
}
