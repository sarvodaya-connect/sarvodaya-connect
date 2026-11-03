/**
 * V5 PR 5 database tests: the HQ National Dashboard figures, the society
 * directory and summary, search, HQ requests and reports, through the HTTP
 * API against a real PostgreSQL with the migrations applied. Every record
 * here is fictional and removed afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { calendarYear } from '../../src/national/national-rules.js';
import { sriLankaToday } from '../../src/national/requests.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { latestCompletedFinancialYear } from '../../src/societies/financial-year.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

describe('V5 PR 5 national dashboard, directory, search, requests and reports (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let hqToken: string;
  const suffix = randomUUID().slice(0, 8);
  const districtId = randomUUID();
  const strongId = randomUUID();
  const staleId = randomUUID();
  const closedId = randomUUID();
  const societies = [strongId, staleId, closedId];
  const hqId = randomUUID();
  const accounts: string[] = [hqId];
  const tokens: Record<string, { id: string; token: string }> = {};
  const fy = latestCompletedFinancialYear();
  const requestIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const api = (token: string) => ({
    get: (path: string) =>
      http().get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) =>
      http()
        .post(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
  });

  async function account(label: string, role: string, societyIds: string[]) {
    const username = `v5pr5.${label}.${suffix}`;
    const created = await api(hqToken)
      .post('/identity/accounts', {
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

    await db.district.create({
      data: {
        id: districtId,
        code: `N${suffix}`,
        nameEn: `PR5 test ${suffix}`,
        province: 'Fictional Province',
      },
    });
    await db.society.createMany({
      data: [
        {
          id: strongId,
          societyCode: `S-N${suffix.toUpperCase()}`,
          nameEn: `Fictional Strongfield ${suffix}`,
          districtId,
          status: 'ACTIVE',
          grade: 'A',
          memberCount: 120,
          establishedOn: new Date('2010-01-01'),
          addressLine: '1 Fictional Lane',
          village: 'Imaginary Village',
          gnDivision: 'Demo GN',
          dsDivision: 'Demo DS',
          latitude: 7.5,
          longitude: 80.4,
        },
        {
          id: staleId,
          societyCode: `S-O${suffix.toUpperCase()}`,
          nameEn: `Fictional Quietbrook ${suffix}`,
          districtId,
          status: 'ACTIVE',
          grade: 'C',
          dsDivision: 'Demo DS',
        },
        {
          id: closedId,
          societyCode: `S-P${suffix.toUpperCase()}`,
          nameEn: `Fictional Closedwell ${suffix}`,
          districtId,
          status: 'INACTIVE',
        },
      ],
    });
    // Not changed for more than 90 days.
    await db.$executeRaw`UPDATE societies SET updated_at = now() - interval '120 days' WHERE id = ${staleId}::uuid`;
    await db.societyContact.create({
      data: {
        societyId: strongId,
        fullName: 'Fictional Secretary',
        phone: '+94000000009',
        isPrimary: true,
      },
    });
    await db.societyMembershipCount.createMany({
      data: [
        {
          societyId: strongId,
          year: 2099,
          category: 'YOUTH',
          female: 30,
          male: 20,
        },
        {
          societyId: strongId,
          year: 2099,
          category: 'ORDINARY',
          female: 40,
          male: 30,
        },
      ],
    });
    await db.annualFinancialSummary.create({
      data: {
        societyId: strongId,
        financialYear: fy,
        totalProfit: '412500.00',
        totalExpenses: '1286000.00',
      },
    });
    await db.societyDocument.create({
      data: {
        societyId: strongId,
        documentType: 'AUDIT_REPORT',
        title: `Audit report FY ${fy}`,
        fileName: 'audit.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
        storageKey: `societies/${strongId}/audit-report/${suffix}.pdf`,
        uploadedById: hqId,
        uploadedByName: 'Fictional HQ',
        uploadedAt: new Date(),
        financialYear: fy,
      },
    });
    const activity = await db.workPlanActivity.create({
      data: {
        societyId: strongId,
        year: fy,
        month: 9,
        name: `Fictional tank cleaning ${suffix}`,
        description: 'Fictional',
        sector: 'Environment',
        allocatedCost: '1000',
        dimension: 'SOCIAL',
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });
    await db.workPlanActivitySdg.createMany({
      data: [6, 15].map((sdg) => ({ activityId: activity.id, sdg })),
    });

    await db.platformAccount.create({
      data: {
        id: hqId,
        username: `v5pr5.hq.${suffix}`,
        displayName: 'Fictional HQ',
        role: 'HQ_ADMIN',
        phone: '+94000000000',
        status: 'ACTIVE',
        passwordHash: passwordHash('test-password-123'),
      },
    });
    const login = await http()
      .post('/api/v1/identity/login')
      .send({ username: `v5pr5.hq.${suffix}`, password: 'test-password-123' })
      .expect(201);
    hqToken = login.body.token;
    tokens.so = await account('so', 'SOCIETY_OFFICER', [strongId]);
    tokens.spc = await account('spc', 'PROGRAMME_COORDINATOR', [
      strongId,
      staleId,
    ]);
    tokens.ddm = await account('ddm', 'DEPUTY_DISTRICT_MANAGER', [staleId]);
    tokens.dm = await account('dm', 'DISTRICT_MANAGER', []);
  });

  afterAll(async () => {
    if (db) {
      await db.informationRequest.deleteMany({
        where: { id: { in: requestIds } },
      });
      await db.notification.deleteMany({
        where: { recipientUserId: { in: accounts } },
      });
      await db.platformAuditEvent.deleteMany({
        where: { OR: [{ actorId: { in: accounts } }, { districtId }] },
      });
      await db.platformAccount.deleteMany({ where: { id: { in: accounts } } });
      await db.societyDocument.deleteMany({
        where: { societyId: { in: societies } },
      });
      await db.society.deleteMany({ where: { id: { in: societies } } });
      await db.district.deleteMany({ where: { id: districtId } });
    }
    await app?.close();
  });

  const hqOnly = [
    '/national/overview',
    '/national/districts',
    '/national/map',
    '/national/membership',
    '/national/programmes',
    '/national/finance',
    '/information-requests',
    '/hq-tasks',
    '/reports/society-status',
  ];

  it('refuses the national figures, requests and reports to every role but HQ', async () => {
    for (const role of ['so', 'spc', 'ddm', 'dm']) {
      for (const path of hqOnly) {
        await api(tokens[role]!.token).get(path).expect(403);
      }
      await api(tokens[role]!.token)
        .post('/information-requests', {
          audience: 'ALL_ACTIVE',
          title: 'Fictional request',
          dueOn: sriLankaToday(),
        })
        .expect(403);
    }
    await http().get('/api/v1/national/overview').expect(401);
  });

  it('gives HQ the national overview and the district card', async () => {
    const overview = await api(hqToken).get('/national/overview').expect(200);
    expect(overview.body.financialYear.startYear).toBe(fy);
    expect(overview.body.societies.active).toBeGreaterThanOrEqual(2);
    expect(overview.body.societies.registeredNotActive).toBeGreaterThanOrEqual(
      1,
    );
    expect(overview.body.districts).toContainEqual(
      expect.objectContaining({
        id: districtId,
        active: 2,
        latitude: 7.5,
        longitude: 80.4,
      }),
    );
    expect(overview.body.registrarDocuments.byType).toHaveLength(4);

    const districts = await api(hqToken).get('/national/districts').expect(200);
    expect(
      districts.body.data.find((row: { id: string }) => row.id === districtId),
    ).toMatchObject({
      province: 'Fictional Province',
      active: 2,
      grades: { A: 1, B: 0, C: 1, ungraded: 0 },
      recordsCompletePercent: 50,
      auditPercent: 50,
    });
    await api(hqToken).get('/national/overview?year=1990').expect(400);
  });

  it('counts the approved activity and its UN SDGs, and the yearly totals', async () => {
    const programmes = await api(hqToken)
      .get('/national/programmes')
      .expect(200);
    expect(programmes.body.sdgs).toHaveLength(17);
    expect(
      programmes.body.recent.map((row: { name: string }) => row.name),
    ).toContain(`Fictional tank cleaning ${suffix}`);
    const finance = await api(hqToken)
      .get('/national/finance?pageSize=100')
      .expect(200);
    expect(Number(finance.body.totalProfit)).toBeGreaterThanOrEqual(412500);
    expect(finance.body.meta.totalItems).toBe(finance.body.notSubmitted);
    const map = await api(hqToken).get('/national/map?grade=A').expect(200);
    expect(map.body.points).toContainEqual(
      expect.objectContaining({ id: strongId, class: 'A', latitude: 7.5 }),
    );
    expect(
      map.body.points.some((row: { id: string }) => row.id === staleId),
    ).toBe(false);
  });

  it('lists the directory within each role’s scope, with tabs and filters', async () => {
    const hq = await api(hqToken)
      .get(`/society-directory?districtId=${districtId}`)
      .expect(200);
    expect(hq.body.meta.totalItems).toBe(2);
    expect(hq.body.views).toMatchObject({
      all: 2,
      'not-updated': 1,
      'figures-not-added': 1,
    });
    expect(hq.body.grades).toEqual({ A: 1, B: 0, C: 1 });
    const strong = hq.body.data.find(
      (row: { id: string }) => row.id === strongId,
    );
    expect(strong).toMatchObject({
      grade: 'A',
      members: 120,
      figuresAdded: true,
      spc: { name: 'Fictional spc' },
      societyOfficer: { name: 'Fictional so' },
    });
    expect(JSON.stringify(hq.body)).not.toContain('+9400000');

    const stale = await api(hqToken)
      .get(`/society-directory?districtId=${districtId}&view=not-updated`)
      .expect(200);
    expect(stale.body.data.map((row: { id: string }) => row.id)).toEqual([
      staleId,
    ]);
    const withClosed = await api(hqToken)
      .get(`/society-directory?districtId=${districtId}&status=ALL`)
      .expect(200);
    expect(withClosed.body.meta.totalItems).toBe(3);
    const bySpc = await api(hqToken)
      .get(`/society-directory?spcId=${tokens.spc!.id}`)
      .expect(200);
    expect(bySpc.body.meta.totalItems).toBe(2);

    const so = await api(tokens.so!.token)
      .get('/society-directory')
      .expect(200);
    expect(so.body.data.map((row: { id: string }) => row.id)).toEqual([
      strongId,
    ]);
    const ddm = await api(tokens.ddm!.token)
      .get('/society-directory')
      .expect(200);
    expect(ddm.body.data.map((row: { id: string }) => row.id)).toEqual([
      staleId,
    ]);
    const dm = await api(tokens.dm!.token)
      .get(`/society-directory?districtId=${districtId}`)
      .expect(200);
    expect(dm.body.meta.totalItems).toBe(2);
  });

  it('shows the society summary only within scope', async () => {
    const summary = await api(tokens.so!.token)
      .get(`/societies/${strongId}/summary`)
      .expect(200);
    expect(summary.body).toMatchObject({
      grade: 'A',
      members: 120,
      recordsCompletePercent: 100,
      missingFields: 0,
      profit: '412500',
      hasSocietyOfficer: true,
      spcName: 'Fictional spc',
    });
    expect(summary.body.registrarDocuments).toContainEqual({
      documentType: 'AUDIT_REPORT',
      uploaded: true,
    });
    await api(tokens.so!.token)
      .get(`/societies/${staleId}/summary`)
      .expect(404);
    const other = await api(hqToken)
      .get(`/societies/${staleId}/summary`)
      .expect(200);
    expect(other.body).toMatchObject({
      hasSocietyOfficer: false,
      profit: null,
    });
    expect(other.body.activities.planned).toBe(0);
    expect(calendarYear()).toBeGreaterThan(2000);
  });

  it('searches only what the user may open, never phone numbers', async () => {
    const hq = await api(hqToken)
      .get(`/search?q=Quietbrook ${suffix}`)
      .expect(200);
    expect(hq.body.counts.society).toBe(1);
    expect(hq.body.data[0]).toMatchObject({
      type: 'society',
      href: `/societies/${staleId}`,
    });
    const so = await api(tokens.so!.token)
      .get(`/search?q=Quietbrook ${suffix}`)
      .expect(200);
    expect(so.body.counts.society).toBe(0);
    const phone = await api(hqToken).get('/search?q=000000009').expect(200);
    expect(phone.body.data).toEqual([]);
    const docs = await api(hqToken)
      .get(`/search?q=Strongfield ${suffix}&type=document`)
      .expect(200);
    expect(docs.body.data[0]).toMatchObject({
      type: 'document',
      title: `Audit report FY ${fy}/${String((fy + 1) % 100).padStart(2, '0')}`,
    });
    await api(hqToken).get('/search?q=a').expect(400);
  });

  it('lets HQ ask a district for information and the assigned staff respond', async () => {
    const dueOn = sriLankaToday(
      new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    );
    const created = await api(hqToken)
      .post('/information-requests', {
        audience: 'DISTRICT',
        districtId,
        title: 'Fictional signed AGM minutes',
        dueOn,
      })
      .expect(201);
    requestIds.push(created.body.id);
    expect(created.body).toMatchObject({
      societies: 2,
      responded: 0,
      status: 'OPEN',
      audienceLabel: `PR5 test ${suffix} District`,
    });

    // The Society Officer is told; the SPC is told for the society without one.
    const alerts = await api(tokens.so!.token)
      .get('/notifications?filter=records')
      .expect(200);
    expect(alerts.body.data[0]).toMatchObject({
      topic: 'INFORMATION_REQUEST',
      title: 'HQ request: Fictional signed AGM minutes',
      societyId: strongId,
    });
    const spcAlerts = await api(tokens.spc!.token)
      .get('/notifications')
      .expect(200);
    expect(spcAlerts.body.data[0]).toMatchObject({ societyId: staleId });
    const none = await api(tokens.so!.token)
      .get('/notifications?filter=incidents')
      .expect(200);
    expect(none.body.data).toEqual([]);

    const inbox = await api(tokens.so!.token)
      .get('/information-requests/inbox')
      .expect(200);
    expect(inbox.body.data).toContainEqual(
      expect.objectContaining({
        requestId: created.body.id,
        respondedAt: null,
      }),
    );
    const path = (societyId: string) =>
      `/information-requests/${created.body.id}/societies/${societyId}/respond`;
    await api(tokens.so!.token).post(path(staleId)).expect(403);
    await api(tokens.dm!.token).post(path(strongId)).expect(403);
    await api(hqToken).post(path(strongId)).expect(403);
    await api(tokens.so!.token)
      .post(path(strongId), { note: 'Uploaded' })
      .expect(200);
    await api(tokens.so!.token).post(path(strongId)).expect(409);
    await api(tokens.so!.token)
      .post(
        `/information-requests/${randomUUID()}/societies/${strongId}/respond`,
      )
      .expect(404);

    const tracker = await api(hqToken).get('/information-requests').expect(200);
    expect(
      tracker.body.data.find(
        (row: { id: string }) => row.id === created.body.id,
      ),
    ).toMatchObject({
      societies: 2,
      responded: 1,
    });
    await api(hqToken)
      .post('/information-requests', {
        audience: 'DISTRICT',
        title: 'No district',
        dueOn,
      })
      .expect(400);
    await api(hqToken)
      .post('/information-requests', {
        audience: 'ALL_ACTIVE',
        title: 'Past',
        dueOn: '2001-01-01',
      })
      .expect(400);
    const tasks = await api(hqToken).get('/hq-tasks').expect(200);
    expect(Array.isArray(tasks.body.data)).toBe(true);
  });

  it('builds reports for one district as JSON and CSV', async () => {
    const report = await api(hqToken)
      .get(`/reports/society-status?districtId=${districtId}`)
      .expect(200);
    expect(report.body).toMatchObject({
      scope: `PR5 test ${suffix} District`,
      rows: [
        {
          district: `PR5 test ${suffix}`,
          active: 2,
          a: 1,
          b: 0,
          c: 1,
          complete: '50%',
        },
      ],
    });
    const csv = await api(hqToken)
      .get(`/reports/data-quality?districtId=${districtId}&format=csv`)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(
      'District,Active,Records complete,Not updated in 90+ days,No map position',
    );
    expect(csv.text).toContain(`PR5 test ${suffix},2,50%,1,1`);
    for (const type of [
      'national-summary',
      'membership',
      'registrar-documents',
      'activities',
      'profit-expenses',
    ])
      await api(hqToken).get(`/reports/${type}`).expect(200);
    await api(hqToken).get('/reports/unknown').expect(400);
    await api(hqToken)
      .get(`/reports/membership?districtId=${randomUUID()}`)
      .expect(404);
  });
});
