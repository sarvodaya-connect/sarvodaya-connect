import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from './../src/app.module.js';
import { ApiExceptionFilter } from './../src/common/api-exception.filter.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { SocietiesRepository } from './../src/societies/societies.repository.js';

const SOCIETY_ID = '00000000-0000-4000-8000-000000000001';
const DISTRICT_ID = '00000000-0000-4000-8000-000000000002';
const MISSING_ID = '00000000-0000-4000-8000-000000000099';

const listRecord = {
  id: SOCIETY_ID,
  societyCode: 'SOC001',
  nameEn: 'Test Society',
  nameLocal: null,
  district: { id: DISTRICT_ID, code: 'COL', nameEn: 'Colombo' },
  status: 'ACTIVE',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const detailRecord = {
  ...listRecord,
  establishedOn: new Date('2010-05-20T00:00:00.000Z'),
  addressLine: '12 Test Road',
  village: 'Test Village',
  gnDivision: 'Test GN',
  dsDivision: 'Test DS',
  latitude: 6.9271,
  longitude: 79.8612,
  contacts: [
    {
      id: 'contact-1',
      label: 'Secretary',
      phone: '0110000000',
      email: 'secretary@example.test',
      isPrimary: true,
    },
  ],
  councilMembers: [],
  memberships: [],
  createdAt: new Date('2025-12-01T00:00:00.000Z'),
};

describe('Societies endpoints (e2e)', () => {
  let app: INestApplication;

  const repository = {
    list: vi.fn(),
    findById: vi.fn(),
    findRecordContext: vi.fn().mockResolvedValue({
      summary: null,
      auditReport: null,
      staff: [],
      lastChange: null,
    }),
    updateProfile: vi.fn(),
    replaceCouncil: vi.fn(),
    replaceMembership: vi.fn(),
    membershipForPrincipal: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(SocietiesRepository)
      .useValue(repository)
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror the real bootstrap in src/main.ts
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/societies', () => {
    it('returns 200 with data and pagination meta using default paging', async () => {
      repository.list.mockResolvedValue({
        records: [listRecord],
        totalItems: 1,
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/societies')
        .set('X-Demo-User', 'demo-hq-admin')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: SOCIETY_ID,
        societyCode: 'SOC001',
        nameEn: 'Test Society',
        status: 'ACTIVE',
        verificationStatus: 'UNVERIFIED',
      });
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 10 }),
        expect.objectContaining({ id: 'demo-hq-admin' }),
      );
    });

    it('passes valid filters through to the repository', async () => {
      repository.list.mockResolvedValue({ records: [], totalItems: 0 });

      await request(app.getHttpServer())
        .get('/api/v1/societies')
        .set('X-Demo-User', 'demo-hq-admin')
        .query({
          page: 2,
          pageSize: 5,
          search: 'test',
          districtId: DISTRICT_ID,
          status: 'ACTIVE',
        })
        .expect(200);

      expect(repository.list).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 5,
          search: 'test',
          districtId: DISTRICT_ID,
          status: 'ACTIVE',
        }),
        expect.objectContaining({ id: 'demo-hq-admin' }),
      );
    });

    it('returns 200 with an empty page when nothing matches', async () => {
      repository.list.mockResolvedValue({ records: [], totalItems: 0 });

      const response = await request(app.getHttpServer())
        .get('/api/v1/societies?search=nothing-matches')
        .set('X-Demo-User', 'demo-hq-admin')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.totalItems).toBe(0);
      expect(response.body.meta.totalPages).toBe(0);
    });

    it('returns an empty page for a verification status that cannot match yet', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/societies?verificationStatus=VERIFIED')
        .set('X-Demo-User', 'demo-hq-admin')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(repository.list).not.toHaveBeenCalled();
    });

    it.each([
      ['page=0'],
      ['page=abc'],
      ['pageSize=0'],
      ['pageSize=101'],
      ['status=BOGUS'],
      ['verificationStatus=BOGUS'],
      ['districtId=not-a-uuid'],
      [`search=${'a'.repeat(151)}`],
      ['unknownParam=1'],
    ])('returns 400 VALIDATION_ERROR for invalid query: %s', async (query) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/societies?${query}`)
        .set('X-Demo-User', 'demo-hq-admin')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.requestId).toEqual(expect.any(String));
      expect(repository.list).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/societies/:id', () => {
    it('returns 200 with the society detail', async () => {
      repository.findById.mockResolvedValue(detailRecord);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/societies/${SOCIETY_ID}`)
        .set('X-Demo-User', 'demo-hq-admin')
        .expect(200);

      expect(repository.findById).toHaveBeenCalledWith(SOCIETY_ID);
      expect(response.body).toMatchObject({
        id: SOCIETY_ID,
        nameEn: 'Test Society',
        establishedOn: '2010-05-20',
        address: { village: 'Test Village' },
        location: { latitude: 6.9271, longitude: 79.8612 },
        contacts: [{ id: 'contact-1', isPrimary: true }],
        committee: [],
        documents: [],
        history: [],
      });
    });

    it('returns 404 NOT_FOUND when the society does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/societies/${MISSING_ID}`)
        .set('X-Demo-User', 'demo-hq-admin')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Society not found');
      expect(response.body.error.requestId).toEqual(expect.any(String));
    });

    it('returns 400 VALIDATION_ERROR when the id is not a UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/societies/not-a-uuid')
        .set('X-Demo-User', 'demo-hq-admin')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(repository.findById).not.toHaveBeenCalled();
    });
  });

  describe('profile update authorization and validation', () => {
    it('rejects an update from an officer assigned to another society', async () => {
      repository.findById.mockResolvedValue(detailRecord);

      await request(app.getHttpServer())
        .patch(`/api/v1/societies/${SOCIETY_ID}/profile`)
        .set('X-Demo-User', 'demo-officer-lotus')
        .send({ village: 'Updated fictional village' })
        .expect(403);

      expect(repository.updateProfile).not.toHaveBeenCalled();
    });

    it('validates GPS coordinate bounds before writing', async () => {
      repository.findById.mockResolvedValue(detailRecord);

      await request(app.getHttpServer())
        .patch(`/api/v1/societies/${SOCIETY_ID}/profile`)
        .set('X-Demo-User', 'demo-hq-admin')
        .send({ latitude: 100, longitude: 80 })
        .expect(400);

      expect(repository.updateProfile).not.toHaveBeenCalled();
    });

    it('accepts valid latitude and longitude and returns the updated profile', async () => {
      repository.findById.mockResolvedValue(detailRecord);
      repository.updateProfile.mockResolvedValue(detailRecord);

      await request(app.getHttpServer())
        .patch(`/api/v1/societies/${SOCIETY_ID}/profile`)
        .set('X-Demo-User', 'demo-hq-admin')
        .send({ latitude: 7.3, longitude: 80.6 })
        .expect(200);

      expect(repository.updateProfile).toHaveBeenCalledWith(
        SOCIETY_ID,
        {
          latitude: 7.3,
          longitude: 80.6,
        },
        expect.objectContaining({ id: 'demo-hq-admin' }),
        { summary: 'Map location changed' },
      );
    });

    it('requires latitude and longitude together', async () => {
      repository.findById.mockResolvedValue({
        ...detailRecord,
        latitude: null,
        longitude: null,
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/societies/${SOCIETY_ID}/profile`)
        .set('X-Demo-User', 'demo-hq-admin')
        .send({ latitude: 7.3 })
        .expect(400);

      expect(repository.updateProfile).not.toHaveBeenCalled();
    });
  });
});
