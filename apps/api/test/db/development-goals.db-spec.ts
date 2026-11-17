/**
 * Issue #169 database tests: the SPC's Development Goals (Sarvodaya dimensions,
 * categories and UN SDGs) recorded with the approval, through the HTTP API and
 * the repository against a real PostgreSQL with the migrations applied. Every
 * record here is fictional and removed afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActivitiesRepository } from '../../src/activities/activities.repository.js';
import { plannableYears } from '../../src/activities/activities.service.js';
import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

describe('Issue #169 Development Goals (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let hqToken: string;
  const suffix = randomUUID().slice(0, 8);
  const districtId = randomUUID();
  const societyId = randomUUID();
  const otherSocietyId = randomUUID();
  const hqId = randomUUID();
  const accounts: string[] = [hqId];
  const tokens: Record<string, { id: string; token: string }> = {};
  // A month that has ended, in a financial year the programmes report covers.
  const year = plannableYears().first;
  const financialYear = year;

  const http = () => request(app.getHttpServer());
  const api = (token: string) => ({
    get: (path: string) =>
      http().get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) =>
      http()
        .post(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
  });

  const goals = {
    sdgs: [5, 4],
    dimensions: ['GOVERNANCE', 'SOCIAL'],
    categories: ['ENVIRONMENT', 'COMMUNITY_EDUCATION', 'CULTURE'],
  };

  async function account(label: string, role: string, societyIds: string[]) {
    const username = `i169.${label}.${suffix}`;
    const created = await api(hqToken)
      .post('/identity/accounts', {
        username,
        displayName: `Fictional ${label}`,
        phone: '+94000000001',
        role,
        districtId,
        societyIds,
        password: 'test-password-123',
      })
      .expect(201);
    accounts.push(created.body.account.id);
    const login = await http()
      .post('/api/v1/identity/login')
      .send({ username, password: 'test-password-123' })
      .expect(201);
    return {
      id: created.body.account.id as string,
      token: login.body.token as string,
    };
  }

  /** A waiting activity, sent by the Society Officer. */
  async function waiting(name: string, month = 6) {
    const created = await api(tokens.so!.token)
      .post(`/societies/${societyId}/activities`, {
        year,
        month,
        name,
        description: 'A fictional activity for the Development Goals tests.',
        // The Society Officer's planning fields: never the SPC's classification.
        sector: 'Economy',
        dimension: 'ECONOMIC',
        allocatedCost: 1000,
        femaleParticipants: 5,
        maleParticipants: 5,
      })
      .expect(201);
    return created.body.id as string;
  }

  /** Nothing of a decision was written: still waiting, no goals, no audit. */
  async function expectUntouched(id: string) {
    const row = await db.workPlanActivity.findUniqueOrThrow({
      where: { id },
      include: { sdgs: true, goalDimensions: true, goalCategories: true },
    });
    expect(row).toMatchObject({
      status: 'WAITING_FOR_SPC',
      classifiedAt: null,
      reviewedAt: null,
      reviewedById: null,
    });
    expect(row.sdgs).toEqual([]);
    expect(row.goalDimensions).toEqual([]);
    expect(row.goalCategories).toEqual([]);
    expect(
      await db.platformAuditEvent.count({
        where: { targetId: id, detail: { contains: 'approved' } },
      }),
    ).toBe(0);
  }

  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY ??= '11'.repeat(32);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
    db = app.get(PrismaService);
    await db.district.create({
      data: { id: districtId, code: `G${suffix}`, nameEn: `I169 ${suffix}` },
    });
    await db.society.createMany({
      data: [
        {
          id: societyId,
          societyCode: `S-G${suffix.toUpperCase()}`,
          nameEn: 'Fictional Goals Society',
          districtId,
          status: 'ACTIVE',
        },
        {
          id: otherSocietyId,
          societyCode: `S-H${suffix.toUpperCase()}`,
          nameEn: 'Fictional Other Goals Society',
          districtId,
          status: 'ACTIVE',
        },
      ],
    });
    await db.platformAccount.create({
      data: {
        id: hqId,
        username: `i169.hq.${suffix}`,
        displayName: 'Fictional HQ',
        role: 'HQ_ADMIN',
        phone: '+94000000000',
        status: 'ACTIVE',
        passwordHash: passwordHash('test-password-123'),
      },
    });
    hqToken = (
      await http()
        .post('/api/v1/identity/login')
        .send({ username: `i169.hq.${suffix}`, password: 'test-password-123' })
        .expect(201)
    ).body.token;
    tokens.so = await account('so', 'SOCIETY_OFFICER', [societyId]);
    tokens.spc = await account('spc', 'PROGRAMME_COORDINATOR', [societyId]);
    tokens.otherSpc = await account('other-spc', 'PROGRAMME_COORDINATOR', [
      otherSocietyId,
    ]);
    tokens.ddm = await account('ddm', 'DEPUTY_DISTRICT_MANAGER', [societyId]);
    tokens.dm = await account('dm', 'DISTRICT_MANAGER', []);
  });

  afterAll(async () => {
    if (db) {
      await db.notification.deleteMany({
        where: { recipientUserId: { in: accounts } },
      });
      await db.platformAuditEvent.deleteMany({
        where: { OR: [{ actorId: { in: accounts } }, { districtId }] },
      });
      await db.platformAccount.deleteMany({ where: { id: { in: accounts } } });
      // Activities and their goals go with the societies (ON DELETE CASCADE).
      await db.society.deleteMany({
        where: { id: { in: [societyId, otherSocietyId] } },
      });
      await db.district.deleteMany({ where: { id: districtId } });
    }
    await app?.close();
  });

  it('lets the assigned SPC approve with several dimensions, categories and UN SDGs, and every read returns them', async () => {
    const id = await waiting('Fictional tree planting');
    const approved = await api(tokens.spc!.token)
      .post(`/activities/${id}/approve`, goals)
      .expect(200);
    const classification = {
      state: 'CLASSIFIED',
      dimensions: ['SOCIAL', 'GOVERNANCE'],
      categories: ['COMMUNITY_EDUCATION', 'CULTURE', 'ENVIRONMENT'],
      sdgs: [4, 5],
      classifiedBy: { displayName: 'Fictional spc' },
    };
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      sdgs: [4, 5],
      // The Society Officer's fields stay as entered, apart from the SPC's.
      sector: 'Economy',
      dimension: 'ECONOMIC',
      classification,
    });
    const classifiedAt = approved.body.classification.classifiedAt as string;
    expect(classifiedAt).toBe(approved.body.review.at);

    // The same values on every later read, for the SPC and read-only roles.
    for (const who of ['spc', 'dm', 'ddm', 'so'] as const) {
      const detail = await api(tokens[who]!.token)
        .get(`/activities/${id}`)
        .expect(200);
      expect(detail.body.classification).toMatchObject({
        ...classification,
        classifiedAt,
      });
      expect(detail.body.permissions).toMatchObject({ canReview: false });
    }
    const plan = await api(tokens.dm!.token)
      .get(`/societies/${societyId}/work-plan?year=${year}`)
      .expect(200);
    expect(
      plan.body.activities.find((a: { id: string }) => a.id === id)
        .classification,
    ).toMatchObject(classification);
    const queue = await api(tokens.spc!.token)
      .get('/activity-reviews')
      .expect(200);
    expect(
      queue.body.approvedRecently.find((a: { id: string }) => a.id === id)
        .classification,
    ).toMatchObject(classification);

    // Stored once each, with the decision and an audit entry.
    const row = await db.workPlanActivity.findUniqueOrThrow({
      where: { id },
      include: { goalDimensions: true, goalCategories: true, sdgs: true },
    });
    expect(row.classifiedAt?.toISOString()).toBe(classifiedAt);
    expect(row.reviewedAt?.toISOString()).toBe(classifiedAt);
    expect(row.reviewedById).toBe(tokens.spc!.id);
    expect(row.goalDimensions).toHaveLength(2);
    expect(row.goalCategories).toHaveLength(3);
    expect(row.sdgs).toHaveLength(2);
    const audit = await db.platformAuditEvent.findFirstOrThrow({
      where: { targetId: id, detail: { contains: 'approved' } },
    });
    expect(audit.detail).toContain('categories COMMUNITY_EDUCATION');

    // A second decision is refused and changes nothing.
    await api(tokens.spc!.token)
      .post(`/activities/${id}/approve`, {
        sdgs: [1],
        dimensions: ['ECONOMIC'],
        categories: ['HEALTH_NUTRITION'],
      })
      .expect(409);
    const again = await api(tokens.spc!.token)
      .get(`/activities/${id}`)
      .expect(200);
    expect(again.body.classification).toMatchObject(classification);
  });

  it.each([
    ['an empty dimension list', { ...goals, dimensions: [] }],
    ['an empty category list', { ...goals, categories: [] }],
    ['dimensions without categories', { sdgs: [4], dimensions: ['SOCIAL'] }],
    ['categories without dimensions', { sdgs: [4], categories: ['CULTURE'] }],
    ['a duplicate dimension', { ...goals, dimensions: ['SOCIAL', 'SOCIAL'] }],
    ['a duplicate category', { ...goals, categories: ['CULTURE', 'CULTURE'] }],
    ['an unknown dimension', { ...goals, dimensions: ['SPIRITUAL'] }],
    [
      'a category title instead of its code',
      { ...goals, categories: ['Culture'] },
    ],
    ['no UN SDG', { ...goals, sdgs: [] }],
    ['an unknown field', { ...goals, sector: 'Culture' }],
  ])('refuses %s with 400 and writes nothing', async (_label, body) => {
    const id = await waiting(`Fictional refused ${randomUUID().slice(0, 6)}`);
    const refused = await api(tokens.spc!.token)
      .post(`/activities/${id}/approve`, body)
      .expect(400);
    expect(refused.body.error?.code ?? refused.body.code).toBeDefined();
    await expectUntouched(id);
  });

  it('refuses people who may not decide, and other societies, writing nothing', async () => {
    const id = await waiting('Fictional out of scope');
    for (const who of ['so', 'ddm', 'dm'] as const)
      await api(tokens[who]!.token)
        .post(`/activities/${id}/approve`, goals)
        .expect(403);
    await api(hqToken).post(`/activities/${id}/approve`, goals).expect(403);
    // An SPC assigned elsewhere cannot even see it.
    await api(tokens.otherSpc!.token)
      .post(`/activities/${id}/approve`, goals)
      .expect(404);
    await expectUntouched(id);
  });

  it('records an older app’s approval (UN SDGs only) as NOT_CLASSIFIED, without inventing goals', async () => {
    const id = await waiting('Fictional older app approval');
    const approved = await api(tokens.spc!.token)
      .post(`/activities/${id}/approve`, { sdgs: [8] })
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      sdgs: [8],
      sector: 'Economy',
      dimension: 'ECONOMIC',
      classification: {
        state: 'NOT_CLASSIFIED',
        dimensions: [],
        categories: [],
        sdgs: [8],
      },
    });
    expect(approved.body.classification.classifiedAt).toBeUndefined();
    const row = await db.workPlanActivity.findUniqueOrThrow({
      where: { id },
      include: { goalDimensions: true, goalCategories: true },
    });
    expect(row.classifiedAt).toBeNull();
    expect(row.goalDimensions).toEqual([]);
    expect(row.goalCategories).toEqual([]);
  });

  it('keeps older approved activities readable and marked as not classified', async () => {
    // As the V5 migration left them: approved before review, and approved by
    // an SPC with UN SDGs only. Their sector and dimension stay as entered.
    const beforeReview = randomUUID();
    const v5Approved = randomUUID();
    await db.workPlanActivity.createMany({
      data: [
        {
          id: beforeReview,
          societyId,
          year,
          month: 5,
          name: 'Fictional activity planned before review',
          description: 'Planned before SPC review existed.',
          sector: 'Agriculture',
          dimension: 'ECONOMIC',
          allocatedCost: 0,
          status: 'APPROVED',
        },
        {
          id: v5Approved,
          societyId,
          year,
          month: 5,
          name: 'Fictional activity approved in V5',
          description: 'Approved by an SPC with UN SDGs only.',
          sector: 'Culture',
          dimension: 'SOCIAL',
          allocatedCost: 0,
          status: 'APPROVED',
          reviewedById: tokens.spc!.id,
          reviewedByName: 'Fictional spc',
          reviewedAt: new Date(),
        },
      ],
    });
    await db.workPlanActivitySdg.create({
      data: { activityId: v5Approved, sdg: 11 },
    });
    const old = await api(tokens.dm!.token)
      .get(`/activities/${beforeReview}`)
      .expect(200);
    expect(old.body).toMatchObject({
      status: 'APPROVED',
      sector: 'Agriculture',
      dimension: 'ECONOMIC',
      sdgs: [],
      classification: {
        state: 'NOT_CLASSIFIED',
        dimensions: [],
        categories: [],
        sdgs: [],
      },
    });
    const v5 = await api(tokens.dm!.token)
      .get(`/activities/${v5Approved}`)
      .expect(200);
    expect(v5.body.classification).toEqual({
      state: 'NOT_CLASSIFIED',
      dimensions: [],
      categories: [],
      sdgs: [11],
    });
    // Approved activities cannot be classified afterwards through the API.
    await api(tokens.spc!.token)
      .post(`/activities/${v5Approved}/approve`, goals)
      .expect(409);
  });

  it('writes nothing when the database refuses part of an approval', async () => {
    const id = await waiting('Fictional failed write');
    const repository = app.get(ActivitiesRepository);
    const spc = {
      id: tokens.spc!.id,
      displayName: 'Fictional spc',
      roles: ['PROGRAMME_COORDINATOR' as const],
      districtIds: [],
      societyIds: [societyId],
    };
    // A category the database does not know, past the API's validation: the
    // status change, UN SDGs and dimensions already written are rolled back.
    await expect(
      repository.approve(
        id,
        { id: societyId, districtId, name: 'Fictional Goals Society' },
        [4],
        {
          dimensions: ['SOCIAL'],
          categories: ['NOT_A_CATEGORY' as never],
        },
        spc,
      ),
    ).rejects.toThrow();
    await expectUntouched(id);
  });

  it('keeps a classification to approved activities in the database', async () => {
    const id = await waiting('Fictional constraint check');
    await expect(
      db.workPlanActivity.update({
        where: { id },
        data: { classifiedAt: new Date() },
      }),
    ).rejects.toThrow(/work_plan_activities_classified_when_approved/);
    await expect(
      db.workPlanActivityCategory.createMany({
        data: [
          { activityId: id, category: 'CULTURE' },
          { activityId: id, category: 'CULTURE' },
        ],
      }),
    ).rejects.toThrow();
  });

  it('lets only one of two simultaneous approvals win', async () => {
    const id = await waiting('Fictional simultaneous approval');
    const results = await Promise.all([
      api(tokens.spc!.token).post(`/activities/${id}/approve`, goals),
      api(tokens.spc!.token).post(`/activities/${id}/approve`, {
        sdgs: [1],
        dimensions: ['ECONOMIC'],
        categories: ['HEALTH_NUTRITION'],
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!.body;
    const row = await db.workPlanActivity.findUniqueOrThrow({
      where: { id },
      include: { goalDimensions: true, goalCategories: true, sdgs: true },
    });
    expect(row.goalDimensions.map((d) => d.dimension).sort()).toEqual(
      [...winner.classification.dimensions].sort(),
    );
    expect(row.goalCategories).toHaveLength(
      winner.classification.categories.length,
    );
    expect(row.sdgs).toHaveLength(winner.sdgs.length);
  });

  it('counts approved activities by Development Goals in the programmes report', async () => {
    const report = await api(tokens.spc!.token)
      .get(`/programmes?year=${financialYear}`)
      .expect(200);
    const goalsReport = report.body.developmentGoals;
    // classified + not classified = the approved activities in the report.
    expect(
      goalsReport.classified.planned + goalsReport.notClassified.planned,
    ).toBe(report.body.planned);
    expect(
      goalsReport.classified.completed + goalsReport.notClassified.completed,
    ).toBe(report.body.completed);
    expect(goalsReport.classified.planned).toBeGreaterThanOrEqual(2);
    expect(goalsReport.notClassified.planned).toBeGreaterThanOrEqual(3);
    expect(
      goalsReport.byDimension.map(
        (row: { dimension: string }) => row.dimension,
      ),
    ).toEqual(['SOCIAL', 'ECONOMIC', 'GOVERNANCE']);
    expect(goalsReport.byCategory).toHaveLength(10);
    // An activity with several categories counts once in each.
    const culture = goalsReport.byCategory.find(
      (row: { category: string }) => row.category === 'CULTURE',
    );
    expect(culture.planned).toBeGreaterThanOrEqual(1);
    // NOT_CLASSIFIED activities are never placed in a row, and the Society
    // Officer's sector or dimension is not used: none were classified
    // AGRICULTURE, although an older activity's sector is Agriculture.
    expect(
      goalsReport.byCategory.find(
        (row: { category: string }) => row.category === 'AGRICULTURE',
      ),
    ).toEqual({ category: 'AGRICULTURE', planned: 0, completed: 0 });
    // An SPC assigned to another society counts none of these.
    const other = await api(tokens.otherSpc!.token)
      .get(`/programmes?year=${financialYear}`)
      .expect(200);
    expect(other.body.developmentGoals.classified.planned).toBe(0);
  });
});
