import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { ActivitiesRepository } from '../../src/activities/activities.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { findDemoPrincipal } from '../../src/auth/demo-principals.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl)
  throw new Error('DATABASE_URL is required for database tests');
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname))
  throw new Error('Database tests only run against a local PostgreSQL');

describe('Activity persistence and reporting (PostgreSQL)', () => {
  let prisma: PrismaService;
  let repository: ActivitiesRepository;
  let app: TestingModule;
  const ids: string[] = [];
  const classificationIds: string[] = [];
  const principal = findDemoPrincipal('demo-hq-admin')!;
  const districtId = randomUUID();
  const societyId = randomUUID();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module;
    prisma = module.get(PrismaService);
    repository = module.get(ActivitiesRepository);
    await prisma.district.create({
      data: {
        id: districtId,
        code: `T${districtId.slice(0, 8)}`,
        nameEn: `Fictional activity test district ${districtId.slice(0, 8)}`,
      },
    });
    await prisma.society.create({
      data: {
        id: societyId,
        societyCode: `TEST-${societyId.slice(0, 8)}`,
        nameEn: 'Fictional Activity Test Society',
        districtId,
      },
    });
  });
  afterAll(async () => {
    if (ids.length)
      await prisma.activityReport.deleteMany({ where: { id: { in: ids } } });
    if (classificationIds.length)
      await prisma.activityClassification.deleteMany({
        where: { id: { in: classificationIds } },
      });
    await prisma.society.deleteMany({ where: { id: societyId } });
    await prisma.district.deleteMany({ where: { id: districtId } });
    await app.close();
  });
  it('persists and filters fictional activities with stable participant totals', async () => {
    const id = randomUUID();
    ids.push(id);
    const classification = await prisma.activityClassification.create({
      data: {
        sector: `Test-${id.slice(0, 8)}`,
        dimension: 'SOCIAL',
      },
    });
    classificationIds.push(classification.id);
    await prisma.activityReport.create({
      data: {
        id,
        societyId,
        classificationId: classification.id,
        sdgs: [3, 5],
        title: 'Fictional activity',
        description: 'Database verification record',
        activityDate: new Date('2026-10-20'),
        location: 'Example Hall',
        femaleParticipants: 4,
        maleParticipants: 3,
        otherParticipants: 1,
        status: 'APPROVED',
        submittedById: principal.id,
        approvedAt: new Date('2026-10-21'),
      },
    });
    const result = await repository.list(
      {
        page: 1,
        pageSize: 10,
        societyId,
        sector: classification.sector,
      },
      principal,
    );
    expect(result.data.map((record) => record.id)).toContain(id);
    expect(
      result.data.find((record) => record.id === id)!.femaleParticipants +
        result.data.find((record) => record.id === id)!.maleParticipants +
        result.data.find((record) => record.id === id)!.otherParticipants,
    ).toBe(8);
    const summary = await repository.summary(
      { page: 1, pageSize: 10, sector: classification.sector },
      principal,
    );
    expect(summary).toEqual({
      activityCount: 1,
      participantCount: 8,
      bySector: [
        { sector: classification.sector, activities: 1, participants: 8 },
      ],
    });
  });
});
