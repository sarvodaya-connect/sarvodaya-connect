/**
 * SC-65 database tests: the V4 society record, yearly summary, grade requests
 * and change history against a real PostgreSQL with the migrations applied.
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
import { latestCompletedFinancialYear } from '../../src/societies/financial-year.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname))
  throw new Error('Use a disposable local PostgreSQL DATABASE_URL');

describe('SC-65 society record, yearly summary and grade requests (PostgreSQL)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let hqToken: string;
  const suffix = randomUUID().slice(0, 8);
  const districtId = randomUUID();
  const societyId = randomUUID();
  const otherSocietyId = randomUUID();
  const hqId = randomUUID();
  const accounts: string[] = [hqId];
  const year = latestCompletedFinancialYear();
  const tokens: Record<string, { id: string; token: string }> = {};

  const api = (token: string) => ({
    get: (path: string) =>
      request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`),
    patch: (path: string, body: object) =>
      request(app.getHttpServer())
        .patch(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    put: (path: string, body: object) =>
      request(app.getHttpServer())
        .put(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    post: (path: string, body: object) =>
      request(app.getHttpServer())
        .post(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
  });

  async function account(label: string, role: string, societyIds: string[]) {
    const username = `sc65.${label}.${suffix}`;
    const created = await api(hqToken)
      .post('/identity/accounts', {
        username,
        displayName: `Fictional ${role}`,
        phone: '+94000000001',
        role,
        districtId,
        societyIds,
        password: 'test-password-123',
      })
      .expect(201);
    accounts.push(created.body.account.id);
    const login = await request(app.getHttpServer())
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
        code: `R${suffix}`,
        nameEn: `Record test ${suffix}`,
      },
    });
    await db.society.createMany({
      data: [
        {
          id: societyId,
          societyCode: `S-${suffix.toUpperCase()}`,
          nameEn: 'Fictional Record Society',
          districtId,
          memberCount: 412,
        },
        {
          id: otherSocietyId,
          societyCode: `S-O${suffix.toUpperCase()}`,
          nameEn: 'Fictional Other Society',
          districtId,
        },
      ],
    });
    await db.platformAccount.create({
      data: {
        id: hqId,
        username: `sc65.hq.${suffix}`,
        displayName: 'Fictional HQ',
        role: 'HQ_ADMIN',
        phone: '+94000000000',
        status: 'ACTIVE',
        passwordHash: passwordHash('test-password-123'),
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/v1/identity/login')
      .send({ username: `sc65.hq.${suffix}`, password: 'test-password-123' })
      .expect(201);
    hqToken = login.body.token;
    tokens.so = await account('so', 'SOCIETY_OFFICER', [societyId]);
    tokens.spc = await account('spc', 'PROGRAMME_COORDINATOR', [societyId]);
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
        where: {
          OR: [{ actorId: { in: accounts } }, { districtId }],
        },
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
  });

  it('applies role and assignment scope to society edits on the server', async () => {
    const so = api(tokens.so!.token);
    const edited = await so
      .patch(`/societies/${societyId}/profile`, {
        memberCount: 418,
        landline: '0370000123',
        businessDescription: 'A small fictional rice mill for members.',
      })
      .expect(200);
    expect(edited.body).toMatchObject({
      memberCount: 418,
      landline: '037 000 0123',
      businessDescription: 'A small fictional rice mill for members.',
      permissions: {
        canEdit: true,
        canEditAnnualSummary: true,
        canChangeGrade: false,
      },
      lastChange: {
        by: {
          displayName: 'Fictional SOCIETY_OFFICER',
          role: 'SOCIETY_OFFICER',
        },
      },
    });
    expect(edited.body.staff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'PROGRAMME_COORDINATOR',
          accountStatus: 'ACTIVE',
        }),
        expect.objectContaining({ role: 'DISTRICT_MANAGER' }),
      ]),
    );

    // Only HQ corrects the S number or the grade.
    await so
      .patch(`/societies/${societyId}/profile`, { societyCode: 'S-999999' })
      .expect(403);
    await so
      .patch(`/societies/${societyId}/profile`, {
        grade: 'A',
        gradeReason: 'Good year',
      })
      .expect(403);
    // DMs view the district; other officers cannot edit this society.
    await api(tokens.dm!.token)
      .patch(`/societies/${societyId}/profile`, { memberCount: 1 })
      .expect(403);
    const dmView = await api(tokens.dm!.token)
      .get(`/societies/${societyId}`)
      .expect(200);
    expect(dmView.body.permissions).toMatchObject({
      canEdit: false,
      viewOnlyReason: 'DISTRICT_MANAGER',
    });
    await api(tokens.otherSo!.token)
      .patch(`/societies/${societyId}/profile`, { memberCount: 1 })
      .expect(403);
    await api(tokens.otherSo!.token).get(`/societies/${societyId}`).expect(404);
    await so
      .patch(`/societies/${societyId}/profile`, { landline: '037 22' })
      .expect(400);

    // HQ: a direct grade change needs a reason; a used S number is refused.
    const hq = api(hqToken);
    await hq
      .patch(`/societies/${societyId}/profile`, { grade: 'C' })
      .expect(400);
    const graded = await hq
      .patch(`/societies/${societyId}/profile`, {
        grade: 'C',
        gradeReason: 'Starting grade agreed with the district',
      })
      .expect(200);
    expect(graded.body).toMatchObject({
      grade: 'C',
      gradeChangedBy: { displayName: 'Fictional HQ', role: 'HQ_ADMIN' },
    });
    await hq
      .patch(`/societies/${societyId}/profile`, {
        societyCode: `S-O${suffix.toUpperCase()}`,
      })
      .expect(409);
  });

  it('keeps two yearly totals with who changed them, entered only by the Society Officer or SPC', async () => {
    await api(tokens.so!.token)
      .put(`/societies/${societyId}/annual-summary/${year}`, {
        totalProfit: 398000,
        totalExpenses: 1286000,
      })
      .expect(200);
    const updated = await api(tokens.spc!.token)
      .put(`/societies/${societyId}/annual-summary/${year}`, {
        totalProfit: 412500.5,
        totalExpenses: 1286000,
      })
      .expect(200);
    expect(updated.body.summary).toMatchObject({
      financialYear: { startYear: year },
      totalProfit: 412500.5,
      totalExpenses: 1286000,
      profitChange: {
        previousValue: 398000,
        updatedBy: { role: 'PROGRAMME_COORDINATOR' },
      },
      expensesChange: { updatedBy: { role: 'SOCIETY_OFFICER' } },
    });

    for (const token of [tokens.dm!.token, tokens.ddm!.token, hqToken]) {
      await api(token)
        .put(`/societies/${societyId}/annual-summary/${year}`, {
          totalProfit: 1,
          totalExpenses: 1,
        })
        .expect(403);
    }
    await api(tokens.so!.token)
      .put(`/societies/${societyId}/annual-summary/${year + 1}`, {
        totalProfit: 1,
        totalExpenses: 1,
      })
      .expect(400);
    await api(tokens.so!.token)
      .put(`/societies/${societyId}/annual-summary/${year}`, {
        totalProfit: '1,286,000.5O',
        totalExpenses: -1,
      })
      .expect(400);

    // The audit report for the year appears next to the totals.
    await db.societyDocument.create({
      data: {
        societyId,
        documentType: 'AUDIT_REPORT',
        title: `Audit report test ${suffix}`,
        fileName: 'Audit_Report_Fictional.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1_800_000,
        storageKey: `societies/${societyId}/documents/${randomUUID()}.pdf`,
        status: 'SUBMITTED',
        uploadedById: tokens.so!.id,
        uploadedByName: 'Fictional SOCIETY_OFFICER',
        uploadedByRole: 'SOCIETY_OFFICER',
        uploadedAt: new Date(),
        financialYear: year,
      },
    });
    const record = await api(hqToken)
      .get(`/societies/${societyId}`)
      .expect(200);
    expect(record.body.annualSummary).toMatchObject({
      totalProfit: 412500.5,
      auditReport: {
        fileName: 'Audit_Report_Fictional.pdf',
        uploadedBy: { role: 'SOCIETY_OFFICER' },
      },
    });
    const missing = await api(hqToken)
      .get(`/societies/${otherSocietyId}/annual-summary`)
      .expect(200);
    expect(missing.body.summary).toMatchObject({
      totalProfit: null,
      totalExpenses: null,
      auditReport: null,
    });
  });

  it('lets field staff request a grade change and only HQ decide it', async () => {
    const reason =
      'The Exco was re-formed and every planned activity took place.';
    await api(tokens.dm!.token)
      .post(`/societies/${societyId}/grade-requests`, { toGrade: 'B', reason })
      .expect(403);
    await api(hqToken)
      .post(`/societies/${societyId}/grade-requests`, { toGrade: 'B', reason })
      .expect(403);
    await api(tokens.spc!.token)
      .post(`/societies/${societyId}/grade-requests`, { toGrade: 'C', reason })
      .expect(400);
    const created = await api(tokens.spc!.token)
      .post(`/societies/${societyId}/grade-requests`, { toGrade: 'B', reason })
      .expect(201);
    expect(created.body).toMatchObject({
      fromGrade: 'C',
      toGrade: 'B',
      status: 'PENDING',
    });
    await api(tokens.so!.token)
      .post(`/societies/${societyId}/grade-requests`, { toGrade: 'A', reason })
      .expect(409);

    const waiting = await api(tokens.dm!.token)
      .get(`/societies/${societyId}`)
      .expect(200);
    expect(waiting.body).toMatchObject({
      grade: 'C',
      openGradeRequest: { id: created.body.id, toGrade: 'B' },
    });

    const decide = (token: string, body: object) =>
      api(token).post(
        `/societies/${societyId}/grade-requests/${created.body.id}/decision`,
        body,
      );
    await decide(tokens.spc!.token, { decision: 'APPROVE' }).expect(403);
    await decide(tokens.dm!.token, { decision: 'APPROVE' }).expect(403);
    await decide(hqToken, { decision: 'REJECT' }).expect(400);
    const approved = await decide(hqToken, {
      decision: 'APPROVE',
      comment: 'Strong record this year.',
    }).expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      decidedBy: { displayName: 'Fictional HQ' },
      decisionComment: 'Strong record this year.',
    });
    await decide(hqToken, { decision: 'REJECT', comment: 'Again' }).expect(409);

    const record = await api(tokens.so!.token)
      .get(`/societies/${societyId}`)
      .expect(200);
    expect(record.body).toMatchObject({ grade: 'B', openGradeRequest: null });
    const notified = await db.notification.findMany({
      where: { recipientUserId: tokens.spc!.id, societyId },
    });
    expect(notified.map((row) => row.category)).toContain('APPROVAL');

    // A direct HQ change closes a waiting request.
    const second = await api(tokens.ddm!.token)
      .post(`/societies/${societyId}/grade-requests`, { toGrade: 'A', reason })
      .expect(201);
    await api(hqToken)
      .patch(`/societies/${societyId}/profile`, {
        grade: 'A',
        gradeReason: 'Audit complete and Exco re-formed',
      })
      .expect(200);
    const list = await api(tokens.so!.token)
      .get(`/societies/${societyId}/grade-requests`)
      .expect(200);
    expect(list.body.data[0]).toMatchObject({
      id: second.body.id,
      status: 'APPROVED',
      decisionComment: expect.stringContaining('Grade changed directly by HQ'),
    });
  });

  it('shows every change with who made it, filtered by tab, without NIC reveals', async () => {
    const all = await api(tokens.dm!.token)
      .get(`/societies/${societyId}/history`)
      .expect(200);
    const summaries = all.body.data.map(
      (entry: { summary: string }) => entry.summary,
    );
    expect(summaries).toEqual(
      expect.arrayContaining([
        'Members 412 → 418; Landline added; Business description added',
        expect.stringMatching(/profit LKR 398,000 → 412,500\.5/),
        expect.stringMatching(/Grade change C → B requested/),
      ]),
    );
    expect(
      all.body.data.find(
        (entry: { category: string }) => entry.category === 'ANNUAL_SUMMARY',
      ).actor,
    ).toMatchObject({ role: 'PROGRAMME_COORDINATOR' });
    const grade = await api(tokens.dm!.token)
      .get(`/societies/${societyId}/history?category=GRADE`)
      .expect(200);
    expect(
      grade.body.data.every(
        (entry: { category: string }) => entry.category === 'GRADE',
      ),
    ).toBe(true);
    await api(tokens.otherSo!.token)
      .get(`/societies/${societyId}/history`)
      .expect(404);

    const plan = await api(hqToken)
      .get(`/societies/${societyId}/work-plan`)
      .expect(200);
    expect(plan.body).toMatchObject({ activities: [], totalAllocated: 0 });
  });
});
