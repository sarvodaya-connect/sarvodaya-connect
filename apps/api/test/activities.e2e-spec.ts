import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ActivitiesRepository } from '../src/activities/activities.repository.js';
import { AppModule } from '../src/app.module.js';
import { ApiExceptionFilter } from '../src/common/api-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const societyId = '29000000-0000-4000-8000-000000000101';
describe('Activity endpoints', () => {
  let app: INestApplication;
  const repository = {
    canAccessSociety: vi.fn().mockResolvedValue({ id: societyId }),
    create: vi.fn(),
    list: vi.fn(),
    find: vi.fn(),
    summary: vi.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ActivitiesRepository)
      .useValue(repository)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });
  afterAll(async () => app.close());
  it('creates a scoped activity draft', async () => {
    repository.create.mockResolvedValue({
      id: '39000000-0000-4000-8000-000000000001',
      societyId,
      society: {
        nameEn: 'Sunrise Society',
        districtId: '29000000-0000-4000-8000-000000000001',
        district: { nameEn: 'North District' },
      },
      title: 'Test activity',
      description: 'Fictional activity',
      activityDate: new Date('2026-10-20T00:00:00.000Z'),
      location: 'Example Hall',
      latitude: null,
      longitude: null,
      classification: { sector: 'Community', dimension: 'SOCIAL' },
      sdgs: [3],
      femaleParticipants: 2,
      maleParticipants: 1,
      otherParticipants: 0,
      outcomes: null,
      status: 'DRAFT',
      submittedById: 'demo-officer-sunrise',
      submittedAt: null,
      approvedAt: null,
      createdAt: new Date('2026-10-20T00:00:00.000Z'),
      updatedAt: new Date('2026-10-20T00:00:00.000Z'),
    });
    await request(app.getHttpServer())
      .post('/api/v1/activities')
      .set('X-Demo-User', 'demo-officer-sunrise')
      .send({
        societyId,
        title: 'Test activity',
        description: 'Fictional activity',
        activityDate: '2026-10-20',
        location: 'Example Hall',
        sector: 'Community',
        dimension: 'SOCIAL',
        sdgs: [3],
        femaleParticipants: 2,
        maleParticipants: 1,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.id).toBe('39000000-0000-4000-8000-000000000001');
        expect(body.participants.total).toBe(3);
        expect(body.status).toBe('DRAFT');
      });
  });
  it('rejects an invalid participant count', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/activities')
      .set('X-Demo-User', 'demo-officer-sunrise')
      .send({
        societyId,
        title: 'Test',
        description: 'Test',
        activityDate: '2026-10-20',
        location: 'Hall',
        sector: 'Community',
        dimension: 'SOCIAL',
        femaleParticipants: -1,
        maleParticipants: 1,
      })
      .expect(400);
  });
  it('rejects unapproved fields rather than accepting unsafe query combinations', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/activities?rawSql=select')
      .set('X-Demo-User', 'demo-hq-admin')
      .expect(400);
  });
});
