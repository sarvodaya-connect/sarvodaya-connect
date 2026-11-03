/**
 * V5 PR 6 database tests: the desktop home for the SPC (SP01), DDM (DD01)
 * and DM (DM01). Each role sees only the societies it covers; HQ and Society
 * Officers are refused. Every record is fictional and removed afterwards.
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

const DAY = 86_400_000;

describe('V5 desktop home (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const districtId = randomUUID();
  const farDistrictId = randomUUID();
  const mine = randomUUID();
  const neighbour = randomUUID();
  const far = randomUUID();
  const ids = {
    hq: randomUUID(),
    dm: randomUUID(),
    ddm: randomUUID(),
    ddm2: randomUUID(),
    spc: randomUUID(),
    so: randomUUID(),
    farSpc: randomUUID(),
  };
  const tokens: Record<keyof typeof ids, string> = {} as never;
  const home = (token?: string) => {
    const req = request(app.getHttpServer()).get('/api/v1/home');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
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
    const now = Date.now();

    await db.district.createMany({
      data: [
        { id: districtId, code: `H${suffix}`, nameEn: `Home ${suffix}` },
        { id: farDistrictId, code: `F${suffix}`, nameEn: `Far ${suffix}` },
      ],
    });
    await db.society.createMany({
      data: [
        {
          id: mine,
          societyCode: `HM-${suffix}`,
          nameEn: 'Fictional Assigned Society',
          districtId,
          status: 'ACTIVE',
          grade: 'B',
          memberCount: 120,
        },
        {
          id: neighbour,
          societyCode: `HN-${suffix}`,
          nameEn: 'Fictional Neighbour Society',
          districtId,
          status: 'ACTIVE',
          grade: 'C',
          memberCount: 80,
          updatedAt: new Date(now - 200 * DAY),
        },
        {
          id: far,
          societyCode: `HF-${suffix}`,
          nameEn: 'Fictional Far Society',
          districtId: farDistrictId,
          status: 'ACTIVE',
          grade: 'A',
        },
      ],
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `home.${role.toLowerCase()}.${id.slice(0, 6)}`,
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
          societyIds: [mine],
        }),
        account(ids.ddm2, 'DEPUTY_DISTRICT_MANAGER', { districtId }),
        account(ids.spc, 'PROGRAMME_COORDINATOR', {
          districtId,
          societyIds: [mine, neighbour],
        }),
        account(ids.so, 'SOCIETY_OFFICER', { districtId, societyIds: [mine] }),
        account(ids.farSpc, 'PROGRAMME_COORDINATOR', {
          districtId: farDistrictId,
          societyIds: [far],
        }),
      ],
    });
    await db.gradeChangeRequest.create({
      data: {
        societyId: mine,
        fromGrade: 'B',
        toGrade: 'A',
        reason: 'Fictional: plan complete',
        requestedById: ids.spc,
        requestedByName: 'Fictional SPC',
        requestedByRole: 'PROGRAMME_COORDINATOR',
      },
    });
    await db.workPlanActivity.create({
      data: {
        societyId: mine,
        year: new Date().getUTCFullYear() + 1,
        month: 3,
        name: 'Fictional youth camp',
        description: 'Fictional',
        allocatedCost: 1000,
        status: 'WAITING_FOR_SPC',
      },
    });
    await db.emergencyIncident.create({
      data: {
        districtId,
        title: 'Fictional flood',
        type: 'FLOOD',
        severity: 'HIGH',
        description: 'Fictional',
        location: 'Fictional village',
        createdById: ids.so,
      },
    });
    await db.districtAccessGrant.create({
      data: {
        districtId,
        deputyId: ids.ddm2,
        grantedById: ids.dm,
        startsAt: new Date(now - DAY),
        expiresAt: new Date(now + 3 * DAY),
        reason: 'Fictional: DM on leave',
      },
    });
    await db.platformAuditEvent.createMany({
      data: [
        {
          actorId: ids.so,
          actorName: 'Fictional Officer',
          actorRole: 'SOCIETY_OFFICER',
          action: 'SOCIETY_MEMBERSHIP_UPDATED',
          targetId: mine,
          societyId: mine,
          detail: 'Members 412 → 418',
        },
        {
          actorId: ids.hq,
          action: 'MEMBER_NIC_REVEALED',
          targetId: mine,
          societyId: mine,
        },
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
      const societies = [mine, neighbour, far];
      const districts = [districtId, farDistrictId];
      await db.platformAuditEvent.deleteMany({
        where: {
          OR: [
            { societyId: { in: societies } },
            { actorId: { in: Object.values(ids) } },
          ],
        },
      });
      await db.districtAccessGrant.deleteMany({
        where: { districtId: { in: districts } },
      });
      await db.emergencyIncident.deleteMany({
        where: { districtId: { in: districts } },
      });
      await db.workPlanActivity.deleteMany({
        where: { societyId: { in: societies } },
      });
      await db.gradeChangeRequest.deleteMany({
        where: { societyId: { in: societies } },
      });
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({ where: { id: { in: societies } } });
      await db.district.deleteMany({ where: { id: { in: districts } } });
    }
    await app?.close();
  });

  it('refuses HQ, Society Officers and anyone signed out', async () => {
    await home().expect(401);
    await home(tokens.hq).expect(403);
    await home(tokens.so).expect(403);
  });

  it('SP01: the SPC sees only assigned societies, the activity to approve and the latest changes', async () => {
    const { body } = await home(tokens.spc).expect(200);
    expect(body.role).toBe('PROGRAMME_COORDINATOR');
    expect(body.societies).toMatchObject({
      total: 2,
      grades: { A: 0, B: 1, C: 1 },
    });
    expect(body.activitiesWaiting).toBe(1);
    expect(body.gradeRequests.pending).toBe(1);
    expect(body.notUpdated.societyNames).toEqual([
      'Fictional Neighbour Society',
    ]);
    expect(body.societiesWithPlan).toBe(1);
    expect(body.needsAttention[0]).toMatchObject({
      societyName: 'Fictional Assigned Society',
      reason: 'Activity to approve: Fictional youth camp',
      editable: true,
    });
    // NIC views never appear in the feed.
    expect(body.recent.map((r: { action: string }) => r.action)).toEqual([
      'SOCIETY_MEMBERSHIP_UPDATED',
    ]);
    expect(body.incidents).toHaveLength(1);
    expect(body.incidents[0].openedByName).toMatch(
      /^Fictional SOCIETY_OFFICER/,
    );
    expect(JSON.stringify(body)).not.toContain('Fictional Far Society');
  });

  it('DD01: a DDM sees their assigned society, and the district count only with temporary access', async () => {
    const own = (await home(tokens.ddm).expect(200)).body;
    expect(own.societies.total).toBe(1);
    expect(own.districtViewCount).toBeNull();
    expect(own.temporaryAccess).toEqual([]);
    expect(own.activitiesWaiting).toBe(0);
    expect(own.district.id).toBe(districtId);

    const granted = (await home(tokens.ddm2).expect(200)).body;
    expect(granted.societies.total).toBe(0);
    expect(granted.districtViewCount).toBe(2);
    expect(granted.temporaryAccess).toHaveLength(1);
  });

  it('DM01: the DM sees the whole district, view only, with staff and active grants', async () => {
    const { body } = await home(tokens.dm).expect(200);
    expect(body.viewOnly).toBe(true);
    expect(body.societies).toMatchObject({ total: 2, members: 200 });
    expect(
      body.needsAttention.every(
        (item: { editable: boolean }) => !item.editable,
      ),
    ).toBe(true);
    expect(
      body.staff.map((s: { role: string; societyCount: number }) => [
        s.role,
        s.societyCount,
      ]),
    ).toEqual([
      ['DEPUTY_DISTRICT_MANAGER', 1],
      ['PROGRAMME_COORDINATOR', 2],
    ]);
    expect(body.temporaryAccess[0].deputyName).toMatch(
      /^Fictional DEPUTY_DISTRICT_MANAGER/,
    );
    expect(JSON.stringify(body)).not.toContain('Fictional Far Society');
  });

  it('keeps another district out entirely', async () => {
    const { body } = await home(tokens.farSpc).expect(200);
    expect(body.societies.total).toBe(1);
    expect(body.incidents).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('Fictional Assigned Society');
  });

  it('SP02 / DM02: the society list keeps to the same scope, and refuses HQ and Society Officers', async () => {
    const list = (token: string, query = '') =>
      request(app.getHttpServer())
        .get(`/api/v1/home/societies${query}`)
        .set('Authorization', `Bearer ${token}`);
    await list(tokens.hq).expect(403);
    await list(tokens.so).expect(403);

    const spc = (await list(tokens.spc).expect(200)).body;
    expect(spc.scopeTotal).toBe(2);
    expect(spc.data.every((r: { editable: boolean }) => r.editable)).toBe(true);
    const assigned = spc.data.find((r: { id: string }) => r.id === mine);
    expect(assigned).toMatchObject({
      pendingGrade: { from: 'B', to: 'A' },
      officerName: expect.stringMatching(/^Fictional SOCIETY_OFFICER/),
    });
    expect(
      (await list(tokens.spc, '?needsUpdate=true').expect(200)).body.data.map(
        (r: { nameEn: string }) => r.nameEn,
      ),
    ).toEqual(['Fictional Neighbour Society']);

    const dm = (await list(tokens.dm, '?grade=C').expect(200)).body;
    expect(dm.viewOnly).toBe(true);
    expect(dm.data.map((r: { nameEn: string }) => r.nameEn)).toEqual([
      'Fictional Neighbour Society',
    ]);
    expect(dm.data[0].editable).toBe(false);

    const far = (await list(tokens.farSpc).expect(200)).body;
    expect(JSON.stringify(far)).not.toContain('Fictional Assigned Society');
    await list(tokens.dm, '?pageSize=500').expect(400);
  });
});
