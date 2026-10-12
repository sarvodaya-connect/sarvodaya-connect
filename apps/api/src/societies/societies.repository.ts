import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocietyQueryDto } from './dto/society-query.dto.js';

const include = { district: true, contacts: true } as const;
@Injectable()
export class SocietiesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: SocietyQueryDto) {
    const where: Prisma.SocietyWhereInput = {
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search?.trim() ? { OR: [
        { nameEn: { contains: query.search.trim(), mode: 'insensitive' } },
        { nameLocal: { contains: query.search.trim(), mode: 'insensitive' } },
        { societyCode: { contains: query.search.trim(), mode: 'insensitive' } },
      ] } : {}),
    };
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.society.findMany({ where, include, orderBy: [{ nameEn: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.society.count({ where }),
    ]);
    return { records, totalItems };
  }
  findById(id: string) { return this.prisma.society.findUnique({ where: { id }, include }); }
}
export type SocietyRecord = NonNullable<Awaited<ReturnType<SocietiesRepository['findById']>>>;
