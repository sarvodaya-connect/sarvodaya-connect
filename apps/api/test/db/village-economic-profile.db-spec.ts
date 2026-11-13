/**
 * Issue #145 database tests: the Village Economic Profile through the HTTP
 * API against a real PostgreSQL with the migrations applied. Two fictional
 * districts and three societies, a Society Officer per society, a DM per
 * district, an SPC across districts and a DDM whose temporary grant starts,
 * ends early and expires. Every record here is fictional and removed after.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

const HOUR = 3_600_000;
const OCTOBER = {
  basis: 'MONTHLY',
  startsOn: '2026-10-01',
  endsOn: '2026-10-31',
};
const OCTOBER_QUERY = 'basis=MONTHLY&startsOn=2026-10-01&endsOn=2026-10-31';

/** The calendar month after this one, for estimates (always in the future). */
function nextMonth() {
  const now = new Date(Date.now() + 5.5 * HOUR);
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0),
  );
  return {
    basis: 'MONTHLY',
    startsOn: start.toISOString().slice(0, 10),
    endsOn: end.toISOString().slice(0, 10),
  };
}

type Who =
  | 'hq'
  | 'officerN1'
  | 'officerN2'
  | 'officerC1'
  | 'dmNorth'
  | 'dmCentral'
  | 'spc'
  | 'ddm';

interface SummaryRow {
  product: string;
  unit: string;
  reportedQuantity: number | null;
  contributingBusinesses: number;
  coverage: {
    eligibleSocieties: number;
    reportedSocieties: number;
    zeroSocieties: number;
    missingSocieties: number;
  };
}

