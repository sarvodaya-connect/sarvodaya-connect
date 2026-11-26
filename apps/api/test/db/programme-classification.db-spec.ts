/**
 * Issue #173 database tests: Programmes figures by the SPC's V6
 * classification, through the HTTP API against a real PostgreSQL with the
 * migrations applied. Only approved activities count; an activity with
 * several dimensions or categories counts once overall and once in each;
 * older approvals without a classification stay in the overall totals but
 * out of every breakdown and filtered result; filters compose with the year
 * and each person's scope, including a DDM's temporary district access.
 * Every record here is fictional and removed after.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { byCodeUnit } from '../../src/common/compare.js';
import type {
  ActivityCategory,
  ActivityDimension,
} from '../../src/generated/prisma/enums.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { latestCompletedFinancialYear } from '../../src/societies/financial-year.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

const HOUR = 3_600_000;

type Count = { planned: number; completed: number };
type Body = {
  planned: number;
  completed: number;
  sectors: { sector: string; planned: number }[];
  sdgs: { sdg: number; completed: number }[];
  recent: { name: string }[];
  classification: {
    filters: { dimensions: string[]; categories: string[] };
    classified: Count;
    unclassified: Count;
    byDimension: ({ dimension: string } & Count)[];
    byCategory: ({ category: string } & Count)[];
  };
};

describe('Issue #173 Programmes by V6 classification (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  // A financial year that has ended, so every approved activity is completed.
  const fy = latestCompletedFinancialYear();
  const north = randomUUID();
  const central = randomUUID();
  const society = { n1: randomUUID(), n2: randomUUID(), c1: randomUUID() };
  const ids = {
    hq: randomUUID(),
    dm: randomUUID(),
    spc: randomUUID(),
    ddm: randomUUID(),
  };
  const tokens = {} as Record<keyof typeof ids, string>;

  const get = (path: string, who: keyof typeof ids) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${tokens[who]}`);
  const programmes = async (
    who: Exclude<keyof typeof ids, 'hq'>,
    filters = '',
  ): Promise<Body> =>
    (await get(`/programmes?year=${fy}${filters}`, who).expect(200)).body;
  const shown = (body: Body) =>
    body.recent
      .map((row) => row.name.replace(` ${suffix}`, ''))
      .sort(byCodeUnit);
  const dimension = (body: Body, value: string) =>
    body.classification.byDimension.find((row) => row.dimension === value)!;
  const category = (body: Body, value: string) =>
    body.classification.byCategory.find((row) => row.category === value)!;

  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY = '22'.repeat(32);
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

    await db.district.createMany({
      data: [
        { id: north, code: `N${suffix}`, nameEn: `Fictional North ${suffix}` },
        {
          id: central,
          code: `C${suffix}`,
          nameEn: `Fictional Central ${suffix}`,
        },
      ],
    });
    await db.society.createMany({
      data: (
        [
          ['n1', north],
          ['n2', north],
          ['c1', central],
        ] as const
      ).map(([key, districtId]) => ({
        id: society[key],
        societyCode: `Q${key.toUpperCase()}-${suffix}`,
        nameEn: `Fictional ${key} ${suffix}`,
        districtId,
        status: 'ACTIVE' as const,
      })),
    });
    const activity = async (
      societyId: string,
      name: string,
      sector: string,
      sdgs: number[],
      classification: {
        dimensions: ActivityDimension[];
        categories: ActivityCategory[];
      } | null,
      status: 'APPROVED' | 'WAITING_FOR_SPC' | 'SENT_BACK' = 'APPROVED',
    ) => {
      const row = await db.workPlanActivity.create({
        data: {
          societyId,
          year: fy,
          month: 9,
          name: `${name} ${suffix}`,
          description: 'Fictional',
          sector,
          allocatedCost: '1000',
          dimension: 'SOCIAL',
          spcDimensions: classification?.dimensions ?? [],
          spcCategories: classification?.categories ?? [],
          status,
          reviewedAt: status === 'WAITING_FOR_SPC' ? null : new Date(),
          reviewedByName: status === 'WAITING_FOR_SPC' ? null : 'Fictional SPC',
        },
      });
      await db.workPlanActivitySdg.createMany({
        data: sdgs.map((sdg) => ({ activityId: row.id, sdg })),
      });
    };
    // Two dimensions and two categories: once overall, once in each.
    await activity(
      society.n1,
      'Fictional nutrition market',
      'Health and nutrition',
      [2, 3],
      {
        dimensions: ['SOCIAL', 'ECONOMIC'],
        categories: ['HEALTH_AND_NUTRITION', 'ECONOMY'],
      },
    );
    await activity(
      society.n2,
      'Fictional village council',
      'Governance',
      [16],
      {
        dimensions: ['GOVERNANCE'],
        categories: ['GOVERNANCE'],
      },
    );
    // Approved before V6: no classification recorded.
    await activity(
      society.n1,
      'Fictional older well',
      'Housing and infrastructure',
      [6],
      null,
    );
    // Not approved: never counted. The database only allows a classification
    // on an approved activity, so these have none.
    await activity(
      society.n1,
      'Fictional waiting fair',
      'Culture',
      [11],
      null,
      'WAITING_FOR_SPC',
    );
    await activity(
      society.n2,
      'Fictional returned clinic',
      'Health and nutrition',
      [3],
      null,
      'SENT_BACK',
    );
    // In Central: outside the North DM's scope.
    await activity(society.c1, 'Fictional dance school', 'Culture', [4], {
      dimensions: ['SOCIAL'],
      categories: ['CULTURE'],
    });

    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `p173.${role.toLowerCase()}.${id.slice(0, 6)}`,
      displayName: `Fictional ${role}`,
      phone: '+94000000000',
      role,
      status: 'ACTIVE',
      passwordHash: passwordHash('test-password-123'),
      districtId: opts.districtId ?? null,
      societyIds: opts.societyIds ?? [],
    });
    await db.platformAccount.createMany({
      data: [
        account(ids.hq, 'HQ_ADMIN'),
        account(ids.dm, 'DISTRICT_MANAGER', { districtId: north }),
        account(ids.spc, 'PROGRAMME_COORDINATOR', {
          districtId: north,
          societyIds: [society.n1, society.c1],
        }),
        account(ids.ddm, 'DEPUTY_DISTRICT_MANAGER', {
          districtId: north,
          societyIds: [society.n1],
        }),
      ],
    });
    for (const key of Object.keys(ids) as (keyof typeof ids)[]) {
      const { username } = await db.platformAccount.findUniqueOrThrow({
        where: { id: ids[key] },
      });
      const login = await request(app.getHttpServer())
        .post('/api/v1/identity/login')
        .send({ username, password: 'test-password-123' })
        .expect(201);
      tokens[key] = login.body.token;
    }
  });

  afterAll(async () => {
    if (db) {
      await db.platformAuditEvent.deleteMany({
        where: { actorId: { in: Object.values(ids) } },
      });
      await db.districtAccessGrant.deleteMany({ where: { deputyId: ids.ddm } });
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({
        where: { id: { in: Object.values(society) } },
      });
      await db.district.deleteMany({ where: { id: { in: [north, central] } } });
    }
    await app?.close();
  });

  it('counts each approved activity once overall and once per bucket', async () => {
    const body = await programmes('dm');
    // Two classified and one older approval; waiting and sent back are out.
    expect([body.planned, body.completed]).toEqual([3, 3]);
    expect(body.classification.filters).toEqual({
      dimensions: [],
      categories: [],
    });
    expect(body.classification.classified).toEqual({
      planned: 2,
      completed: 2,
    });
    expect(body.classification.unclassified).toEqual({
      planned: 1,
      completed: 1,
    });
    expect(body.classification.byDimension).toEqual([
      { dimension: 'SOCIAL', planned: 1, completed: 1 },
      { dimension: 'ECONOMIC', planned: 1, completed: 1 },
      { dimension: 'GOVERNANCE', planned: 1, completed: 1 },
    ]);
    expect(body.classification.byCategory.map((row) => row.category)).toEqual([
      'COMMUNITY_EDUCATION',
      'CHILD_WELLBEING',
      'CULTURE',
      'ECONOMY',
      'GOVERNANCE',
      'HEALTH_AND_NUTRITION',
      'HOUSING_AND_INFRASTRUCTURE',
      'SPIRITUAL_DEVELOPMENT',
      'AGRICULTURE',
      'ENVIRONMENT',
    ]);
    expect(category(body, 'HEALTH_AND_NUTRITION').completed).toBe(1);
    expect(category(body, 'ECONOMY').completed).toBe(1);
    expect(category(body, 'GOVERNANCE').completed).toBe(1);
    // The older approval never lands in a category; the waiting fair is out.
    expect(category(body, 'HOUSING_AND_INFRASTRUCTURE').completed).toBe(0);
    expect(category(body, 'CULTURE').completed).toBe(0);
    // The breakdowns overlap: they add up to more than the classified total.
    const dimensionSum = body.classification.byDimension.reduce(
      (sum, row) => sum + row.completed,
      0,
    );
    expect(dimensionSum).toBe(3);
    expect(dimensionSum).toBeGreaterThan(
      body.classification.classified.completed,
    );
  });

  it('narrows every figure to the matching classified activities', async () => {
    const body = await programmes('dm', '&dimension=SOCIAL');
    expect(body.classification.filters).toEqual({
      dimensions: ['SOCIAL'],
      categories: [],
    });
    expect([body.planned, body.completed]).toEqual([1, 1]);
    expect(body.classification.classified).toEqual({
      planned: 1,
      completed: 1,
    });
    // Older approvals are reported, never filtered in.
    expect(body.classification.unclassified).toEqual({
      planned: 1,
      completed: 1,
    });
    expect(shown(body)).toEqual(['Fictional nutrition market']);
    expect(body.sectors.map((row) => row.sector)).toEqual([
      'Health and nutrition',
    ]);
    expect(
      body.sdgs.filter((row) => row.completed > 0).map((row) => row.sdg),
    ).toEqual([2, 3]);
    // Within the filter, the activity's other buckets still show.
    expect(dimension(body, 'ECONOMIC').completed).toBe(1);
    expect(dimension(body, 'GOVERNANCE').completed).toBe(0);
  });

  it('matches any value within a filter and both filters together', async () => {
    const either = await programmes(
      'dm',
      '&dimension=GOVERNANCE&dimension=SOCIAL',
    );
    expect(either.completed).toBe(2);
    expect(either.classification.filters.dimensions).toEqual([
      'SOCIAL',
      'GOVERNANCE',
    ]);

    // Two matching categories still count the activity once.
    const once = await programmes(
      'dm',
      '&category=ECONOMY,HEALTH_AND_NUTRITION',
    );
    expect(once.completed).toBe(1);
    expect(shown(once)).toEqual(['Fictional nutrition market']);

    const both = await programmes(
      'dm',
      '&dimension=GOVERNANCE&category=GOVERNANCE',
    );
    expect(shown(both)).toEqual(['Fictional village council']);

    // Nothing matches both: zero, not an error, and the older count stays.
    const none = await programmes(
      'dm',
      '&dimension=GOVERNANCE&category=HEALTH_AND_NUTRITION',
    );
    expect([none.planned, none.completed]).toEqual([0, 0]);
    expect(none.recent).toEqual([]);
    expect(none.classification.classified).toEqual({
      planned: 0,
      completed: 0,
    });
    expect(
      none.classification.byCategory.every((row) => row.planned === 0),
    ).toBe(true);
    expect(none.classification.unclassified.completed).toBe(1);
  });

  it('keeps each person to their own scope, including temporary access', async () => {
    // The SPC sees North 1 and Central 1: both SOCIAL activities.
    const spc = await programmes('spc', '&dimension=SOCIAL');
    expect(shown(spc)).toEqual([
      'Fictional dance school',
      'Fictional nutrition market',
    ]);

    // The DDM sees only North 1, until a grant covers Central.
    expect(shown(await programmes('ddm', '&category=CULTURE'))).toEqual([]);
    const grant = await db.districtAccessGrant.create({
      data: {
        districtId: central,
        deputyId: ids.ddm,
        grantedById: ids.dm,
        startsAt: new Date(Date.now() - HOUR),
        expiresAt: new Date(Date.now() + HOUR),
        reason: 'Fictional cover while the DM is away',
      },
    });
    expect(shown(await programmes('ddm', '&category=CULTURE'))).toEqual([
      'Fictional dance school',
    ]);
    await db.districtAccessGrant.update({
      where: { id: grant.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(shown(await programmes('ddm', '&category=CULTURE'))).toEqual([]);

    // HQ sees both SOCIAL activities nationally (other data may exist).
    const national: Body = (
      await get(
        `/national/programmes?year=${fy}&dimension=SOCIAL`,
        'hq',
      ).expect(200)
    ).body;
    const names = national.recent.map((row) => row.name);
    expect(names).toContain(`Fictional nutrition market ${suffix}`);
    expect(names).toContain(`Fictional dance school ${suffix}`);
    expect(names).not.toContain(`Fictional village council ${suffix}`);
    expect(names).not.toContain(`Fictional older well ${suffix}`);
  });

  it('refuses unknown filter values', async () => {
    await get(`/programmes?year=${fy}&dimension=SPIRITUAL`, 'dm').expect(400);
    await get(`/programmes?year=${fy}&category=Health`, 'dm').expect(400);
    await get(
      `/national/programmes?year=${fy}&category=NOT_A_CATEGORY`,
      'hq',
    ).expect(400);
  });
});
