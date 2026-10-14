import { Injectable } from '@nestjs/common';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const districts = await executeDatabaseOperation(() =>
      this.prisma.district.findMany({
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
