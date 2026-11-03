/**
 * Society map pins (GET /societies/map and the HQ D02 map, GET /national/map)
 * through the HTTP API against a real PostgreSQL with the migrations applied.
 * Every record here is fictional and removed afterwards.
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

const HOUR = 60 * 60 * 1000;
type Pin = { id: string; [key: string]: unknown };

describe('Society map pins within each role’s scope (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let hqToken: string;
  const suffix = randomUUID().slice(0, 8);
  const districtA = randomUUID();
  const districtB = randomUUID();
  // a1 and a3 have a position; a2 and b2 do not; a3 is not active.
  const [a1, a2, a3, b1, b2] = Array.from({ length: 5 }, () => randomUUID());
  const societies = [a1, a2, a3, b1, b2];
  const hqId = randomUUID();
  const accounts: string[] = [hqId];
  const tokens: Record<string, { id: string; token: string }> = {};

  const http = () => request(app.getHttpServer());
  const get = (token: string, path: string) =>
    http().get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
  const ids = (body: { points: Pin[] }) =>
    body.points.map((point) => point.id).sort();

  async function account(
    label: string,
    role: string,
    districtId: string,
    societyIds: string[],
  ) {
    const username = `map.${label}.${suffix}`;
    const created = await http()
      .post('/api/v1/identity/accounts')
      .set('Authorization', `Bearer ${hqToken}`)
      .send({
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

    await db.district.createMany({
      data: [
        {
          id: districtA,
          code: `MA${suffix}`,
          nameEn: `Map A ${suffix}`,
          province: 'Fictional Province',
        },
        {
          id: districtB,
          code: `MB${suffix}`,
          nameEn: `Map B ${suffix}`,
          province: 'Fictional Province',
        },
      ],
    });
    const code = (letter: string) => `S-M${letter}${suffix.toUpperCase()}`;
    await db.society.createMany({
      data: [
        {
          id: a1,
          societyCode: code('1'),
          nameEn: `Fictional Pinfield ${suffix}`,
          districtId: districtA,
          status: 'ACTIVE',
          grade: 'A',
          latitude: 7.29,
          longitude: 80.63,
        },
        {
          id: a2,
          societyCode: code('2'),
          nameEn: `Fictional Nopin ${suffix}`,
          districtId: districtA,
          status: 'ACTIVE',
          grade: 'B',
        },
        {
          id: a3,
          societyCode: code('3'),
          nameEn: `Fictional Closedpin ${suffix}`,
          districtId: districtA,
          status: 'INACTIVE',
          latitude: 7.31,
          longitude: 80.61,
        },
        {
          id: b1,
          societyCode: code('4'),
          nameEn: `Fictional Farpin ${suffix}`,
          districtId: districtB,
          status: 'ACTIVE',
          grade: 'C',
          latitude: 6.05,
          longitude: 80.22,
        },
        {
          id: b2,
          societyCode: code('5'),
          nameEn: `Fictional Farnopin ${suffix}`,
          districtId: districtB,
          status: 'ACTIVE',
        },
      ],
    });
    await db.societyContact.create({
      data: {
        societyId: a1,
        label: 'Secretary',
        phone: '+94000000077',
        isPrimary: true,
      },
    });

    await db.platformAccount.create({
      data: {
        id: hqId,
        username: `map.hq.${suffix}`,
        displayName: 'Fictional HQ',
        role: 'HQ_ADMIN',
        phone: '+94000000000',
        status: 'ACTIVE',
        passwordHash: passwordHash('test-password-123'),
      },
    });
    const login = await http()
      .post('/api/v1/identity/login')
      .send({ username: `map.hq.${suffix}`, password: 'test-password-123' })
      .expect(201);
    hqToken = login.body.token;
    tokens.dm = await account('dm', 'DISTRICT_MANAGER', districtA, []);
    tokens.spc = await account('spc', 'PROGRAMME_COORDINATOR', districtA, [a1]);
    tokens.so = await account('so', 'SOCIETY_OFFICER', districtA, [a2]);
    tokens.ddm = await account('ddm', 'DEPUTY_DISTRICT_MANAGER', districtA, [
      a1,
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db.districtAccessGrant.deleteMany({
        where: { districtId: { in: [districtA, districtB] } },
      });
      await db.platformAuditEvent.deleteMany({
        where: {
          OR: [
            { actorId: { in: accounts } },
            { districtId: { in: [districtA, districtB] } },
          ],
        },
      });
      await db.platformAccount.deleteMany({ where: { id: { in: accounts } } });
      await db.societyContact.deleteMany({
        where: { societyId: { in: societies } },
      });
      await db.society.deleteMany({ where: { id: { in: societies } } });
      await db.district.deleteMany({
        where: { id: { in: [districtA, districtB] } },
      });
    }
    await app?.close();
  });

  it('refuses a request without a sign-in', async () => {
    await http().get('/api/v1/societies/map').expect(401);
  });

  it('gives HQ every located society and counts the active ones without a position', async () => {
    const map = (await get(hqToken, '/societies/map').expect(200)).body;
    const found = ids(map);
    expect(found).toEqual(expect.arrayContaining([a1, a3, b1]));
    expect(found).not.toContain(a2);
    expect(found).not.toContain(b2);
    expect(map.withoutLocation).toBeGreaterThanOrEqual(2);
    expect(map.truncated).toBe(false);
  });

  it('returns only the pin fields, never contacts or other personal data', async () => {
    const map = (await get(hqToken, '/societies/map').expect(200)).body;
    const pin = map.points.find((point: Pin) => point.id === a1);
    expect(pin).toEqual({
      id: a1,
      name: `Fictional Pinfield ${suffix}`,
      societyCode: `S-M1${suffix.toUpperCase()}`,
      grade: 'A',
      status: 'ACTIVE',
      latitude: 7.29,
      longitude: 80.63,
      district: `Map A ${suffix}`,
    });
    expect(JSON.stringify(map)).not.toContain('+9400000');
  });

  it('gives a DM their own district only', async () => {
    const map = (await get(tokens.dm!.token, '/societies/map').expect(200))
      .body;
    expect(ids(map)).toEqual([a1, a3].sort());
    expect(map.withoutLocation).toBe(1);
  });

  it('gives an SPC and a Society Officer their assigned societies only', async () => {
    const spc = (await get(tokens.spc!.token, '/societies/map').expect(200))
      .body;
    expect(ids(spc)).toEqual([a1]);
    expect(spc.withoutLocation).toBe(0);
    // The officer's one society has no position: counted, not plotted.
    const so = (await get(tokens.so!.token, '/societies/map').expect(200))
      .body;
    expect(so.points).toEqual([]);
    expect(so.withoutLocation).toBe(1);
  });

  it('adds a DDM’s current temporary district, and drops it once it has ended', async () => {
    const before = (await get(tokens.ddm!.token, '/societies/map').expect(200))
      .body;
    expect(ids(before)).toEqual([a1]);

    const grant = await db.districtAccessGrant.create({
      data: {
        districtId: districtB,
        deputyId: tokens.ddm!.id,
        grantedById: tokens.dm!.id,
        startsAt: new Date(Date.now() - HOUR),
        expiresAt: new Date(Date.now() + HOUR),
        reason: 'Fictional: map scope test',
      },
    });
    const during = (await get(tokens.ddm!.token, '/societies/map').expect(200))
      .body;
    expect(ids(during)).toEqual([a1, b1].sort());
    expect(during.withoutLocation).toBe(1);

    await db.districtAccessGrant.update({
      where: { id: grant.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const after = (await get(tokens.ddm!.token, '/societies/map').expect(200))
      .body;
    expect(ids(after)).toEqual([a1]);
  });

  it('keeps the D02 national map for HQ only, with the district on each pin', async () => {
    for (const role of ['dm', 'spc', 'so', 'ddm'])
      await get(tokens[role]!.token, '/national/map').expect(403);
    const map = (await get(hqToken, '/national/map?status=ALL').expect(200))
      .body;
    expect(map.points).toContainEqual(
      expect.objectContaining({ id: b1, class: 'C', district: `Map B ${suffix}` }),
    );
    expect(map.points.some((point: Pin) => point.id === b2)).toBe(false);
    expect(map.truncated).toBe(false);
  });
});
