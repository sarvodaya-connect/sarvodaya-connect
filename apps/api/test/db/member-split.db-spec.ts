/**
 * Issue #141 database tests: female and male members on the society profile.
 * The total is worked out by the API, a database check keeps the three in
 * step, and HQ, DM, DDM and SPC Membership count each society once with its
 * latest saved values. Every record is fictional and removed afterwards.
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

describe('profile female and male members (PostgreSQL, issue #141)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const districtId = randomUUID();
  const farDistrictId = randomUUID();
  /** Total only (an older record) until the officer enters the split. */
  const a01 = randomUUID();
  /** Split already entered. */
  const b02 = randomUUID();
  /** Inactive: never counted. */
  const closed = randomUUID();
  const far = randomUUID();
  const societies = [a01, b02, closed, far];
  const ids = {
    hq: randomUUID(),
    dm: randomUUID(),
    ddm: randomUUID(),
    spc: randomUUID(),
    so: randomUUID(),
    farSo: randomUUID(),
    farSpc: randomUUID(),
  };
  const tokens: Record<keyof typeof ids, string> = {} as never;
  const api = (method: 'get' | 'patch', path: string, who: keyof typeof ids) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${tokens[who]}`);
  const profileOf = async (who: keyof typeof ids) =>
    (await api('get', '/home/membership', who).expect(200)).body.profile;
  const save = (body: object, who: keyof typeof ids = 'so') =>
    api('patch', `/societies/${a01}/profile`, who).send(body);

  /** HQ counts every active society; these are the ones outside this test. */
  async function others() {
    const [row] = await db.$queryRaw<
      { members: number; female: number; male: number; withSplit: number }[]
    >`
      SELECT COALESCE(SUM(member_count), 0)::int AS members,
        COALESCE(SUM(female_members), 0)::int AS female,
        COALESCE(SUM(male_members), 0)::int AS male,
        COUNT(female_members)::int AS "withSplit"
      FROM societies
      WHERE status = 'ACTIVE' AND NOT (id = ANY(${societies}::uuid[]))`;
    return row!;
  }

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
        { id: districtId, code: `M${suffix}`, nameEn: `Members ${suffix}` },
        { id: farDistrictId, code: `X${suffix}`, nameEn: `Far ${suffix}` },
      ],
    });
    const society = (
      id: string,
      code: string,
      name: string,
      extra: object,
    ) => ({
      id,
      societyCode: `${code}-${suffix}`,
      nameEn: name,
      districtId,
      addressLine: '1 Fictional Lane',
      status: 'ACTIVE' as const,
      ...extra,
    });
    await db.society.createMany({
      data: [
        society(a01, 'A01', 'Fictional Test Society A01', { memberCount: 400 }),
        society(b02, 'B02', 'Fictional Test Society B02', {
          memberCount: 15,
          femaleMembers: 10,
          maleMembers: 5,
        }),
        society(closed, 'C03', 'Fictional Closed Society', {
          status: 'INACTIVE',
          memberCount: 100,
          femaleMembers: 50,
          maleMembers: 50,
        }),
        society(far, 'F04', 'Fictional Far Society', {
          districtId: farDistrictId,
          memberCount: 10,
          femaleMembers: 7,
          maleMembers: 3,
        }),
      ],
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `split.${role.toLowerCase()}.${id.slice(0, 6)}`,
      displayName: `Fictional ${role} ${id.slice(0, 4)}`,
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
        account(ids.dm, 'DISTRICT_MANAGER', { districtId }),
        account(ids.ddm, 'DEPUTY_DISTRICT_MANAGER', {
          districtId,
          societyIds: [a01],
        }),
        account(ids.spc, 'PROGRAMME_COORDINATOR', {
          districtId,
          societyIds: [a01, b02],
        }),
        account(ids.so, 'SOCIETY_OFFICER', { districtId, societyIds: [a01] }),
        account(ids.farSo, 'SOCIETY_OFFICER', {
          districtId: farDistrictId,
          societyIds: [far],
        }),
        account(ids.farSpc, 'PROGRAMME_COORDINATOR', {
          districtId: farDistrictId,
          societyIds: [far],
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
        where: {
          OR: [
            { societyId: { in: societies } },
            { actorId: { in: Object.values(ids) } },
          ],
        },
      });
      await db.societyMembershipCount.deleteMany({
        where: { societyId: { in: societies } },
      });
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({ where: { id: { in: societies } } });
      await db.district.deleteMany({
        where: { id: { in: [districtId, farDistrictId] } },
      });
    }
    await app?.close();
  });

  it('keeps an older total-only record and says its split is not entered', async () => {
    const record = await api('get', `/societies/${a01}`, 'so').expect(200);
    expect(record.body).toMatchObject({
      memberCount: 400,
      femaleMembers: null,
      maleMembers: null,
    });
    expect(await profileOf('dm')).toEqual({
      societies: 2,
      members: 415,
      withoutBreakdown: 2,
      withSplit: 1,
      female: 10,
      male: 5,
    });
  });

  it('refuses a split that the database check does not allow', async () => {
    await expect(
      db.society.update({ where: { id: a01 }, data: { femaleMembers: 5 } }),
    ).rejects.toThrow();
    await expect(
      db.society.update({
        where: { id: a01 },
        data: { femaleMembers: 5, maleMembers: 5, memberCount: 11 },
      }),
    ).rejects.toThrow();
    await expect(
      db.society.update({
        where: { id: a01 },
        data: { femaleMembers: -1, maleMembers: 11, memberCount: 10 },
      }),
    ).rejects.toThrow();
    const row = await db.society.findUniqueOrThrow({ where: { id: a01 } });
    expect(row).toMatchObject({
      memberCount: 400,
      femaleMembers: null,
      maleMembers: null,
    });
  });

  it('saves female 25 and male 17 as a total of 42 and keeps it on reopening', async () => {
    const saved = await save({ femaleMembers: 25, maleMembers: 17 }).expect(
      200,
    );
    expect(saved.body).toMatchObject({
      memberCount: 42,
      femaleMembers: 25,
      maleMembers: 17,
    });
    const reopened = await api('get', `/societies/${a01}`, 'so').expect(200);
    expect(reopened.body).toMatchObject({
      memberCount: 42,
      femaleMembers: 25,
      maleMembers: 17,
    });
    // The DM can read it too, but cannot change it.
    await api('get', `/societies/${a01}`, 'dm').expect(200);
  });

  it('counts the society exactly once in every Membership view that may see it', async () => {
    // DM: the district (A01 and B02). SPC: both assigned. DDM: A01 only.
    for (const who of ['dm', 'spc'] as const) {
      expect(await profileOf(who)).toMatchObject({
        societies: 2,
        members: 57,
        withSplit: 2,
        female: 35,
        male: 22,
      });
    }
    expect(await profileOf('ddm')).toMatchObject({
      societies: 1,
      members: 42,
      withSplit: 1,
      female: 25,
      male: 17,
    });
    // Another district's SPC sees only their own society.
    expect(await profileOf('farSpc')).toMatchObject({
      members: 10,
      female: 7,
      male: 3,
    });
    const rest = await others();
    const hq = await api('get', '/national/membership', 'hq').expect(200);
    expect(hq.body.profile).toMatchObject({
      members: rest.members + 42 + 15 + 10,
      female: rest.female + 25 + 10 + 7,
      male: rest.male + 17 + 5 + 3,
      withSplit: rest.withSplit + 3,
    });
  });

  it('raises the total by 5 when female goes to 30, and not again on a retry', async () => {
    const before = await profileOf('dm');
    await save({ femaleMembers: 30, maleMembers: 17 }).expect(200);
    const after = await profileOf('dm');
    expect(after.members - before.members).toBe(5);
    expect(after.female - before.female).toBe(5);
    const changes = await db.platformAuditEvent.count({
      where: { societyId: a01 },
    });
    const retry = await save({ femaleMembers: 30, maleMembers: 17 }).expect(
      200,
    );
    expect(retry.body.memberCount).toBe(47);
    expect(await profileOf('dm')).toEqual(after);
    expect(
      await db.platformAuditEvent.count({ where: { societyId: a01 } }),
    ).toBe(changes);
  });

  it('lowers the figures when a count goes down', async () => {
    const before = await profileOf('spc');
    await save({ femaleMembers: 20, maleMembers: 12 }).expect(200);
    const after = await profileOf('spc');
    expect(after).toMatchObject({
      members: before.members - 15,
      female: before.female - 10,
      male: before.male - 5,
    });
  });

  it('rejects invalid counts and leaves the saved ones as they were', async () => {
    for (const body of [
      { femaleMembers: 2.5, maleMembers: 1 },
      { femaleMembers: -1, maleMembers: 1 },
      { femaleMembers: 1_000_001, maleMembers: 0 },
      { femaleMembers: 600_000, maleMembers: 500_000 },
      { femaleMembers: '25', maleMembers: 17 },
      { femaleMembers: 25 },
      { femaleMembers: 25, maleMembers: 17, memberCount: 50 },
      // An app from before #141 sending a total that contradicts the split.
      { memberCount: 99 },
    ]) {
      await save(body).expect(400);
    }
    const record = await api('get', `/societies/${a01}`, 'so').expect(200);
    expect(record.body).toMatchObject({
      memberCount: 32,
      femaleMembers: 20,
      maleMembers: 12,
    });
  });

  it('accepts an entered zero as a count', async () => {
    await save({ femaleMembers: 0, maleMembers: 12 }).expect(200);
    expect(await profileOf('ddm')).toMatchObject({
      members: 12,
      withSplit: 1,
      female: 0,
      male: 12,
    });
  });

  it('lets no one outside the society change or read the figures', async () => {
    await save({ femaleMembers: 1, maleMembers: 1 }, 'farSo').expect(403);
    await save({ femaleMembers: 1, maleMembers: 1 }, 'farSpc').expect(403);
    await save({ femaleMembers: 1, maleMembers: 1 }, 'dm').expect(403);
    const outside = await api('get', `/societies/${a01}`, 'farSpc');
    expect([403, 404]).toContain(outside.status);
    const row = await db.society.findUniqueOrThrow({ where: { id: a01 } });
    expect(row).toMatchObject({ femaleMembers: 0, maleMembers: 12 });
  });

  it('keeps category counts apart from profile counts', async () => {
    await db.societyMembershipCount.create({
      data: {
        societyId: b02,
        year: 2026,
        category: 'YOUTH',
        female: 6,
        male: 4,
      },
    });
    const view = await api('get', '/home/membership', 'dm').expect(200);
    // Category figures: only what was entered by category.
    expect(view.body).toMatchObject({
      year: 2026,
      societiesReported: 1,
      female: 6,
      male: 4,
      total: 10,
    });
    // Profile figures: unchanged by the category counts, and not added to them.
    expect(view.body.profile).toMatchObject({
      members: 27,
      female: 10,
      male: 17,
      withoutBreakdown: 1,
    });
  });
});
