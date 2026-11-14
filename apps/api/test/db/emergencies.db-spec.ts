/**
 * V5 PR 8 database tests: disaster response on every role (D30–D33,
 * IR01–IR05, M40–M49, M48n). Each role opens, assesses and closes within its
 * own scope; only HQ assigns response actions and makes situation reports;
 * notifications reach only the people whose scope covers the societies
 * involved. Every record is fictional.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('V5 disaster response (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let storageDir: string;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const districtId = randomUUID();
  const secondDistrictId = randomUUID();
  const farDistrictId = randomUUID();
  const own = randomUUID();
  const neighbour = randomUUID();
  const helper = randomUUID();
  const coast = randomUUID();
  const far = randomUUID();
  const ids = {
    hq: randomUUID(),
    dm: randomUUID(),
    otherDm: randomUUID(),
    ddm: randomUUID(),
    ddmTemporary: randomUUID(),
    officer: randomUUID(),
    spc: randomUUID(),
    helperSpc: randomUUID(),
    farSpc: randomUUID(),
  };
  const tokens: Record<keyof typeof ids, string> = {} as never;
  const api = (
    method: 'get' | 'post' | 'patch',
    path: string,
    token: string,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);
    return body ? req.send(body) : req;
  };
  const openBody = (societyId: string, extra: object = {}) => ({
    type: 'FLOOD',
    reportingSocietyId: societyId,
    districtIds: [districtId],
    description: 'Fictional canal overflow near the village.',
    startedAt: new Date(Date.now() - HOUR).toISOString(),
    ...extra,
  });
  const assessment = (societyId: string, extra: object = {}) => ({
    clientMutationId: randomUUID(),
    societyId,
    impact: 'AFFECTED',
    families: 84,
    people: 310,
    housesFully: 6,
    housesPartly: 31,
    injured: 3,
    displaced: 40,
    roadAccess: 'PARTLY_BLOCKED',
    needs: ['DRINKING_WATER', 'DRY_RATIONS'],
    note: 'Fictional note.',
    confirmedWithPresident: true,
    ...extra,
  });
  const notificationTitles = async (token: string) =>
    (
      await api('get', '/notifications?pageSize=50', token).expect(200)
    ).body.data.map((n: { title: string }) => n.title) as string[];

  let incidentId: string;

  beforeAll(async () => {
    process.env.NIC_ENCRYPTION_KEY = '33'.repeat(32);
    storageDir = await mkdtemp(join(tmpdir(), 'pr8-db-'));
    process.env.LOCAL_STORAGE_DIR = storageDir;
    process.env.STORAGE_SIGNING_SECRET = 'db-test-only-secret';
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
        { id: districtId, code: `I${suffix}`, nameEn: `Incident ${suffix}` },
        {
          id: secondDistrictId,
          code: `S${suffix}`,
          nameEn: `Second ${suffix}`,
        },
        { id: farDistrictId, code: `F${suffix}`, nameEn: `Far ${suffix}` },
      ],
    });
    const society = (
      id: string,
      code: string,
      nameEn: string,
      district: string,
      latitude?: number,
    ) => ({
      id,
      societyCode: `${code}-${suffix}`,
      nameEn,
      districtId: district,
      status: 'ACTIVE' as const,
      latitude: latitude ?? null,
      longitude: latitude ? 80.36 : null,
    });
    await db.society.createMany({
      data: [
        society(own, 'IO', 'Fictional Own Society', districtId, 7.48),
        society(
          neighbour,
          'IN',
          'Fictional Neighbour Society',
          districtId,
          7.6,
        ),
        society(helper, 'IH', 'Fictional Helper Society', districtId, 7.5),
        society(coast, 'IC', 'Fictional Coast Society', secondDistrictId),
        society(far, 'IF', 'Fictional Far Society', farDistrictId),
      ],
    });
    const account = (
      id: string,
      role: string,
      opts: { districtId?: string; societyIds?: string[] } = {},
    ) => ({
      id,
      username: `inc.${role.toLowerCase()}.${id.slice(0, 6)}`,
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
        account(ids.otherDm, 'DISTRICT_MANAGER', { districtId: farDistrictId }),
        account(ids.ddm, 'DEPUTY_DISTRICT_MANAGER', {
          districtId,
          societyIds: [own],
        }),
        account(ids.ddmTemporary, 'DEPUTY_DISTRICT_MANAGER', { districtId }),
        account(ids.officer, 'SOCIETY_OFFICER', {
          districtId,
          societyIds: [own],
        }),
        account(ids.spc, 'PROGRAMME_COORDINATOR', {
          districtId,
          societyIds: [own, neighbour],
        }),
        account(ids.helperSpc, 'PROGRAMME_COORDINATOR', {
          districtId,
          societyIds: [helper],
        }),
        account(ids.farSpc, 'PROGRAMME_COORDINATOR', {
          districtId: farDistrictId,
          societyIds: [far],
        }),
      ],
    });
    // DD02: view-only access to the incident district for a few hours.
    await db.districtAccessGrant.create({
      data: {
        districtId,
        deputyId: ids.ddmTemporary,
        grantedById: ids.dm,
        startsAt: new Date(Date.now() - HOUR),
        expiresAt: new Date(Date.now() + 4 * HOUR),
        reason: 'Fictional leave',
      },
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
      const districts = [districtId, secondDistrictId, farDistrictId];
      const incidents = await db.emergencyIncident.findMany({
        where: { districtId: { in: districts } },
        select: { id: true },
      });
      await db.platformAuditEvent.deleteMany({
        where: {
          OR: [
            { targetId: { in: incidents.map((i) => i.id) } },
            { actorId: { in: Object.values(ids) } },
          ],
        },
      });
      await db.notification.deleteMany({
        where: { recipientUserId: { in: Object.values(ids) } },
      });
      await db.emergencyIncident.deleteMany({
        where: { id: { in: incidents.map((i) => i.id) } },
      });
      await db.districtAccessGrant.deleteMany({
        where: { districtId: { in: districts } },
      });
      await db.accountSession.deleteMany({
        where: { accountId: { in: Object.values(ids) } },
      });
      await db.platformAccount.deleteMany({
        where: { id: { in: Object.values(ids) } },
      });
      await db.society.deleteMany({
        where: { id: { in: [own, neighbour, helper, coast, far] } },
      });
      await db.district.deleteMany({ where: { id: { in: districts } } });
    }
    await app?.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  it('IR02 / M48: each role opens an incident only for a society it acts for', async () => {
    // Society Officer, SPC and DDM: their assigned societies only.
    await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(neighbour),
    ).expect(403);
    await api(
      'post',
      '/emergencies/incidents',
      tokens.ddm,
      openBody(neighbour),
    ).expect(403);
    // A DDM's temporary district view is view only.
    await api(
      'post',
      '/emergencies/incidents',
      tokens.ddmTemporary,
      openBody(neighbour),
    ).expect(403);
    // A DM acts for their own district only.
    await api(
      'post',
      '/emergencies/incidents',
      tokens.otherDm,
      openBody(own),
    ).expect(403);
    await api(
      'post',
      '/emergencies/incidents',
      tokens.farSpc,
      openBody(own),
    ).expect(403);
    // Validation: unknown district and a start in the future.
    await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(own, { districtIds: [randomUUID()] }),
    ).expect(400);
    await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(own, {
        startedAt: new Date(Date.now() + 3 * HOUR).toISOString(),
      }),
    ).expect(400);

    const opened = await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(own, { districtIds: [districtId, secondDistrictId] }),
    ).expect(201);
    incidentId = opened.body.id;
    expect(opened.body).toMatchObject({
      reference: expect.stringMatching(/^INC-\d{4}-\d{2,}$/),
      status: 'ACTIVE',
      title: `Floods — Incident ${suffix}, Second ${suffix}`,
      reportingSociety: { id: own, name: 'Fictional Own Society' },
      openedBy: {
        name: expect.stringMatching(/^Fictional SOCIETY_OFFICER/),
        role: 'SOCIETY_OFFICER',
      },
      societiesInArea: 4,
      assessed: 0,
    });
    // Due two days after it started when the opener gives no time.
    const due =
      Date.parse(opened.body.assessmentsDueAt) -
      Date.parse(opened.body.startedAt);
    expect(due).toBe(48 * HOUR);

    // A DM and HQ can open for their district or nationally.
    await api(
      'post',
      '/emergencies/incidents',
      tokens.dm,
      openBody(neighbour),
    ).expect(201);
    await api(
      'post',
      '/emergencies/incidents',
      tokens.hq,
      openBody(far, {
        districtIds: [farDistrictId],
        title: 'Fictional far fire',
        type: 'FIRE',
      }),
    ).expect(201);
  });

  it('IR02 / M48: opening with the same client id twice returns one incident', async () => {
    const clientMutationId = randomUUID();
    const body = openBody(own, { clientMutationId });
    const first = await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      body,
    ).expect(201);
    const again = await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      body,
    ).expect(201);
    expect(again.body.id).toBe(first.body.id);
    expect(
      await db.emergencyIncident.count({ where: { clientMutationId } }),
    ).toBe(1);
  });

  it('IR02 / M48: a different client id opens a separate incident', async () => {
    const a = await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(own, { clientMutationId: randomUUID() }),
    ).expect(201);
    const b = await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(own, { clientMutationId: randomUUID() }),
    ).expect(201);
    expect(b.body.id).not.toBe(a.body.id);
  });

  it('IR02 / M48: a client id reused for another report is refused', async () => {
    const clientMutationId = randomUUID();
    await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(own, { clientMutationId }),
    ).expect(201);
    await api(
      'post',
      '/emergencies/incidents',
      tokens.officer,
      openBody(own, { clientMutationId, type: 'FIRE' }),
    ).expect(409);
  });

  it('IR02 / M48: two taps at the same moment open one incident', async () => {
    const clientMutationId = randomUUID();
    const body = openBody(own, { clientMutationId });
    const [x, y] = await Promise.all([
      api('post', '/emergencies/incidents', tokens.officer, body),
      api('post', '/emergencies/incidents', tokens.officer, body),
    ]);
    expect([x.status, y.status]).toEqual([201, 201]);
    expect(x.body.id).toBe(y.body.id);
    expect(
      await db.emergencyIncident.count({ where: { clientMutationId } }),
    ).toBe(1);
  });

  it('D30 / IR02: the open form lists only the societies each role may report for', async () => {
    const options = async (token: string, query = '') =>
      (
        await api('get', `/emergencies/report-options${query}`, token).expect(
          200,
        )
      ).body;
    const ids = (body: { societies: { id: string }[] }) =>
      body.societies.map((s) => s.id).sort();
    expect(ids(await options(tokens.officer))).toEqual([own]);
    expect(ids(await options(tokens.spc))).toEqual([own, neighbour].sort());
    // Temporary access is view only, so the district's societies are not offered.
    expect(ids(await options(tokens.ddmTemporary))).toEqual([]);
    expect(ids(await options(tokens.dm))).toEqual(
      [own, neighbour, helper].sort(),
    );
    const hq = await options(
      tokens.hq,
      `?search=${encodeURIComponent('Fictional Coast')}`,
    );
    expect(ids(hq)).toEqual([coast]);
    expect(hq.districts.map((d: { id: string }) => d.id)).toEqual(
      expect.arrayContaining([districtId, secondDistrictId, farDistrictId]),
    );
  });

  it('IR05 / M48n: notifies only people whose scope covers the area, never the opener', async () => {
    const title = `New incident: Floods — Incident ${suffix}, Second ${suffix}`;
    for (const key of [
      'hq',
      'dm',
      'ddm',
      'ddmTemporary',
      'spc',
      'helperSpc',
    ] as const) {
      expect(await notificationTitles(tokens[key])).toContain(title);
    }
    for (const key of ['officer', 'otherDm', 'farSpc'] as const) {
      expect(await notificationTitles(tokens[key])).not.toContain(title);
    }
  });

  it('D30 / IR01: each role sees incidents covering its scope; others get not found', async () => {
    const list = await api(
      'get',
      '/emergencies/incidents',
      tokens.officer,
    ).expect(200);
    expect(list.body.data.map((i: { id: string }) => i.id)).toContain(
      incidentId,
    );
    expect(list.body.counts.active).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(list.body)).not.toContain('Fictional far fire');

    const far = await api(
      'get',
      '/emergencies/incidents',
      tokens.farSpc,
    ).expect(200);
    expect(far.body.data.map((i: { title: string }) => i.title)).toEqual([
      'Fictional far fire',
    ]);
    await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.farSpc,
    ).expect(404);
    await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.otherDm,
    ).expect(404);

    const officer = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.officer,
    ).expect(200);
    expect(officer.body.permissions).toEqual({
      canAssess: true,
      canClose: true,
      canAssign: false,
      canReport: false,
    });
    expect(
      officer.body.assessableSocieties.map((s: { id: string }) => s.id),
    ).toEqual([own]);
    expect(officer.body.history[0]).toMatchObject({
      action: 'INCIDENT_OPENED',
      societyName: 'Fictional Own Society',
    });

    const temporary = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.ddmTemporary,
    ).expect(200);
    expect(temporary.body.permissions).toEqual({
      canAssess: false,
      canClose: false,
      canAssign: false,
      canReport: false,
    });

    const dm = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.dm,
    ).expect(200);
    expect(dm.body.assessableSocieties).toHaveLength(3);

    const hq = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.hq,
    ).expect(200);
    expect(hq.body.permissions).toEqual({
      canAssess: true,
      canClose: true,
      canAssign: true,
      canReport: true,
    });
    expect(hq.body.assessableSocieties).toHaveLength(4);
  });

  it('IR03 / M41–M43: assessments are sent for own societies only, and retries are safe', async () => {
    const path = `/emergencies/incidents/${incidentId}/assessments`;
    await api('post', path, tokens.officer, assessment(neighbour)).expect(403);
    await api('post', path, tokens.ddmTemporary, assessment(neighbour)).expect(
      403,
    );
    await api('post', path, tokens.farSpc, assessment(far)).expect(404);
    await api('post', path, tokens.hq, assessment(far)).expect(400);
    await api('post', path, tokens.officer, {
      ...assessment(own),
      families: -1,
    }).expect(400);

    const first = assessment(own);
    const sent = await api('post', path, tokens.officer, first).expect(201);
    expect(sent.body.replayed).toBe(false);
    const retry = await api('post', path, tokens.officer, first).expect(201);
    expect(retry.body).toMatchObject({ id: sent.body.id, replayed: true });
    // A later update replaces the first in the counts.
    await api(
      'post',
      path,
      tokens.officer,
      assessment(own, { impact: 'CRITICAL', families: 90, people: 320 }),
    ).expect(201);
    await api(
      'post',
      path,
      tokens.dm,
      assessment(neighbour, {
        impact: 'SAFE',
        families: 0,
        people: 0,
        housesFully: 0,
        housesPartly: 0,
        needs: [],
      }),
    ).expect(201);
    await api(
      'post',
      path,
      tokens.spc,
      assessment(neighbour, {
        impact: 'AFFECTED',
        families: 10,
        people: 40,
        housesFully: 1,
        housesPartly: 2,
        needs: ['DRINKING_WATER'],
      }),
    ).expect(201);

    const { body } = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.hq,
    ).expect(200);
    expect(body.totals).toMatchObject({
      societiesInArea: 4,
      assessed: 2,
      notAssessed: 2,
      affected: 2,
      critical: 1,
      families: 100,
      people: 360,
      housesFully: 7,
      housesPartly: 33,
    });
    expect(body.totals.needs).toEqual([
      { need: 'DRINKING_WATER', societies: 2 },
      { need: 'DRY_RATIONS', societies: 1 },
    ]);

    const mine = await api(
      'get',
      `/emergencies/incidents/${incidentId}/societies/${own}`,
      tokens.officer,
    ).expect(200);
    expect(mine.body.updates.map((u: { number: number }) => u.number)).toEqual([
      2, 1,
    ]);
    expect(mine.body.row).toMatchObject({
      state: 'CRITICAL',
      families: 90,
      updates: 2,
      canAssess: true,
    });
    await api(
      'get',
      `/emergencies/incidents/${incidentId}/societies/${neighbour}`,
      tokens.officer,
    ).expect(404);
  });

  it('D31: the society table keeps to each role’s scope, a page at a time', async () => {
    const rows = async (token: string, query = '') =>
      (
        await api(
          'get',
          `/emergencies/incidents/${incidentId}/societies${query}`,
          token,
        ).expect(200)
      ).body;
    expect(
      (await rows(tokens.officer)).data.map(
        (r: { society: { id: string } }) => r.society.id,
      ),
    ).toEqual([own]);
    expect((await rows(tokens.spc)).meta.totalItems).toBe(2);
    expect((await rows(tokens.ddmTemporary)).meta.totalItems).toBe(3);
    const hq = await rows(tokens.hq, '?state=NOT_ASSESSED&pageSize=1');
    expect(hq.meta).toMatchObject({
      totalItems: 2,
      totalPages: 2,
      pageSize: 1,
    });
    expect(hq.data[0].state).toBe('NOT_ASSESSED');
  });

  it('D32 / M45 / M46: only HQ adds needs and assigns helpers; the helping society updates delivery', async () => {
    const need = (extra: object = {}) => ({
      clientMutationId: randomUUID(),
      societyId: own,
      need: 'DRINKING_WATER',
      title: 'Drinking water',
      quantity: 300,
      unit: 'L',
      ...extra,
    });
    for (const key of ['officer', 'spc', 'ddm', 'dm'] as const) {
      await api(
        'post',
        `/emergencies/incidents/${incidentId}/actions`,
        tokens[key],
        need(),
      ).expect(403);
    }
    await api(
      'post',
      `/emergencies/incidents/${incidentId}/actions`,
      tokens.hq,
      need({ societyId: far }),
    ).expect(400);
    const created = await api(
      'post',
      `/emergencies/incidents/${incidentId}/actions`,
      tokens.hq,
      need(),
    ).expect(201);
    const actionId = created.body.id;

    const before = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.officer,
    ).expect(200);
    expect(before.body.actions[0]).toMatchObject({
      id: actionId,
      state: 'NEEDED',
      helpers: [],
    });

    await api(
      'get',
      `/emergencies/actions/${actionId}/candidates`,
      tokens.dm,
    ).expect(403);
    const candidates = await api(
      'get',
      `/emergencies/actions/${actionId}/candidates`,
      tokens.hq,
    ).expect(200);
    // Not affected first (nearest first), affected societies last, never the one in need.
    expect(
      candidates.body.map(
        (c: {
          society: { id: string };
          state: string;
          distanceKm: number | null;
        }) => [c.society.id, c.state, c.distanceKm],
      ),
    ).toEqual([
      [helper, 'NOT_ASSESSED', 2],
      [coast, 'NOT_ASSESSED', null],
      [neighbour, 'AFFECTED', 13],
    ]);

    const assign = {
      helpers: [{ societyId: helper, quantity: 200 }],
      dueAt: new Date(Date.now() + 24 * HOUR).toISOString(),
      note: 'Fictional: use the school entrance.',
    };
    await api(
      'post',
      `/emergencies/actions/${actionId}/helpers`,
      tokens.dm,
      assign,
    ).expect(403);
    await api(
      'post',
      `/emergencies/actions/${actionId}/helpers`,
      tokens.hq,
      assign,
    ).expect(201);
    await api(
      'post',
      `/emergencies/actions/${actionId}/helpers`,
      tokens.hq,
      assign,
    ).expect(409);
    expect(
      (await notificationTitles(tokens.helperSpc)).some((t) =>
        t.startsWith('Helpers assigned: Drinking water'),
      ),
    ).toBe(true);
    expect(
      (await notificationTitles(tokens.farSpc)).some((t) =>
        t.startsWith('Helpers assigned'),
      ),
    ).toBe(false);

    const assigned = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.helperSpc,
    ).expect(200);
    const row = assigned.body.actions.find(
      (a: { id: string }) => a.id === actionId,
    );
    expect(row).toMatchObject({ state: 'ASSIGNED', forSociety: { id: own } });
    const helperId = row.helpers[0].id;
    expect(row.helpers[0].canUpdate).toBe(true);

    const officerView = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.officer,
    ).expect(200);
    expect(officerView.body.actions[0].helpers[0].canUpdate).toBe(false);

    const delivery = { status: 'IN_PROGRESS', deliveredQuantity: 120 };
    await api(
      'patch',
      `/emergencies/helpers/${helperId}`,
      tokens.officer,
      delivery,
    ).expect(403);
    await api(
      'patch',
      `/emergencies/helpers/${helperId}`,
      tokens.farSpc,
      delivery,
    ).expect(404);
    await api('patch', `/emergencies/helpers/${helperId}`, tokens.helperSpc, {
      ...delivery,
      deliveredQuantity: 201,
    }).expect(400);
    await api('patch', `/emergencies/helpers/${helperId}`, tokens.helperSpc, {
      status: 'DELIVERED',
      deliveredQuantity: 200,
    }).expect(400);
    await api(
      'patch',
      `/emergencies/helpers/${helperId}`,
      tokens.helperSpc,
      delivery,
    ).expect(200);
    const progress = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.hq,
    ).expect(200);
    expect(progress.body.actions[0]).toMatchObject({
      state: 'IN_PROGRESS',
      delivered: 120,
    });
    await api('patch', `/emergencies/helpers/${helperId}`, tokens.helperSpc, {
      status: 'DELIVERED',
      deliveredQuantity: 200,
      deliveredOn: '2026-10-26',
    }).expect(200);
    const done = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.hq,
    ).expect(200);
    expect(done.body.actions[0].state).toBe('DELIVERED');
    expect(done.body.totals).toMatchObject({ actions: 1, actionsDelivered: 1 });
  });

  it('M41 / M46: photos go to storage by pre-signed URL, with no personal data in the key', async () => {
    const { body } = await api(
      'get',
      `/emergencies/incidents/${incidentId}/societies/${own}`,
      tokens.officer,
    ).expect(200);
    const assessmentId = body.updates[0].id;
    const photo = { contentType: 'image/jpeg', sizeBytes: 120_000 };
    await api(
      'post',
      `/emergencies/assessments/${assessmentId}/evidence`,
      tokens.farSpc,
      photo,
    ).expect(404);
    await api(
      'post',
      `/emergencies/assessments/${assessmentId}/evidence`,
      tokens.ddmTemporary,
      photo,
    ).expect(403);
    await api(
      'post',
      `/emergencies/assessments/${assessmentId}/evidence`,
      tokens.officer,
      { ...photo, sizeBytes: 11_000_000 },
    ).expect(400);
    await api(
      'post',
      `/emergencies/assessments/${assessmentId}/evidence`,
      tokens.officer,
      { ...photo, contentType: 'image/gif' },
    ).expect(400);
    const created = await api(
      'post',
      `/emergencies/assessments/${assessmentId}/evidence`,
      tokens.officer,
      photo,
    ).expect(201);
    expect(created.body.upload).toMatchObject({ method: 'PUT' });
    expect(JSON.stringify(created.body)).not.toContain('Fictional');
    const stored = await db.emergencyEvidence.findUniqueOrThrow({
      where: { id: created.body.evidence.id },
    });
    expect(stored.storageKey).toBe(
      `incidents/${incidentId}/assessments/${stored.id}.jpg`,
    );
    // Not uploaded yet: completing fails and nobody can download it.
    await api(
      'post',
      `/emergencies/evidence/${stored.id}/complete`,
      tokens.officer,
    ).expect(409);
    await api(
      'post',
      `/emergencies/evidence/${stored.id}/complete`,
      tokens.spc,
    ).expect(404);
    await api(
      'post',
      `/emergencies/evidence/${stored.id}/download`,
      tokens.hq,
    ).expect(404);
  });

  it('D33 / M47: only HQ makes numbered situation reports; everyone in scope reads them', async () => {
    const make = (token: string) =>
      api(
        'post',
        `/emergencies/incidents/${incidentId}/situation-reports`,
        token,
        {
          clientMutationId: randomUUID(),
          summary: 'Fictional summary.',
        },
      );
    for (const key of ['officer', 'spc', 'ddm', 'dm'] as const)
      await make(tokens[key]).expect(403);
    const first = await make(tokens.hq).expect(201);
    const second = await make(tokens.hq).expect(201);
    expect([first.body.number, second.body.number]).toEqual([1, 2]);
    const report = await api(
      'get',
      `/emergencies/situation-reports/${first.body.id}`,
      tokens.officer,
    ).expect(200);
    expect(report.body.snapshot.totals).toMatchObject({
      affected: 2,
      families: 100,
      notAssessed: 2,
    });
    expect(report.body.snapshot.items).toEqual([
      {
        need: 'DRINKING_WATER',
        title: 'Drinking water',
        unit: 'L',
        needed: 300,
        delivered: 200,
        helpingSocieties: 1,
      },
    ]);
    await api(
      'get',
      `/emergencies/situation-reports/${first.body.id}`,
      tokens.farSpc,
    ).expect(404);
  });

  it('D31: HQ reminds societies that have not sent an assessment', async () => {
    await api(
      'post',
      `/emergencies/incidents/${incidentId}/reminders`,
      tokens.dm,
    ).expect(403);
    const sent = await api(
      'post',
      `/emergencies/incidents/${incidentId}/reminders`,
      tokens.hq,
    ).expect(201);
    expect(sent.body.societies).toBe(2);
    expect(
      (await notificationTitles(tokens.helperSpc)).some((t) =>
        t.startsWith('Assessment due'),
      ),
    ).toBe(true);
    // The Own Society already sent one.
    expect(
      (await notificationTitles(tokens.officer)).some((t) =>
        t.startsWith('Assessment due'),
      ),
    ).toBe(false);
  });

  it('DD01 / SP01: the role home banner shows the incident with its reference and deadline', async () => {
    const { body } = await api('get', '/home', tokens.spc).expect(200);
    expect(body.incidents).toContainEqual(
      expect.objectContaining({
        id: incidentId,
        reference: expect.stringMatching(/^INC-/),
        assessmentsDueAt: expect.any(String),
      }),
    );
    const farHome = await api('get', '/home', tokens.farSpc).expect(200);
    expect(
      farHome.body.incidents.map((i: { id: string }) => i.id),
    ).not.toContain(incidentId);
  });

  it('IR04 / M49: closing records who closed it and when, and stops new assessments', async () => {
    const close = (token: string) =>
      api('post', `/emergencies/incidents/${incidentId}/close`, token);
    await close(tokens.farSpc).expect(404);
    await close(tokens.ddmTemporary).expect(403);
    const closed = await close(tokens.ddm).expect(201);
    expect(closed.body).toMatchObject({
      status: 'CLOSED',
      closedBy: {
        name: expect.stringMatching(/^Fictional DEPUTY_DISTRICT_MANAGER/),
        role: 'DEPUTY_DISTRICT_MANAGER',
      },
      closedAt: expect.any(String),
    });
    await close(tokens.hq).expect(409);
    await api(
      'post',
      `/emergencies/incidents/${incidentId}/assessments`,
      tokens.officer,
      assessment(own),
    ).expect(409);
    const detail = await api(
      'get',
      `/emergencies/incidents/${incidentId}`,
      tokens.officer,
    ).expect(200);
    expect(detail.body.permissions).toEqual({
      canAssess: false,
      canClose: false,
      canAssign: false,
      canReport: false,
    });
    expect(detail.body.history[0]).toMatchObject({ action: 'INCIDENT_CLOSED' });
    expect(await notificationTitles(tokens.officer)).toContain(
      `Incident closed: Floods — Incident ${suffix}, Second ${suffix}`,
    );
    expect(await notificationTitles(tokens.farSpc)).not.toContain(
      `Incident closed: Floods — Incident ${suffix}, Second ${suffix}`,
    );
    const closedList = await api(
      'get',
      '/emergencies/incidents?status=CLOSED',
      tokens.officer,
    ).expect(200);
    expect(closedList.body.data.map((i: { id: string }) => i.id)).toContain(
      incidentId,
    );
  });
});
