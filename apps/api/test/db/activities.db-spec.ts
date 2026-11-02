/**
 * V5 PR 4 database tests: activities, SPC approval with UN SDGs, and the
 * Registrar documents, through the HTTP API against a real PostgreSQL with
 * the migrations applied. Every record here is fictional and removed after.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { plannableYears } from '../../src/activities/activities.service.js';
import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { passwordHash } from '../../src/identity/identity.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { latestCompletedFinancialYear } from '../../src/societies/financial-year.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

describe('V5 PR 4 activities, UN SDGs and Registrar documents (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let storageDir: string;
  let hqToken: string;
  const suffix = randomUUID().slice(0, 8);
  const districtId = randomUUID();
  const societyId = randomUUID();
  const otherSocietyId = randomUUID();
  const hqId = randomUUID();
  const accounts: string[] = [hqId];
  const tokens: Record<string, { id: string; token: string }> = {};
  const planYear = plannableYears().last;
  const fy = latestCompletedFinancialYear();

  const http = () => request(app.getHttpServer());
  const api = (token: string) => ({
    get: (path: string) =>
      http().get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`),
    put: (path: string, body: object) =>
      http()
        .put(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    post: (path: string, body: object = {}) =>
      http()
        .post(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
  });

  const activity = {
    year: planYear,
    month: 9,
    name: 'Fictional youth leadership camp',
    description: 'Three-day camp for 40 young people from the village.',
    sector: 'Community education',
    dimension: 'SOCIAL',
    datesLabel: '12–14 Sep',
    allocatedCost: 55000,
    femaleParticipants: 24,
    maleParticipants: 14,
    youthParticipants: 12,
    householdsBenefited: 146,
    womenHeadedHouseholds: 31,
    partners: 'Fictional youth club',
    volunteerHours: 120,
  };

  async function account(label: string, role: string, societyIds: string[]) {
    const username = `v5pr4.${label}.${suffix}`;
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

  /** Uploads a file the way the clients do: metadata, direct PUT, then confirm. */
  async function upload(
    token: string,
    documentType: string,
    file = Buffer.from(`%PDF-1.7\n${documentType}\n%%EOF\n`),
  ) {
    const created = await api(token)
      .post('/documents', {
        societyId,
        documentType,
        title: documentType,
        fileName: 'scan.pdf',
        contentType: 'application/pdf',
        sizeBytes: file.length,
        financialYear: fy,
        checksumSha256: createHash('sha256').update(file).digest('base64'),
      })
      .expect(201);
    await http()
      .put(new URL(created.body.upload.url as string).pathname)
      .set('Content-Type', 'application/pdf')
      .send(file)
      .expect(200);
    await api(token)
      .post(`/documents/${created.body.document.id}/complete`)
      .expect(200);
    return created.body.document.id as string;
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'v5-pr4-db-'));
    process.env['LOCAL_STORAGE_DIR'] = storageDir;
    process.env['STORAGE_SIGNING_SECRET'] = 'db-test-only-secret';
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
        code: `A${suffix}`,
        nameEn: `PR4 test ${suffix}`,
      },
    });
    await db.society.createMany({
      data: [
        {
          id: societyId,
          societyCode: `S-A${suffix.toUpperCase()}`,
          nameEn: 'Fictional Activity Society',
          districtId,
          status: 'ACTIVE',
        },
        {
          id: otherSocietyId,
          societyCode: `S-B${suffix.toUpperCase()}`,
          nameEn: 'Fictional Other Activity Society',
          districtId,
          status: 'ACTIVE',
        },
      ],
    });
    await db.platformAccount.create({
      data: {
        id: hqId,
        username: `v5pr4.hq.${suffix}`,
        displayName: 'Fictional HQ',
        role: 'HQ_ADMIN',
        phone: '+94000000000',
        status: 'ACTIVE',
        passwordHash: passwordHash('test-password-123'),
      },
    });
    const login = await http()
      .post('/api/v1/identity/login')
      .send({ username: `v5pr4.hq.${suffix}`, password: 'test-password-123' })
      .expect(201);
    hqToken = login.body.token;
    tokens.so = await account('so', 'SOCIETY_OFFICER', [societyId]);
    tokens.spc = await account('spc', 'PROGRAMME_COORDINATOR', [societyId]);
    tokens.otherSpc = await account('other-spc', 'PROGRAMME_COORDINATOR', [
      otherSocietyId,
    ]);
    tokens.ddm = await account('ddm', 'DEPUTY_DISTRICT_MANAGER', [societyId]);
    tokens.dm = await account('dm', 'DISTRICT_MANAGER', []);
    tokens.otherSo = await account('other-so', 'SOCIETY_OFFICER', [
      otherSocietyId,
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db.notification.deleteMany({
        where: { recipientUserId: { in: accounts } },
      });
      await db.platformAuditEvent.deleteMany({
        where: { OR: [{ actorId: { in: accounts } }, { districtId }] },
      });
      await db.platformAccount.deleteMany({ where: { id: { in: accounts } } });
      await db.societyDocument.deleteMany({
        where: { societyId: { in: [societyId, otherSocietyId] } },
      });
      await db.society.deleteMany({
        where: { id: { in: [societyId, otherSocietyId] } },
      });
      await db.district.deleteMany({ where: { id: districtId } });
    }
    await app?.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  it('lets the Society Officer add an activity and refuses those who only view', async () => {
    const created = await api(tokens.so!.token)
      .post(`/societies/${societyId}/activities`, activity)
      .expect(201);
    expect(created.body).toMatchObject({
      status: 'WAITING_FOR_SPC',
      sdgs: [],
      dimension: 'SOCIAL',
      femaleParticipants: 24,
      createdBy: { role: 'SOCIETY_OFFICER' },
      permissions: { canEdit: true, canReview: false },
    });
    const id = created.body.id as string;

    // The DM only views; another society's officer cannot see the society.
    await api(tokens.dm!.token)
      .post(`/societies/${societyId}/activities`, activity)
      .expect(403);
    await api(tokens.otherSo!.token)
      .post(`/societies/${societyId}/activities`, activity)
      .expect(404);
    await api(tokens.otherSo!.token).get(`/activities/${id}`).expect(404);

    // The assigned SPC is told and sees it waiting.
    const told = await db.notification.findMany({
      where: { recipientUserId: tokens.spc!.id },
    });
    expect(told.map((n) => n.linkPath)).toContain(
      `/activities-to-approve/${id}`,
    );
    const queue = await api(tokens.spc!.token)
      .get('/activity-reviews')
      .expect(200);
    expect(queue.body.waiting.map((item: { id: string }) => item.id)).toContain(
      id,
    );
    expect(queue.body.waiting[0]).toMatchObject({
      totalParticipants: 38,
      society: { id: societyId },
    });

    // Only SPCs have a review queue; another SPC does not see this society.
    await api(tokens.so!.token).get('/activity-reviews').expect(403);
    await api(hqToken).get('/activity-reviews').expect(403);
    const other = await api(tokens.otherSpc!.token)
      .get('/activity-reviews')
      .expect(200);
    expect(other.body.waiting).toEqual([]);

    // The work plan shows it as waiting, with counts.
    const plan = await api(tokens.so!.token)
      .get(`/societies/${societyId}/work-plan?year=${planYear}`)
      .expect(200);
    expect(plan.body).toMatchObject({
      counts: { planned: 1, waiting: 1, approved: 0 },
      permissions: { canAddActivities: true },
    });
    const dmPlan = await api(tokens.dm!.token)
      .get(`/societies/${societyId}/work-plan?year=${planYear}`)
      .expect(200);
    expect(dmPlan.body.permissions.canAddActivities).toBe(false);
  });

  it('lets only the assigned SPC approve, with at least one UN SDG, once', async () => {
    const { body } = await api(tokens.so!.token)
      .post(`/societies/${societyId}/activities`, {
        ...activity,
        name: 'Fictional clean-water day',
      })
      .expect(201);
    const id = body.id as string;

    for (const who of ['so', 'ddm', 'dm'] as const) {
      await api(tokens[who]!.token)
        .post(`/activities/${id}/approve`, { sdgs: [6] })
        .expect(403);
    }
    await api(hqToken)
      .post(`/activities/${id}/approve`, { sdgs: [6] })
      .expect(403);
    await api(tokens.otherSpc!.token)
      .post(`/activities/${id}/approve`, { sdgs: [6] })
      .expect(404);
    await api(tokens.spc!.token)
      .post(`/activities/${id}/approve`, { sdgs: [] })
      .expect(400);
    await api(tokens.spc!.token)
      .post(`/activities/${id}/approve`, { sdgs: [18] })
      .expect(400);

    const approved = await api(tokens.spc!.token)
      .post(`/activities/${id}/approve`, { sdgs: [6, 3] })
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      sdgs: [3, 6],
      review: { by: { role: 'PROGRAMME_COORDINATOR' } },
    });
    const stored = await db.workPlanActivitySdg.findMany({
      where: { activityId: id },
      orderBy: { sdg: 'asc' },
    });
    expect(stored.map((row) => row.sdg)).toEqual([3, 6]);

    // A second decision is refused, and an approved activity cannot change.
    await api(tokens.spc!.token)
      .post(`/activities/${id}/send-back`, {})
      .expect(409);
    await api(tokens.so!.token)
      .put(`/societies/${societyId}/activities/${id}`, activity)
      .expect(409);

    // The Society Officer is told; the change history records it.
    const told = await db.notification.findMany({
      where: { recipientUserId: tokens.so!.id, category: 'APPROVAL' },
    });
    expect(told.map((n) => n.title)).toContain(
      'Activity approved: Fictional clean-water day',
    );
    const history = await api(tokens.so!.token)
      .get(`/societies/${societyId}/history?category=WORK_PLAN`)
      .expect(200);
    expect(JSON.stringify(history.body)).toContain('UN SDG 3, 6');

    const queue = await api(tokens.spc!.token)
      .get('/activity-reviews')
      .expect(200);
    expect(
      queue.body.approvedRecently.find(
        (item: { id: string }) => item.id === id,
      ),
    ).toMatchObject({ sdgs: [3, 6] });
  });

  it('sends an activity back with a comment, and the officer can change and resend it', async () => {
    const { body } = await api(tokens.so!.token)
      .post(`/societies/${societyId}/activities`, {
        ...activity,
        name: 'Fictional coir rope training',
      })
      .expect(201);
    const id = body.id as string;
    await api(tokens.so!.token)
      .post(`/activities/${id}/send-back`, { comment: 'No' })
      .expect(403);
    const sent = await api(tokens.spc!.token)
      .post(`/activities/${id}/send-back`, {
        comment: 'Please split the participants by village ward.',
      })
      .expect(200);
    expect(sent.body).toMatchObject({
      status: 'SENT_BACK',
      review: { comment: 'Please split the participants by village ward.' },
      permissions: { canReview: false },
    });
    const resent = await api(tokens.so!.token)
      .put(`/societies/${societyId}/activities/${id}`, {
        ...activity,
        name: 'Fictional coir rope training',
        femaleParticipants: 30,
      })
      .expect(200);
    expect(resent.body).toMatchObject({
      status: 'WAITING_FOR_SPC',
      femaleParticipants: 30,
    });
  });

  it('counts submitted and missing Registrar documents for the society and nationally', async () => {
    const before = await api(hqToken)
      .get(`/registrar-documents/totals?year=${fy}`)
      .expect(200);

    const empty = await api(tokens.so!.token)
      .get(`/societies/${societyId}/registrar-documents?year=${fy}`)
      .expect(200);
    expect(empty.body).toMatchObject({ submitted: 0, missing: 4 });

    // A file that is not the declared one is refused by storage.
    const declared = Buffer.from('%PDF-1.7\nreal\n%%EOF\n');
    const created = await api(tokens.so!.token)
      .post('/documents', {
        societyId,
        documentType: 'AGM_MINUTES',
        title: 'AGM',
        fileName: 'agm.pdf',
        contentType: 'application/pdf',
        sizeBytes: declared.length,
        financialYear: fy,
        checksumSha256: createHash('sha256').update(declared).digest('base64'),
      })
      .expect(201);
    expect(created.body.upload.url).toContain('/api/v1/storage/local/');
    await http()
      .put(new URL(created.body.upload.url as string).pathname)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.7\nfake\n%%EOF\n'))
      .expect(400);
    const key = (
      await db.societyDocument.findUniqueOrThrow({
        where: { id: created.body.document.id as string },
      })
    ).storageKey;
    expect(key).toMatch(
      new RegExp(
        `^societies/${societyId}/agm-minutes/${fy}-\\d{2}/[0-9a-f-]{36}\\.pdf$`,
      ),
    );

    for (const type of [
      'AUDIT_REPORT',
      'AGM_MINUTES',
      'OFFICE_BEARER_LIST',
      'MEMBERS_LIST',
    ]) {
      await upload(tokens.so!.token, type);
    }
    const full = await api(tokens.so!.token)
      .get(`/societies/${societyId}/registrar-documents?year=${fy}`)
      .expect(200);
    expect(full.body).toMatchObject({ submitted: 4, missing: 0 });
    // The signed members list opens only for District Managers and HQ.
    const members = full.body.documents.find(
      (entry: { documentType: string }) =>
        entry.documentType === 'MEMBERS_LIST',
    );
    expect(members.document.canOpen).toBe(false);
    const dmView = await api(tokens.dm!.token)
      .get(`/societies/${societyId}/registrar-documents?year=${fy}`)
      .expect(200);
    expect(
      dmView.body.documents.find(
        (entry: { documentType: string }) =>
          entry.documentType === 'MEMBERS_LIST',
      ).document.canOpen,
    ).toBe(true);
    await api(tokens.otherSo!.token)
      .get(`/societies/${societyId}/registrar-documents?year=${fy}`)
      .expect(404);

    const after = await api(hqToken)
      .get(`/registrar-documents/totals?year=${fy}`)
      .expect(200);
    expect(after.body.activeSocieties).toBe(before.body.activeSocieties);
    expect(after.body.allFour).toBe(before.body.allFour + 1);
    for (const [index, entry] of (
      after.body.byType as { submitted: number; missing: number }[]
    ).entries()) {
      expect(entry.submitted).toBe(before.body.byType[index].submitted + 1);
      expect(entry.submitted + entry.missing).toBe(after.body.activeSocieties);
    }

    // HQ only; the other society is still missing its audit report.
    await api(tokens.dm!.token)
      .get(`/registrar-documents/totals?year=${fy}`)
      .expect(403);
    await api(tokens.spc!.token)
      .get('/registrar-documents/missing')
      .expect(403);
    const missing = await api(hqToken)
      .get(
        `/registrar-documents/missing?year=${fy}&documentType=AUDIT_REPORT&pageSize=100`,
      )
      .expect(200);
    const ids = [] as string[];
    for (let page = 1; page <= missing.body.meta.totalPages; page += 1) {
      const next = await api(hqToken)
        .get(
          `/registrar-documents/missing?year=${fy}&documentType=AUDIT_REPORT&pageSize=100&page=${page}`,
        )
        .expect(200);
      ids.push(...next.body.data.map((row: { id: string }) => row.id));
    }
    expect(ids).toContain(otherSocietyId);
    expect(ids).not.toContain(societyId);
    expect(missing.body).toMatchObject({ dueOn: `${fy + 1}-09-30` });
  });
});
