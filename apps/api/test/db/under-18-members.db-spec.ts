/**
 * Issue #143 database tests: members under 18 and the membership Last
 * updated time. Under 18s are a part of the total, a database check keeps
 * them there, and only a changed membership figure moves the time. Every
 * record is fictional and removed afterwards.
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

describe('members under 18 and membership Last updated (PostgreSQL, issue #143)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const districtId = randomUUID();
  const farDistrictId = randomUUID();
  /** Total only (an older record) until the officer enters the figures. */
  const a01 = randomUUID();
  const far = randomUUID();
  const societies = [a01, far];
  const ids = { dm: randomUUID(), so: randomUUID(), farSo: randomUUID() };
  const tokens: Record<keyof typeof ids, string> = {} as never;
  const api = (method: 'get' | 'patch', path: string, who: keyof typeof ids) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${tokens[who]}`);
  const save = (body: object, who: keyof typeof ids = 'so') =>
    api('patch', `/societies/${a01}/profile`, who).send(body);
  const reopen = async () =>
    (await api('get', `/societies/${a01}`, 'so').expect(200)).body;

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
        { id: districtId, code: `U${suffix}`, nameEn: `Under 18 ${suffix}` },
        { id: farDistrictId, code: `Y${suffix}`, nameEn: `Far ${suffix}` },
      ],
    });
    await db.society.createMany({
      data: [
        {
          id: a01,
          societyCode: `A01-${suffix}`,
          nameEn: 'Fictional Test Society A01',
          districtId,
          addressLine: '1 Fictional Lane',
          status: 'ACTIVE',
          memberCount: 400,
        },
        {
          id: far,
          societyCode: `F04-${suffix}`,
          nameEn: 'Fictional Far Society',
          districtId: farDistrictId,
          addressLine: '2 Fictional Lane',
          status: 'ACTIVE',
        },
      ],
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId: string; societyIds?: string[] },
    ) => ({
      id,
      username: `u18.${role.toLowerCase()}.${id.slice(0, 6)}`,
      displayName: `Fictional ${role} ${id.slice(0, 4)}`,
      phone: '+94000000000',
      role,
      status: 'ACTIVE',
      passwordHash: passwordHash('test-password-123'),
      districtId: opts.districtId,
      societyIds: opts.societyIds ?? [],
    });
    await db.platformAccount.createMany({
      data: [
        account(ids.dm, 'DISTRICT_MANAGER', { districtId }),
        account(ids.so, 'SOCIETY_OFFICER', { districtId, societyIds: [a01] }),
        account(ids.farSo, 'SOCIETY_OFFICER', {
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

  it('keeps an older total-only record with nothing guessed', async () => {
    expect(await reopen()).toMatchObject({
      memberCount: 400,
      femaleMembers: null,
      maleMembers: null,
      under18Members: null,
      membershipUpdatedAt: null,
    });
  });

  it('refuses under 18s that the database check does not allow', async () => {
    // Without the split, more than the total, or negative.
    for (const data of [
      { under18Members: 5 },
      {
        femaleMembers: 25,
        maleMembers: 17,
        memberCount: 42,
        under18Members: 43,
      },
      {
        femaleMembers: 25,
        maleMembers: 17,
        memberCount: 42,
        under18Members: -1,
      },
    ]) {
      await expect(
        db.society.update({ where: { id: a01 }, data }),
      ).rejects.toThrow();
    }
    expect(await reopen()).toMatchObject({
      memberCount: 400,
      under18Members: null,
    });
  });

  it('saves female 25, male 17 and under 18s 10 as a total of 42 with its time', async () => {
    const before = Date.now();
    await save({
      femaleMembers: 25,
      maleMembers: 17,
      under18Members: 10,
    }).expect(200);
    const record = await reopen();
    expect(record).toMatchObject({
      memberCount: 42,
      femaleMembers: 25,
      maleMembers: 17,
      under18Members: 10,
    });
    const savedAt = Date.parse(record.membershipUpdatedAt);
    expect(savedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(savedAt).toBeLessThanOrEqual(Date.now() + 1000);
    // The DM's Membership view counts the total, not total + under 18s.
    const view = await api('get', '/home/membership', 'dm').expect(200);
    expect(view.body.profile).toMatchObject({
      members: 42,
      female: 25,
      male: 17,
    });
  });

  it('leaves the time alone for another profile edit or a retried save', async () => {
    const { membershipUpdatedAt } = await reopen();
    await save({ businessDescription: 'Fictional coir rope' }).expect(200);
    await save({
      femaleMembers: 25,
      maleMembers: 17,
      under18Members: 10,
    }).expect(200);
    const record = await reopen();
    expect(record.businessDescription).toBe('Fictional coir rope');
    expect(record.membershipUpdatedAt).toBe(membershipUpdatedAt);
  });

  it('refuses invalid counts and keeps the saved figures and time', async () => {
    const before = await reopen();
    for (const body of [
      { femaleMembers: 25, maleMembers: 17, under18Members: 43 },
      { femaleMembers: 25, maleMembers: 17, under18Members: -1 },
      { femaleMembers: 25, maleMembers: 17, under18Members: 1.5 },
      { femaleMembers: 25, maleMembers: 17, under18Members: 2_000_000 },
      // A smaller split would leave the saved 10 under 18s above the total.
      { femaleMembers: 5, maleMembers: 4 },
    ]) {
      await save(body).expect(400);
    }
    const after = await reopen();
    expect(after).toMatchObject({
      memberCount: 42,
      under18Members: 10,
      membershipUpdatedAt: before.membershipUpdatedAt,
    });
  });

  it('lowers the figures and moves the time on a real change', async () => {
    const before = await reopen();
    await save({
      femaleMembers: 20,
      maleMembers: 17,
      under18Members: 8,
    }).expect(200);
    const after = await reopen();
    expect(after).toMatchObject({
      memberCount: 37,
      under18Members: 8,
    });
    expect(Date.parse(after.membershipUpdatedAt)).toBeGreaterThan(
      Date.parse(before.membershipUpdatedAt),
    );
    const view = await api('get', '/home/membership', 'dm').expect(200);
    expect(view.body.profile).toMatchObject({ members: 37, female: 20 });
  });

  it('lets no one outside the society change or read the figures', async () => {
    await save({ under18Members: 1 }, 'farSo').expect(403);
    const outside = await api('get', `/societies/${a01}`, 'farSo');
    expect([403, 404]).toContain(outside.status);
    expect((await reopen()).under18Members).toBe(8);
  });
});
