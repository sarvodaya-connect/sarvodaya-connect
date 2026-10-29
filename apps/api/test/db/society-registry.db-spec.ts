import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const databaseUrl = process.env['DATABASE_URL'];
if (
  !databaseUrl ||
  !['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    'Society registry database tests require a local PostgreSQL DATABASE_URL',
  );
}

describe('Society profile, council and membership persistence (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const districtId = randomUUID();
  const societyId = randomUUID();
  const year = 2026;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
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
    prisma = app.get(PrismaService);
    await prisma.district.create({
      data: {
        id: districtId,
        code: `T${districtId.slice(0, 8)}`,
        nameEn: `Fictional test district ${districtId.slice(0, 8)}`,
      },
    });
    await prisma.society.create({
      data: {
        id: societyId,
        societyCode: `TEST-${societyId.slice(0, 8)}`,
        nameEn: 'Fictional Registry Test Society',
        districtId,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.society.deleteMany({ where: { id: societyId } });
      await prisma.district.deleteMany({ where: { id: districtId } });
    }
    await app?.close();
  });

  it('persists profile, council and membership updates and serves the existing society reads', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/societies/${societyId}/profile`)
      .set('X-Demo-User', 'demo-hq-admin')
      .send({
        nameEn: 'Fictional Registry Test Society Updated',
        village: 'Imaginary Test Village',
        addressLine: '1 Fictional Test Road',
        latitude: 7.3,
        longitude: 80.6,
        establishedOn: '2001-05-12',
        primaryContact: {
          fullName: 'Demo Test Contact',
          position: 'Secretary',
          phone: '+940000000000',
          email: 'test@example.invalid',
        },
      })
      .expect(200);

    const seatTypes = [
      ...Array(3).fill('CHILDREN'),
      ...Array(3).fill('YOUTH'),
      ...Array(3).fill('MOTHERS'),
      ...Array(9).fill('ORDINARY'),
      ...Array(7).fill('ELDERS_COUNCIL'),
    ];
    const members = seatTypes.map((seatType: string, index: number) => ({
      seatNumber: index + 1,
      fullName: `Fictional Council Member ${index + 1}`,
      position: index === 0 ? 'President' : 'Council Member',
      seatType,
      age: seatType === 'CHILDREN' ? 10 : seatType === 'YOUTH' ? 18 : undefined,
      isActive: true,
      isPrimaryContact: index === 0,
    }));
    await request(app.getHttpServer())
      .put(`/api/v1/societies/${societyId}/council`)
      .set('X-Demo-User', 'demo-hq-admin')
      .send({ members })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/societies/${societyId}/membership`)
      .set('X-Demo-User', 'demo-hq-admin')
      .send({
        year,
        categories: [
          { category: 'CHILDREN', female: 10, male: 9 },
          { category: 'YOUTH', female: 20, male: 18 },
          { category: 'MOTHERS', female: 30, male: 0 },
          { category: 'ORDINARY', female: 40, male: 35 },
          { category: 'ELDERS_COUNCIL', female: 5, male: 4 },
        ],
      })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/societies/${societyId}`).set('X-Demo-User', 'demo-hq-admin')
      .expect(200);
    expect(detail.body).toMatchObject({
      nameEn: 'Fictional Registry Test Society Updated',
      location: { latitude: 7.3, longitude: 80.6 },
      contacts: [
        expect.objectContaining({
          fullName: 'Demo Test Contact',
          isPrimary: true,
        }),
      ],
    });
    expect(detail.body.committee).toHaveLength(25);
    expect(detail.body.membership).toMatchObject({
      year,
      femaleTotal: 105,
      maleTotal: 66,
      overallTotal: 171,
    });

    const dashboard = await request(app.getHttpServer())
      .get(`/api/v1/societies/membership?year=${year}`).set('X-Demo-User', 'demo-hq-admin')
      .set('X-Demo-User', 'demo-hq-admin')
      .expect(200);
    expect(
      dashboard.body.societies.find(
        (row: { societyId: string }) => row.societyId === societyId,
      ),
    ).toMatchObject({ overallTotal: 171 });

    await request(app.getHttpServer())
      .get('/api/v1/societies?page=1&pageSize=10').set('X-Demo-User', 'demo-hq-admin')
      .expect(200);
  });

  it('rejects updates from users outside the society scope', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/societies/${societyId}/profile`)
      .set('X-Demo-User', 'demo-officer-sunrise')
      .send({ village: 'Must not be saved' })
      .expect(403);

    expect(
      (await prisma.society.findUniqueOrThrow({ where: { id: societyId } }))
        .village,
    ).toBe('Imaginary Test Village');
  });
});