describe('Issue #145 Village Economic Profile (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const north = randomUUID();
  const central = randomUUID();
  const society = { n1: randomUUID(), n2: randomUUID(), c1: randomUUID() };
  const ids: Record<Who, string> = {
    hq: randomUUID(),
    officerN1: randomUUID(),
    officerN2: randomUUID(),
    officerC1: randomUUID(),
    dmNorth: randomUUID(),
    dmCentral: randomUUID(),
    spc: randomUUID(),
    ddm: randomUUID(),
  };
  const tokens = {} as Record<Who, string>;

  const api = () => request(app.getHttpServer());
  const auth = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (path: string, who: Who) =>
    api().get(`/api/v1${path}`).set(auth(who));
  const post = (path: string, who: Who, body: object) =>
    api().post(`/api/v1${path}`).set(auth(who)).send(body);
  const patch = (path: string, who: Who, body: object) =>
    api().patch(`/api/v1${path}`).set(auth(who)).send(body);

  /** The October milk row (or undefined) as one caller sees it. */
  const summary = async (who: Who, query = OCTOBER_QUERY) =>
    (await get(`/economic-profile/production?${query}`, who).expect(200))
      .body as {
      products: SummaryRow[];
      otherOutputs: unknown[];
      lastUpdatedAt: string | null;
    };
  const row = async (who: Who, product: string, query = OCTOBER_QUERY) =>
    (await summary(who, query)).products.find((r) => r.product === product);

  const grant = (startsIn: number, endsIn: number, revoked = false) =>
    db.districtAccessGrant.create({
      data: {
        districtId: north,
        deputyId: ids.ddm,
        grantedById: ids.dmNorth,
        startsAt: new Date(Date.now() + startsIn * HOUR),
        expiresAt: new Date(Date.now() + endsIn * HOUR),
        revokedAt: revoked ? new Date() : null,
        reason: 'Fictional cover while the DM is away',
      },
    });

  // Filled in as the tests build the profile.
  const made = {} as Record<string, string>;

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
        { id: north, code: `EN${suffix}`, nameEn: `Fictional North ${suffix}` },
        {
          id: central,
          code: `EC${suffix}`,
          nameEn: `Fictional Central ${suffix}`,
        },
      ],
    });
    await db.society.createMany({
      data: (
        [
          ['n1', north, 'Fictional Lotus'],
          ['n2', north, 'Fictional River'],
          ['c1', central, 'Fictional Hill'],
        ] as const
      ).map(([key, districtId, name]) => ({
        id: society[key],
        societyCode: `E${key.toUpperCase()}-${suffix}`,
        nameEn: `${name} ${suffix}`,
        districtId,
        status: 'ACTIVE' as const,
        businessDescription: 'Fictional dairy collection and coconut sales',
      })),
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `e145.${role.toLowerCase()}.${id.slice(0, 6)}`,
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
        account(ids.officerN1, 'SOCIETY_OFFICER', {
          districtId: north,
          societyIds: [society.n1],
        }),
        account(ids.officerN2, 'SOCIETY_OFFICER', {
          districtId: north,
          societyIds: [society.n2],
        }),
        account(ids.officerC1, 'SOCIETY_OFFICER', {
          districtId: central,
          societyIds: [society.c1],
        }),
        account(ids.dmNorth, 'DISTRICT_MANAGER', { districtId: north }),
        account(ids.dmCentral, 'DISTRICT_MANAGER', { districtId: central }),
        // Placed in North, assigned one North and one Central society.
        account(ids.spc, 'PROGRAMME_COORDINATOR', {
          districtId: north,
          societyIds: [society.n1, society.c1],
        }),
        account(ids.ddm, 'DEPUTY_DISTRICT_MANAGER', {
          districtId: north,
          societyIds: [society.n2],
        }),
      ],
    });
    for (const who of Object.keys(ids) as Who[]) {
      const { username } = await db.platformAccount.findUniqueOrThrow({
        where: { id: ids[who] },
      });
      const login = await api()
        .post('/api/v1/identity/login')
        .send({ username, password: 'test-password-123' })
        .expect(201);
      tokens[who] = login.body.token;
    }
  });

  afterAll(async () => {
    if (db) {
      const societyIds = Object.values(society);
      const where = { output: { business: { societyId: { in: societyIds } } } };
      await db.productionRecordRevision.deleteMany({
        where: { record: where },
      });
      await db.productionRecord.deleteMany({ where });
      await db.businessOutput.deleteMany({
        where: { business: { societyId: { in: societyIds } } },
      });
      await db.societyBusiness.deleteMany({
        where: { societyId: { in: societyIds } },
      });
      await db.platformAuditEvent.deleteMany({
        where: { actorId: { in: Object.values(ids) } },
      });
      await db.districtAccessGrant.deleteMany({ where: { deputyId: ids.ddm } });
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({ where: { id: { in: societyIds } } });
      await db.district.deleteMany({ where: { id: { in: [north, central] } } });
    }
    await app?.close();
  });

  const business = async (
    who: Who,
    societyKey: keyof typeof society,
    body: object,
  ) =>
    (
      await post(
        `/societies/${society[societyKey]}/businesses`,
        who,
        body,
      ).expect(201)
    ).body;
  const output = async (who: Who, businessId: string, body: object) =>
    (await post(`/businesses/${businessId}/outputs`, who, body).expect(201))
      .body;

  it('lets only the assigned Society Officer register businesses', async () => {
    const body = { name: 'Fictional Dairy', industry: 'LIVESTOCK_DAIRY' };
    for (const who of ['hq', 'dmNorth', 'spc', 'ddm'] as const)
      await post(`/societies/${society.n1}/businesses`, who, body).expect(403);
    // Another society's officer cannot even see it.
    await post(`/societies/${society.n1}/businesses`, 'officerN2', body).expect(
      404,
    );

    const dairy = await business('officerN1', 'n1', {
      ...body,
      description: 'Fictional milk collection',
    });
    expect(dairy).toMatchObject({
      status: 'OPERATING',
      version: 1,
      outputs: [],
    });
    made.dairy = dairy.id;
    made.milk = (await output('officerN1', dairy.id, { product: 'MILK' })).id;
  });

  it('keeps the free-text business description and shows the profile in scope only', async () => {
    const profile = (
      await get(
        `/societies/${society.n1}/economic-profile`,
        'officerN1',
      ).expect(200)
    ).body;
    expect(profile.businessDescription).toBe(
      'Fictional dairy collection and coconut sales',
    );
    expect(profile.permissions).toEqual({ canManage: true });
    expect(profile.businesses[0].outputs[0]).toMatchObject({
      product: 'MILK',
      unit: 'LITRE',
      kind: 'GOOD',
    });

    for (const who of ['hq', 'dmNorth', 'spc'] as const) {
      const seen = (
        await get(`/societies/${society.n1}/economic-profile`, who).expect(200)
      ).body;
      expect(seen.permissions.canManage, who).toBe(false);
    }
    for (const who of ['dmCentral', 'ddm', 'officerN2'] as const)
      await get(`/societies/${society.n1}/economic-profile`, who).expect(404);
    // Nothing was copied out of the description.
    const n2 = (
      await get(
        `/societies/${society.n2}/economic-profile`,
        'officerN2',
      ).expect(200)
    ).body;
    expect(n2.businesses).toEqual([]);
  });

  it('saves 3,200 litres of actual October milk once, and a retry adds nothing', async () => {
    const clientRequestId = randomUUID();
    const first = await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        ...OCTOBER,
        clientRequestId,
        measurement: 'ACTUAL',
        quantity: 3200,
        source: 'Fictional collection book',
      },
    ).expect(201);
    expect(first.body).toMatchObject({
      created: true,
      record: {
        quantity: 3200,
        unit: 'LITRE',
        version: 1,
        startsOn: '2026-10-01',
        endsOn: '2026-10-31',
      },
    });
    made.milkOctober = first.body.record.id;

    // The same request again (a network retry), and the same figure without an id.
    const retried = await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        ...OCTOBER,
        clientRequestId,
        measurement: 'ACTUAL',
        quantity: 3200,
      },
    ).expect(200);
    expect(retried.body).toMatchObject({
      created: false,
      record: { id: made.milkOctober },
    });
    await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        ...OCTOBER,
        measurement: 'ACTUAL',
        quantity: 3200,
      },
    ).expect(200);
    // A different figure for the same period must be a correction.
    const clash = await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        ...OCTOBER,
        measurement: 'ACTUAL',
        quantity: 3300,
      },
    ).expect(409);
    expect(clash.body.error.message).toMatch(/Correct that record/);
    expect(
      await db.productionRecord.count({ where: { outputId: made.milk } }),
    ).toBe(1);

    for (const who of ['officerN1', 'dmNorth', 'spc', 'hq'] as const) {
      const milk = await row(
        who,
        'MILK',
        `${OCTOBER_QUERY}&societyId=${society.n1}`,
      );
      expect(milk, who).toMatchObject({
        unit: 'LITRE',
        reportedQuantity: 3200,
        contributingBusinesses: 1,
        coverage: {
          eligibleSocieties: 1,
          reportedSocieties: 1,
          zeroSocieties: 0,
          missingSocieties: 0,
        },
      });
    }
  });

  it('corrects to 3,400 (+200), ignores a retried correction, refuses a stale one and allows decreases', async () => {
    const corrected = await patch(
      `/production-records/${made.milkOctober}`,
      'officerN1',
      {
        version: 1,
        quantity: 3400,
        note: 'Fictional recount',
      },
    ).expect(200);
    expect(corrected.body).toMatchObject({
      changed: true,
      record: { quantity: 3400, version: 2 },
    });
    expect((await row('dmNorth', 'MILK'))?.reportedQuantity).toBe(3400);

    // Retrying the same correction (still naming version 1) changes nothing.
    const again = await patch(
      `/production-records/${made.milkOctober}`,
      'officerN1',
      {
        version: 1,
        quantity: 3400,
        note: 'Fictional recount',
      },
    ).expect(200);
    expect(again.body).toMatchObject({
      changed: false,
      record: { version: 2 },
    });
    // Someone working from version 1 cannot overwrite the newer figure.
    const stale = await patch(
      `/production-records/${made.milkOctober}`,
      'officerN1',
      {
        version: 1,
        quantity: 3300,
      },
    ).expect(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    expect((await row('dmNorth', 'MILK'))?.reportedQuantity).toBe(3400);

    await patch(`/production-records/${made.milkOctober}`, 'officerN1', {
      version: 2,
      quantity: 3000,
    }).expect(200);
    expect((await row('dmNorth', 'MILK'))?.reportedQuantity).toBe(3000);

    const history = (
      await get(
        `/production-records/${made.milkOctober}/history`,
        'spc',
      ).expect(200)
    ).body;
    expect(
      history.revisions.map(
        (r: { version: number; change: string; quantity: number }) => [
          r.version,
          r.change,
          r.quantity,
        ],
      ),
    ).toEqual([
      [3, 'CORRECTED', 3000],
      [2, 'CORRECTED', 3400],
      [1, 'CREATED', 3200],
    ]);
    expect(history.revisions[0].changedBy).toEqual({
      displayName: 'Fictional SOCIETY_OFFICER',
      role: 'SOCIETY_OFFICER',
    });
    expect(history.revisions[2].source).toBe('Fictional collection book');
    for (const who of ['spc', 'dmNorth', 'hq'] as const)
      await patch(`/production-records/${made.milkOctober}`, who, {
        version: 3,
        quantity: 1,
      }).expect(403);
  });

  it('keeps estimates apart from actual figures and refuses overlapping periods', async () => {
    await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        ...OCTOBER,
        measurement: 'ESTIMATED',
        quantity: 3500,
      },
    ).expect(201);
    expect((await row('dmNorth', 'MILK'))?.reportedQuantity).toBe(3000);
    expect(
      (await row('dmNorth', 'MILK', `${OCTOBER_QUERY}&measurement=ESTIMATED`))
        ?.reportedQuantity,
    ).toBe(3500);

    // A week that shares days with October cannot also be an actual figure.
    const overlap = await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        basis: 'WEEKLY',
        startsOn: '2026-10-26',
        endsOn: '2026-11-01',
        measurement: 'ACTUAL',
        quantity: 700,
      },
    ).expect(409);
    expect(overlap.body.error.message).toMatch(/overlaps/);
    // The next week is fine and is not part of October.
    await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        basis: 'WEEKLY',
        startsOn: '2026-11-02',
        endsOn: '2026-11-08',
        measurement: 'ACTUAL',
        quantity: 760,
      },
    ).expect(201);
    expect((await row('dmNorth', 'MILK'))?.reportedQuantity).toBe(3000);
    expect(
      (
        await row(
          'dmNorth',
          'MILK',
          'basis=WEEKLY&startsOn=2026-11-02&endsOn=2026-11-08',
        )
      )?.reportedQuantity,
    ).toBe(760);
    // An actual figure cannot cover days still to come.
    await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        ...nextMonth(),
        measurement: 'ACTUAL',
        quantity: 10,
      },
    ).expect(400);
  });

  it('checks units and quantities', async () => {
    const coconut = await business('officerN1', 'n1', {
      name: 'Fictional Grove',
      industry: 'AGRICULTURE',
    });
    made.grove = coconut.id;
    made.coconuts = (
      await output('officerN1', coconut.id, { product: 'COCONUTS' })
    ).id;
    await post(`/businesses/${coconut.id}/outputs`, 'officerN1', {
      product: 'COCONUTS',
    }).expect(409);
    await post(`/businesses/${coconut.id}/outputs`, 'officerN1', {
      product: 'MILK',
      unit: 'KILOGRAM',
    }).expect(400);
    await post(`/businesses/${coconut.id}/outputs`, 'officerN1', {
      product: 'OTHER',
      unit: 'ITEM',
    }).expect(400);

    const save = (quantity: unknown) =>
      post(
        `/business-outputs/${made.coconuts}/production-records`,
        'officerN1',
        {
          ...OCTOBER,
          measurement: 'ACTUAL',
          quantity,
        },
      );
    for (const bad of [2.5, -1, 100_000_001, '12', null])
      await save(bad).expect(400);
    await post(
      `/business-outputs/${made.milk}/production-records`,
      'officerN1',
      {
        basis: 'MONTHLY',
        startsOn: '2026-09-01',
        endsOn: '2026-09-30',
        measurement: 'ACTUAL',
        quantity: 12.345,
      },
    ).expect(400);
    await save(1250).expect(201);
  });

  it('counts several businesses and products without mixing them, and supports services', async () => {
    // A second dairy business in the same society: one society, two businesses.
    const second = await business('officerN1', 'n1', {
      name: 'Fictional Second Dairy',
      industry: 'LIVESTOCK_DAIRY',
    });
    const milk2 = await output('officerN1', second.id, { product: 'MILK' });
    await post(
      `/business-outputs/${milk2.id}/production-records`,
      'officerN1',
      {
        ...OCTOBER,
        measurement: 'ACTUAL',
        quantity: 200.5,
      },
    ).expect(201);
    const tailoring = await business('officerN1', 'n1', {
      name: 'Fictional Tailors',
      industry: 'SERVICES',
    });
    const jobs = await output('officerN1', tailoring.id, {
      product: 'TAILORING_JOBS',
    });
    expect(jobs).toMatchObject({ unit: 'JOB', kind: 'SERVICE' });
    await post(`/business-outputs/${jobs.id}/production-records`, 'officerN1', {
      ...OCTOBER,
      measurement: 'ACTUAL',
      quantity: 14,
    }).expect(201);

    const milk = await row('dmNorth', 'MILK');
    expect(milk).toMatchObject({
      reportedQuantity: 3200.5,
      contributingBusinesses: 2,
      coverage: { eligibleSocieties: 1, reportedSocieties: 1 },
    });
    expect(await row('dmNorth', 'TAILORING_JOBS')).toMatchObject({
      unit: 'JOB',
      reportedQuantity: 14,
    });
    expect(await row('dmNorth', 'COCONUTS')).toMatchObject({
      unit: 'NUT',
      reportedQuantity: 1250,
    });
  });

  it('tells a reported zero from a missing report, counting eligible societies once', async () => {
    const n2Farm = await business('officerN2', 'n2', {
      name: 'Fictional River Farm',
      industry: 'AGRICULTURE',
    });
    const n2Milk = await output('officerN2', n2Farm.id, { product: 'MILK' });
    const nuts = await output('officerN2', n2Farm.id, { product: 'COCONUTS' });
    await post(`/business-outputs/${nuts.id}/production-records`, 'officerN2', {
      ...OCTOBER,
      measurement: 'ACTUAL',
      quantity: 0,
    }).expect(201);

    // Registered after October ended, so not counted as missing for October:
    // past coverage does not change when a society registers later.
    expect((await row('dmNorth', 'MILK'))?.coverage).toMatchObject({
      eligibleSocieties: 1,
      missingSocieties: 0,
    });
    // Registered before October: eligible, and missing until it reports.
    await db.businessOutput.update({
      where: { id: n2Milk.id },
      data: { createdAt: new Date('2026-09-01T00:00:00.000Z') },
    });
    const milk = await row('dmNorth', 'MILK');
    expect(milk).toMatchObject({
      reportedQuantity: 3200.5,
      coverage: {
        eligibleSocieties: 2,
        reportedSocieties: 1,
        zeroSocieties: 0,
        missingSocieties: 1,
      },
    });
    expect(await row('dmNorth', 'COCONUTS')).toMatchObject({
      reportedQuantity: 1250,
      coverage: {
        eligibleSocieties: 2,
        reportedSocieties: 2,
        zeroSocieties: 1,
        missingSocieties: 0,
      },
    });
    // Only the zero: a reported zero, not "not reported".
    expect(await row('officerN2', 'COCONUTS')).toMatchObject({
      reportedQuantity: 0,
      coverage: { reportedSocieties: 1, zeroSocieties: 1 },
    });
    expect(await row('officerN2', 'MILK')).toMatchObject({
      reportedQuantity: null,
      coverage: {
        eligibleSocieties: 1,
        reportedSocieties: 0,
        missingSocieties: 1,
      },
    });
  });

  it('lists Other outputs one by one and never adds them together', async () => {
    const n1Other = await business('officerN1', 'n1', {
      name: 'Fictional Sweets',
      industry: 'OTHER',
      otherIndustry: 'Fictional sweet making',
    });
    const jaggery = await output('officerN1', n1Other.id, {
      product: 'OTHER',
      otherDescription: 'Fictional jaggery',
      unit: 'KILOGRAM',
    });
    const brooms = await output('officerN1', n1Other.id, {
      product: 'OTHER',
      otherDescription: 'Fictional brooms',
      unit: 'ITEM',
    });
    for (const [id, quantity] of [
      [jaggery.id, 40],
      [brooms.id, 10],
    ] as const)
      await post(`/business-outputs/${id}/production-records`, 'officerN1', {
        ...OCTOBER,
        measurement: 'ACTUAL',
        quantity,
      }).expect(201);
    await post(`/societies/${society.n1}/businesses`, 'officerN1', {
      name: 'Fictional Mystery',
      industry: 'OTHER',
    }).expect(400);

    const result = await summary('dmNorth');
    expect(result.products.map((r) => r.product)).not.toContain('OTHER');
    expect(result.otherOutputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: 'Fictional jaggery',
          unit: 'KILOGRAM',
          quantity: 40,
        }),
        expect.objectContaining({
          description: 'Fictional brooms',
          unit: 'ITEM',
          quantity: 10,
        }),
      ]),
    );
    expect(result.otherOutputs).toHaveLength(2);
    expect(result.lastUpdatedAt).not.toBeNull();
  });

  it('keeps every read inside the caller’s scope', async () => {
    // Central's DM sees none of North, by id, filter or total.
    await get(
      `/production-records/${made.milkOctober}/history`,
      'dmCentral',
    ).expect(404);
    await get(
      `/business-outputs/${made.milk}/production-records`,
      'dmCentral',
    ).expect(404);
    expect(await row('dmCentral', 'MILK')).toBeUndefined();
    expect(
      await row('dmCentral', 'MILK', `${OCTOBER_QUERY}&districtId=${north}`),
    ).toBeUndefined();
    const listed = (
      await get(
        `/economic-profile/production-records?societyId=${society.n1}`,
        'dmCentral',
      ).expect(200)
    ).body;
    expect(listed.total).toBe(0);
    await get(
      `/production-records/${made.milkOctober}/history`,
      'officerC1',
    ).expect(404);

    // The SPC sees the assigned North society only, not the rest of North.
    expect((await row('spc', 'COCONUTS'))?.coverage.eligibleSocieties).toBe(1);
    expect((await row('spc', 'MILK'))?.reportedQuantity).toBe(3200.5);

    // A mixed list shows records but no total.
    const all = (
      await get(
        '/economic-profile/production-records?pageSize=100',
        'dmNorth',
      ).expect(200)
    ).body;
    expect(all).not.toHaveProperty('totalQuantity');
    expect(
      all.items.every((item: { society: { id: string } }) =>
        [society.n1, society.n2].includes(item.society.id),
      ),
    ).toBe(true);
    expect(all.total).toBeGreaterThanOrEqual(8);
    const page = (
      await get(
        '/economic-profile/production-records?pageSize=2&page=2',
        'dmNorth',
      ).expect(200)
    ).body;
    expect(page.items).toHaveLength(2);
    await get(
      '/economic-profile/production-records?pageSize=1000',
      'dmNorth',
    ).expect(400);
    await get(
      '/economic-profile/production?basis=MONTHLY&startsOn=2026-10-01&endsOn=2026-10-30',
      'dmNorth',
    ).expect(400);
  });

  it('gives a DDM the district only while a temporary grant is valid', async () => {
    const ddmMilk = async () =>
      (await row('ddm', 'MILK'))?.reportedQuantity ?? null;
    // Assigned to n2 only, which has a milk output but no October figure.
    expect(await ddmMilk()).toBeNull();
    await get(`/production-records/${made.milkOctober}/history`, 'ddm').expect(
      404,
    );

    const future = await grant(1, 5);
    expect(await ddmMilk()).toBeNull();

    const valid = await grant(-1, 5);
    expect(await ddmMilk()).toBe(3200.5);
    await get(`/production-records/${made.milkOctober}/history`, 'ddm').expect(
      200,
    );
    // District access never gives edit rights.
    await patch(`/production-records/${made.milkOctober}`, 'ddm', {
      version: 3,
      quantity: 1,
    }).expect(403);

    await db.districtAccessGrant.update({
      where: { id: valid.id },
      data: { revokedAt: new Date() },
    });
    expect(await ddmMilk()).toBeNull();
    await get(`/production-records/${made.milkOctober}/history`, 'ddm').expect(
      404,
    );

    await grant(-5, -1);
    expect(await ddmMilk()).toBeNull();
    await db.districtAccessGrant.deleteMany({ where: { id: future.id } });
  });

  it('refuses stale business changes and keeps history when closing and archiving', async () => {
    const renamed = await patch(`/businesses/${made.grove}`, 'officerN1', {
      version: 1,
      name: 'Fictional Coconut Grove',
    }).expect(200);
    expect(renamed.body).toMatchObject({
      version: 2,
      updatedBy: { displayName: 'Fictional SOCIETY_OFFICER' },
    });
    // Saving the same again is harmless; a different change from version 1 is not.
    await patch(`/businesses/${made.grove}`, 'officerN1', {
      version: 1,
      name: 'Fictional Coconut Grove',
    }).expect(200);
    await patch(`/businesses/${made.grove}`, 'officerN1', {
      version: 1,
      name: 'Fictional Other Name',
    }).expect(409);
    await patch(`/businesses/${made.grove}`, 'spc', {
      version: 2,
      status: 'CLOSED',
    }).expect(403);

    const outputRow = await db.businessOutput.findUniqueOrThrow({
      where: { id: made.coconuts },
    });
    const archived = await patch(
      `/business-outputs/${made.coconuts}`,
      'officerN1',
      {
        version: outputRow.version,
        archived: true,
      },
    ).expect(200);
    expect(archived.body.archivedAt).not.toBeNull();
    const closed = await patch(`/businesses/${made.grove}`, 'officerN1', {
      version: 2,
      status: 'CLOSED',
    }).expect(200);
    expect(closed.body.closedAt).not.toBeNull();

    // October's figures are unchanged, and the archived output still lists them.
    expect((await row('dmNorth', 'COCONUTS'))?.reportedQuantity).toBe(1250);
    const records = (
      await get(
        `/business-outputs/${made.coconuts}/production-records`,
        'dmNorth',
      ).expect(200)
    ).body;
    expect(records.total).toBe(1);
    // A late figure for a past month is accepted; a later period is not.
    await post(
      `/business-outputs/${made.coconuts}/production-records`,
      'officerN1',
      {
        basis: 'MONTHLY',
        startsOn: '2026-09-01',
        endsOn: '2026-09-30',
        measurement: 'ACTUAL',
        quantity: 1100,
      },
    ).expect(201);
    await post(
      `/business-outputs/${made.coconuts}/production-records`,
      'officerN1',
      {
        ...nextMonth(),
        measurement: 'ESTIMATED',
        quantity: 1200,
      },
    ).expect(400);
    await post(`/businesses/${made.grove}/outputs`, 'officerN1', {
      product: 'FRUIT',
    }).expect(400);
  });

  it('enforces the rules in the database too', async () => {
    const insert = (
      start: string,
      end: string,
      basis: string,
      quantity: number,
      label: string | null = null,
    ) =>
      db.$executeRawUnsafe(
        `INSERT INTO production_records (id, output_id, basis, period_start, period_end, season_label, measurement, quantity, created_by_id, created_by_name, updated_at)
         VALUES ($1::uuid, $2::uuid, $3::production_basis, $4::date, $5::date, $6, 'ESTIMATED', $7, 'test', 'Fictional', now())`,
        randomUUID(),
        made.milk,
        basis,
        start,
        end,
        label,
        quantity,
      );
    await expect(
      insert('2025-01-01', '2025-01-31', 'MONTHLY', -1),
    ).rejects.toThrow();
    await expect(
      insert('2025-01-02', '2025-01-31', 'MONTHLY', 1),
    ).rejects.toThrow();
    // 7 January 2025 is a Tuesday.
    await expect(
      insert('2025-01-07', '2025-01-13', 'WEEKLY', 1),
    ).rejects.toThrow();
    await expect(
      insert('2025-01-01', '2025-03-31', 'SEASONAL', 1),
    ).rejects.toThrow();
    await expect(
      insert('2025-01-01', '2025-03-31', 'SEASONAL', 1, 'Fictional Yala'),
    ).resolves.toBe(1);
    await expect(
      db.businessOutput.create({
        data: {
          businessId: made.dairy,
          product: 'OTHER',
          unit: 'ITEM',
          createdById: 'test',
          createdByName: 'Fictional',
        },
      }),
    ).rejects.toThrow();
  });
});
