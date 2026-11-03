/**
 * V5 PR 7 database tests: temporary district access (DM04, DM05, DD02, DD04,
 * DD06, DD07; phone M30–M32). A DM gives a DDM view-only access to the whole
 * district for a set time; the DDM's next request after an early end or the
 * end time no longer sees the district. Every record is fictional.
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

describe('V5 temporary district access (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const districtId = randomUUID();
  const otherDistrictId = randomUUID();
  const own = randomUUID();
  const neighbour = randomUUID();
  const far = randomUUID();
  const ids = {
    hq: randomUUID(),
    dm: randomUUID(),
    otherDm: randomUUID(),
    ddm: randomUUID(),
    ddm2: randomUUID(),
    farDdm: randomUUID(),
    spc: randomUUID(),
  };
  const tokens: Record<keyof typeof ids, string> = {} as never;
  const api = (
    method: 'get' | 'post',
    path: string,
    token: string,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);
    return body ? req.send(body) : req;
  };
  const give = (
    token: string,
    deputyId: string,
    hours: number,
    extra: object = {},
  ) =>
    api('post', '/identity/district-access', token, {
      deputyId,
      districtId,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + hours * HOUR).toISOString(),
      ...extra,
    });

  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY = '22'.repeat(32);
    process.env.DISTRICT_ACCESS_MAX_DAYS = '7';
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
        { id: districtId, code: `T${suffix}`, nameEn: `Temp ${suffix}` },
        { id: otherDistrictId, code: `O${suffix}`, nameEn: `Other ${suffix}` },
      ],
    });
    await db.society.createMany({
      data: [
        {
          id: own,
          societyCode: `TO-${suffix}`,
          nameEn: 'Fictional Own Society',
          districtId,
          status: 'ACTIVE',
          grade: 'B',
        },
        {
          id: neighbour,
          societyCode: `TN-${suffix}`,
          nameEn: 'Fictional Neighbour Society',
          districtId,
          status: 'ACTIVE',
          grade: 'C',
        },
        {
          id: far,
          societyCode: `TF-${suffix}`,
          nameEn: 'Fictional Far Society',
          districtId: otherDistrictId,
          status: 'ACTIVE',
        },
      ],
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `temp.${role.toLowerCase()}.${id.slice(0, 6)}`,
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
        account(ids.otherDm, 'DISTRICT_MANAGER', {
          districtId: otherDistrictId,
        }),
        account(ids.ddm, 'DEPUTY_DISTRICT_MANAGER', {
          districtId,
          societyIds: [own],
        }),
        account(ids.ddm2, 'DEPUTY_DISTRICT_MANAGER', { districtId }),
        account(ids.farDdm, 'DEPUTY_DISTRICT_MANAGER', {
          districtId: otherDistrictId,
        }),
        account(ids.spc, 'PROGRAMME_COORDINATOR', {
          districtId,
          societyIds: [own],
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
    delete process.env.DISTRICT_ACCESS_MAX_DAYS;
    if (db) {
      const districts = [districtId, otherDistrictId];
      const grants = await db.districtAccessGrant.findMany({
        where: { districtId: { in: districts } },
        select: { id: true },
      });
      await db.platformAuditEvent.deleteMany({
        where: {
          OR: [
            { districtId: { in: districts } },
            { targetId: { in: grants.map((g) => g.id) } },
            { actorId: { in: Object.values(ids) } },
          ],
        },
      });
      await db.districtAccessGrant.deleteMany({
        where: { districtId: { in: districts } },
      });
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({
        where: { id: { in: [own, neighbour, far] } },
      });
      await db.district.deleteMany({ where: { id: { in: districts } } });
    }
    await app?.close();
  });

  it('DM05: only the DM of the district gives access, to a DDM of that district, within the maximum', async () => {
    await give(tokens.spc, ids.ddm, 4).expect(403);
    await give(tokens.hq, ids.ddm, 4).expect(403);
    await give(tokens.otherDm, ids.ddm, 4).expect(403);
    await give(tokens.dm, ids.farDdm, 4).expect(400);
    const tooLong = await give(tokens.dm, ids.ddm, 24 * 8).expect(400);
    expect(tooLong.body.error.message).toBe(
      'Temporary access can last at most 7 days.',
    );
    await give(tokens.dm, ids.ddm, 4, {
      startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    }).expect(400);
  });

  it('DM04 / DD02 / DD04 / DD06: a grant opens the whole district, view only, and records what is opened', async () => {
    // The reason is optional (DM05).
    const granted = await give(tokens.dm, ids.ddm, 4).expect(201);
    expect(granted.body).toMatchObject({
      status: 'ACTIVE',
      reason: '',
      deputy: { id: ids.ddm },
      grantedBy: { name: expect.stringMatching(/^Fictional DISTRICT_MANAGER/) },
      district: { societyCount: 2 },
      societiesOpened: 0,
    });
    const overlap = await give(tokens.dm, ids.ddm, 2).expect(409);
    expect(overlap.body.error.message).toMatch(/already has temporary access/);

    const list = (query = '') =>
      api('get', `/home/societies${query}`, tokens.ddm).expect(200);
    const mine = (await list()).body;
    expect(mine).toMatchObject({
      scope: 'MINE',
      tabs: { mine: 1, district: 2 },
    });
    const district = (await list('?scope=DISTRICT')).body;
    expect(district.scope).toBe('DISTRICT');
    const rows = Object.fromEntries(
      district.data.map((r: { nameEn: string }) => [r.nameEn, r]),
    );
    expect(rows['Fictional Own Society']).toMatchObject({
      yours: true,
      editable: true,
    });
    expect(rows['Fictional Neighbour Society']).toMatchObject({
      yours: false,
      editable: false,
    });
    expect(JSON.stringify(district)).not.toContain('Fictional Far Society');
    expect(
      (await list('?scope=DISTRICT&assignedToMe=false')).body.data.map(
        (r: { nameEn: string }) => r.nameEn,
      ),
    ).toEqual(['Fictional Neighbour Society']);

    // DD06: the record is view only, and opening it is recorded once.
    const record = await api(
      'get',
      `/societies/${neighbour}`,
      tokens.ddm,
    ).expect(200);
    expect(record.body.permissions).toMatchObject({
      canEdit: false,
      viewOnlyReason: 'TEMPORARY_DISTRICT_ACCESS',
    });
    await api('get', `/societies/${neighbour}`, tokens.ddm).expect(200);
    await api('get', `/societies/${own}`, tokens.ddm).expect(200);
    await api('get', `/societies/${far}`, tokens.ddm).expect(404);

    const home = (await api('get', '/home', tokens.ddm).expect(200)).body;
    expect(home.districtViewCount).toBe(2);
    expect(home.temporaryAccess[0]).toMatchObject({
      societiesOpened: 1,
      districtSocietyCount: 2,
    });

    // DM04 / M32: the DM sees the grant and its history; the DDM sees their own.
    const grants = (
      await api('get', '/identity/district-access', tokens.dm).expect(200)
    ).body;
    expect(grants.maxDays).toBe(7);
    expect(grants.data[0]).toMatchObject({
      status: 'ACTIVE',
      societiesOpened: 1,
    });
    const detail = (
      await api(
        'get',
        `/identity/district-access/${granted.body.id}`,
        tokens.ddm,
      ).expect(200)
    ).body;
    expect(
      detail.history.map((h: { kind: string; societyName?: string }) =>
        h.societyName ? `${h.kind}:${h.societyName}` : h.kind,
      ),
    ).toEqual(['OPENED:Fictional Neighbour Society', 'STARTED', 'GIVEN']);
    await api(
      'get',
      `/identity/district-access/${granted.body.id}`,
      tokens.ddm2,
    ).expect(404);
    await api('get', '/identity/district-access', tokens.spc).expect(403);
  });

  it('End now: the DDM loses the district on the next request; the home shows it ended (DD07)', async () => {
    const [grant] = (
      await api('get', '/identity/district-access', tokens.dm).expect(200)
    ).body.data;
    await api(
      'post',
      `/identity/district-access/${grant.id}/revoke`,
      tokens.otherDm,
    ).expect(404);
    await api(
      'post',
      `/identity/district-access/${grant.id}/revoke`,
      tokens.dm,
    ).expect(201);
    await api(
      'post',
      `/identity/district-access/${grant.id}/revoke`,
      tokens.dm,
    ).expect(409);

    await api('get', `/societies/${neighbour}`, tokens.ddm).expect(404);
    await api('get', '/home/societies?scope=DISTRICT', tokens.ddm).expect(403);
    const home = (await api('get', '/home', tokens.ddm).expect(200)).body;
    expect(home.districtViewCount).toBeNull();
    expect(home.recentlyEnded).toMatchObject({
      endedEarly: true,
      districtName: `Temp ${suffix}`,
    });
    const after = (
      await api('get', '/identity/district-access', tokens.dm).expect(200)
    ).body.data[0];
    expect(after).toMatchObject({
      status: 'ENDED_EARLY',
      endedEarly: {
        byName: expect.stringMatching(/^Fictional DISTRICT_MANAGER/),
      },
    });
  });

  it('a grant that reached its end time stops working with no scheduler', async () => {
    await db.districtAccessGrant.create({
      data: {
        districtId,
        deputyId: ids.ddm2,
        grantedById: ids.dm,
        startsAt: new Date(Date.now() - 5 * HOUR),
        expiresAt: new Date(Date.now() - HOUR),
        reason: 'Fictional: ended on its own',
      },
    });
    await api('get', `/societies/${neighbour}`, tokens.ddm2).expect(404);
    const home = (await api('get', '/home', tokens.ddm2).expect(200)).body;
    expect(home.recentlyEnded).toMatchObject({ endedEarly: false });
    const grants = (
      await api('get', '/identity/district-access', tokens.ddm2).expect(200)
    ).body.data;
    expect(grants[0].status).toBe('ENDED');
  });
});
