/**
 * Issue #146 database tests: the economic profile returns each output's
 * latest actual and latest estimate, worked out by the database however long
 * the history is, never from a page of it. Fictional districts, societies,
 * accounts and figures, all removed afterwards.
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

type Who = 'officer' | 'otherOfficer' | 'dmNorth' | 'dmCentral' | 'hq';

interface Latest {
  actual: { quantity: number; startsOn: string; measurement: string } | null;
  estimated: { quantity: number; startsOn: string; measurement: string } | null;
}

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('Issue #146 latest figures on the economic profile (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const north = randomUUID();
  const central = randomUUID();
  const society = { mine: randomUUID(), other: randomUUID() };
  const ids: Record<Who, string> = {
    officer: randomUUID(),
    otherOfficer: randomUUID(),
    dmNorth: randomUUID(),
    dmCentral: randomUUID(),
    hq: randomUUID(),
  };
  const tokens = {} as Record<Who, string>;
  const out = {} as Record<string, string>;

  const api = () => request(app.getHttpServer());
  const get = (path: string, who: Who) =>
    api()
      .get(`/api/v1${path}`)
      .set({ Authorization: `Bearer ${tokens[who]}` });
  const post = (path: string, who: Who, body: object) =>
    api()
      .post(`/api/v1${path}`)
      .set({ Authorization: `Bearer ${tokens[who]}` })
      .send(body);

  /** Records written straight to the table, for long histories. */
  const rows = (
    outputId: string,
    measurement: 'ACTUAL' | 'ESTIMATED',
    periods: { basis: 'WEEKLY' | 'MONTHLY'; start: Date; end: Date }[],
    quantity = 10,
  ) =>
    db.productionRecord.createMany({
      data: periods.map((period) => ({
        outputId,
        basis: period.basis,
        periodStart: period.start,
        periodEnd: period.end,
        measurement,
        quantity,
        createdById: ids.officer,
        createdByName: 'Fictional Officer',
        createdByRole: 'SOCIETY_OFFICER',
      })),
    });
  const month = (year: number, m: number) => ({
    basis: 'MONTHLY' as const,
    start: new Date(Date.UTC(year, m - 1, 1)),
    end: new Date(Date.UTC(year, m, 0)),
  });

  const latestOf = async (who: Who) => {
    const profile = (
      await get(`/societies/${society.mine}/economic-profile`, who).expect(200)
    ).body as {
      businesses: { outputs: { id: string; latest: Latest }[] }[];
    };
    return Object.fromEntries(
      profile.businesses.flatMap((b) => b.outputs).map((o) => [o.id, o.latest]),
    ) as Record<string, Latest>;
  };

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
        { id: north, code: `LN${suffix}`, nameEn: `Fictional North ${suffix}` },
        {
          id: central,
          code: `LC${suffix}`,
          nameEn: `Fictional Central ${suffix}`,
        },
      ],
    });
    await db.society.createMany({
      data: [
        [society.mine, north, 'Fictional Lotus'],
        [society.other, north, 'Fictional River'],
      ].map(([id, districtId, name], index) => ({
        id,
        societyCode: `L${index}-${suffix}`,
        nameEn: `${name} ${suffix}`,
        districtId,
        status: 'ACTIVE' as const,
      })),
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `l146.${role.toLowerCase()}.${id.slice(0, 6)}`,
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
        account(ids.officer, 'SOCIETY_OFFICER', {
          districtId: north,
          societyIds: [society.mine],
        }),
        account(ids.otherOfficer, 'SOCIETY_OFFICER', {
          districtId: north,
          societyIds: [society.other],
        }),
        account(ids.dmNorth, 'DISTRICT_MANAGER', { districtId: north }),
        account(ids.dmCentral, 'DISTRICT_MANAGER', { districtId: central }),
        account(ids.hq, 'HQ_ADMIN'),
      ],
    });
    for (const who of Object.keys(ids) as Who[]) {
      const { username } = await db.platformAccount.findUniqueOrThrow({
        where: { id: ids[who] },
      });
      tokens[who] = (
        await api()
          .post('/api/v1/identity/login')
          .send({ username, password: 'test-password-123' })
          .expect(201)
      ).body.token;
    }

    const business = (
      await post(`/societies/${society.mine}/businesses`, 'officer', {
        name: 'Fictional Mixed Farm',
        industry: 'AGRICULTURE',
      }).expect(201)
    ).body;
    for (const product of [
      'MILK',
      'FISH',
      'COCONUTS',
      'TEA_LEAF',
      'EGGS',
      'CURD',
    ])
      out[product] = (
        await post(`/businesses/${business.id}/outputs`, 'officer', {
          product,
        }).expect(201)
      ).body.id;

    // Milk: the newest society-wide actual (October 2026) and an estimate
    // older than 500 other records, so a paged list would find it last.
    await rows(out.MILK, 'ACTUAL', [month(2026, 10)], 3200);
    await rows(out.MILK, 'ESTIMATED', [month(2008, 1)], 2900);
    // Fish: 520 weekly actual figures, newer than coconuts' only record.
    const weeks = [];
    for (let i = 0; i < 520; i++) {
      const start = new Date(day('2015-01-05').getTime() + i * 7 * 86_400_000);
      weeks.push({
        basis: 'WEEKLY' as const,
        start,
        end: new Date(start.getTime() + 6 * 86_400_000),
      });
    }
    await rows(out.FISH, 'ACTUAL', weeks, 40);
    await rows(out.COCONUTS, 'ACTUAL', [month(2010, 6)], 1200);
    // Tea: ten newer estimates before an older actual figure.
    await rows(
      out.TEA_LEAF,
      'ESTIMATED',
      Array.from({ length: 10 }, (_, i) => month(2026, i + 1)),
      75,
    );
    await rows(out.TEA_LEAF, 'ACTUAL', [month(2025, 6)], 68);
    // Eggs: a reported zero. Curd: never reported.
    await rows(out.EGGS, 'ACTUAL', [month(2026, 9)], 0);
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
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({ where: { id: { in: societyIds } } });
      await db.district.deleteMany({ where: { id: { in: [north, central] } } });
    }
    await app?.close();
  });

  it('finds an actual and an estimate however far apart they are in the history', async () => {
    const latest = await latestOf('officer');
    expect(latest[out.MILK].actual).toMatchObject({
      quantity: 3200,
      startsOn: '2026-10-01',
      measurement: 'ACTUAL',
    });
    expect(latest[out.MILK].estimated).toMatchObject({
      quantity: 2900,
      startsOn: '2008-01-01',
      measurement: 'ESTIMATED',
    });
    // The society has over 500 records; coconuts' only one is the oldest
    // actual figure of all, and is still its latest.
    expect(
      await db.productionRecord.count({
        where: { output: { business: { societyId: society.mine } } },
      }),
    ).toBeGreaterThan(500);
    expect(latest[out.COCONUTS].actual).toMatchObject({
      quantity: 1200,
      startsOn: '2010-06-01',
    });
    expect(latest[out.FISH].actual?.startsOn).toBe(
      iso(new Date(day('2015-01-05').getTime() + 519 * 7 * 86_400_000)),
    );
    expect(latest[out.FISH].estimated).toBeNull();
  });

  it('keeps an older actual figure behind ten newer estimates', async () => {
    const latest = await latestOf('officer');
    expect(latest[out.TEA_LEAF].actual).toMatchObject({
      quantity: 68,
      startsOn: '2025-06-01',
    });
    expect(latest[out.TEA_LEAF].estimated).toMatchObject({
      quantity: 75,
      startsOn: '2026-10-01',
    });
  });

  it('tells a reported zero from an output never reported', async () => {
    const latest = await latestOf('officer');
    expect(latest[out.EGGS].actual?.quantity).toBe(0);
    expect(latest[out.EGGS].estimated).toBeNull();
    expect(latest[out.CURD]).toEqual({ actual: null, estimated: null });
  });

  it('follows a correction and stays inside the caller’s scope', async () => {
    const record = await db.productionRecord.findFirstOrThrow({
      where: { outputId: out.MILK, measurement: 'ACTUAL' },
    });
    await api()
      .patch(`/api/v1/production-records/${record.id}`)
      .set({ Authorization: `Bearer ${tokens.officer}` })
      .send({ version: record.version, quantity: 3400 })
      .expect(200);
    for (const who of ['officer', 'dmNorth', 'hq'] as const)
      expect((await latestOf(who))[out.MILK].actual?.quantity, who).toBe(3400);
    for (const who of ['otherOfficer', 'dmCentral'] as const)
      await get(`/societies/${society.mine}/economic-profile`, who).expect(404);
  });
});
