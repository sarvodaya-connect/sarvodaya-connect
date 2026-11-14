/**
 * Issue #117 database tests: Programmes & Activities for a DM, DDM and SPC,
 * counted only over the societies each may see, through the HTTP API against
 * a real PostgreSQL with the migrations applied. Two fictional districts,
 * different assignments, and a DDM's temporary grant before it starts, while
 * valid, after it expires and after it is ended early. Every record here is
 * fictional and removed after.
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
import { latestCompletedFinancialYear } from '../../src/societies/financial-year.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

const HOUR = 3_600_000;

describe('Issue #117 scoped Programmes & Activities (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const fy = latestCompletedFinancialYear();
  const north = randomUUID();
  const central = randomUUID();
  const society = { n1: randomUUID(), n2: randomUUID(), c1: randomUUID() };
  const ids = {
    hq: randomUUID(),
    officer: randomUUID(),
    dmNorth: randomUUID(),
    dmCentral: randomUUID(),
    spc: randomUUID(),
    ddm: randomUUID(),
  };
  const tokens = {} as Record<keyof typeof ids, string>;
  const names = {
    n1: `Fictional North Sunrise ${suffix}`,
    n2: `Fictional North River ${suffix}`,
    c1: `Fictional Central Lotus ${suffix}`,
  };

  const get = (path: string, who: keyof typeof ids) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${tokens[who]}`);
  const programmes = async (who: keyof typeof ids, status = 200) =>
    (await get(`/programmes?year=${fy}`, who).expect(status)).body;
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
        societyCode: `P${key.toUpperCase()}-${suffix}`,
        nameEn: names[key],
        districtId,
        status: 'ACTIVE' as const,
      })),
    });
    const activity = async (
      societyId: string,
      name: string,
      sector: string,
      sdgs: number[],
      status: 'APPROVED' | 'WAITING_FOR_SPC' = 'APPROVED',
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
          status,
          reviewedAt: status === 'APPROVED' ? new Date() : null,
          reviewedByName: status === 'APPROVED' ? 'Fictional SPC' : null,
        },
      });
      await db.workPlanActivitySdg.createMany({
        data: sdgs.map((sdg) => ({ activityId: row.id, sdg })),
      });
    };
    await activity(
      society.n1,
      'Fictional youth camp',
      'Community education',
      [4, 6],
    );
    await activity(
      society.n2,
      'Fictional clinic day',
      'Health and nutrition',
      [3],
    );
    // Waiting for the SPC: never counted.
    await activity(
      society.n2,
      'Fictional unapproved fair',
      'Health and nutrition',
      [3],
      'WAITING_FOR_SPC',
    );
    await activity(society.c1, 'Fictional seed bank', 'Agriculture', [2]);

    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `p117.${role.toLowerCase()}.${id.slice(0, 6)}`,
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
        account(ids.officer, 'SOCIETY_OFFICER', {
          districtId: north,
          societyIds: [society.n1],
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

  const shown = (body: { recent: { name: string }[] }) =>
    body.recent.map((row) => row.name.replace(` ${suffix}`, '')).sort();

  it('serves DMs, DDMs and SPCs only; HQ keeps the national view', async () => {
    await get(`/programmes?year=${fy}`, 'hq').expect(403);
    await get(`/programmes?year=${fy}`, 'officer').expect(403);
    await get(`/national/programmes?year=${fy}`, 'dmNorth').expect(403);
    await get(`/national/programmes?year=${fy}`, 'spc').expect(403);
    await get(`/national/programmes?year=${fy}`, 'ddm').expect(403);
    await get('/programmes?year=2015', 'dmNorth').expect(400);
    const national = (
      await get(`/national/programmes?year=${fy}`, 'hq').expect(200)
    ).body;
    expect(national).not.toHaveProperty('scope');
    expect(national.completed).toBeGreaterThanOrEqual(3);
  });

  it("counts a DM's own district only, SPC-approved activities only", async () => {
    const body = await programmes('dmNorth');
    expect(body).toMatchObject({
      financialYear: { startYear: fy },
      planned: 2,
      completed: 2,
      scope: {
        kind: 'DISTRICT',
        societies: 2,
        districts: [{ id: north, name: `Fictional North ${suffix}` }],
        temporaryAccessEndsAt: null,
      },
    });
    expect(shown(body)).toEqual([
      'Fictional clinic day',
      'Fictional youth camp',
    ]);
    expect(body.sectors).toEqual(
      expect.arrayContaining([
        {
          sector: 'Community education',
          planned: 1,
          completed: 1,
          societies: 1,
        },
        {
          sector: 'Health and nutrition',
          planned: 1,
          completed: 1,
          societies: 1,
        },
      ]),
    );
    // Equal counts are listed by SDG number; an activity can have several SDGs.
    expect(body.sdgs.slice(0, 4)).toEqual([
      { sdg: 3, completed: 1 },
      { sdg: 4, completed: 1 },
      { sdg: 6, completed: 1 },
      { sdg: 1, completed: 0 },
    ]);
    const central = await programmes('dmCentral');
    expect(central).toMatchObject({ completed: 1, scope: { societies: 1 } });
    expect(shown(central)).toEqual(['Fictional seed bank']);
  });

  it("counts an SPC's assigned societies across districts, not the district they are placed in", async () => {
    const body = await programmes('spc');
    expect(body).toMatchObject({
      completed: 2,
      scope: { kind: 'ASSIGNED', societies: 2, districts: [] },
    });
    expect(shown(body)).toEqual([
      'Fictional seed bank',
      'Fictional youth camp',
    ]);
    expect(JSON.stringify(body)).not.toContain(names.n2);
  });

  it('gives a DDM the district only while a temporary grant is valid, checked on every request', async () => {
    const assignedOnly = async () => {
      const body = await programmes('ddm');
      expect(body).toMatchObject({
        completed: 1,
        scope: {
          kind: 'ASSIGNED',
          societies: 1,
          districts: [],
          temporaryAccessEndsAt: null,
        },
      });
      expect(shown(body)).toEqual(['Fictional youth camp']);
    };
    // The DDM's district affiliation alone gives no district view.
    await assignedOnly();

    // Before it starts.
    const later = await grant(1, 5);
    await assignedOnly();
    await db.districtAccessGrant.delete({ where: { id: later.id } });

    // Ended early (revoked) before this request.
    await grant(-1, 5, true);
    await assignedOnly();

    // While valid.
    const active = await grant(-1, 5);
    const during = await programmes('ddm');
    expect(during).toMatchObject({
      completed: 2,
      scope: {
        kind: 'ASSIGNED_AND_DISTRICT',
        societies: 2,
        districts: [{ id: north }],
        temporaryAccessEndsAt: active.expiresAt.toISOString(),
      },
    });
    expect(shown(during)).toEqual([
      'Fictional clinic day',
      'Fictional youth camp',
    ]);
    expect(JSON.stringify(during)).not.toContain(names.c1);

    // Revoked now: the very next request loses the district.
    await db.districtAccessGrant.update({
      where: { id: active.id },
      data: { revokedAt: new Date() },
    });
    await assignedOnly();

    // Expired.
    await grant(-6, -1);
    await assignedOnly();
  });

  it('lists only recent activities in the chosen financial year, as the totals count them', async () => {
    // April to March: March of the next calendar year is in the year; April of
    // it, and March of the start year, are not. Approved most recently, so
    // they would top the list without the year filter.
    const rows = await Promise.all(
      (
        [
          ['Fictional March close', fy + 1, 3],
          ['Fictional next year start', fy + 1, 4],
          ['Fictional last year end', fy, 3],
        ] as const
      ).map(([name, year, month]) =>
        db.workPlanActivity.create({
          data: {
            societyId: society.n1,
            year,
            month,
            name: `${name} ${suffix}`,
            description: 'Fictional',
            sector: 'Community education',
            allocatedCost: '1000',
            dimension: 'SOCIAL',
            status: 'APPROVED',
            reviewedAt: new Date(Date.now() + HOUR),
            reviewedByName: 'Fictional SPC',
          },
        }),
      ),
    );
    try {
      const body = await programmes('dmNorth');
      expect(body).toMatchObject({ planned: 3 });
      // shown() uses a plain sort, so capitals come first.
      expect(shown(body)).toEqual([
        'Fictional March close',
        'Fictional clinic day',
        'Fictional youth camp',
      ]);
      const national = (
        await get(`/national/programmes?year=${fy}`, 'hq').expect(200)
      ).body;
      expect(JSON.stringify(national.recent)).not.toMatch(
        /Fictional (next year start|last year end)/,
      );
    } finally {
      await db.workPlanActivity.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
    }
  });
});
