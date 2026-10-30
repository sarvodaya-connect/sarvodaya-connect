import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from './../src/app.module.js';
import { ApiExceptionFilter } from './../src/common/api-exception.filter.js';
import type { DocumentScopeFilter } from './../src/documents/document-access.policy.js';
import type {
  DocumentListFilters,
  NewDocument,
} from './../src/documents/documents.repository.js';
import { DocumentsRepository } from './../src/documents/documents.repository.js';
import type { NewNotification } from './../src/notifications/notifications.repository.js';
import { NotificationsRepository } from './../src/notifications/notifications.repository.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { latestCompletedFinancialYear } from './../src/societies/financial-year.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const CENTRAL = '29000000-0000-4000-8000-000000000002';
const SUNRISE = '29000000-0000-4000-8000-000000000101';
const LOTUS = '29000000-0000-4000-8000-000000000103';
const MISSING = '29000000-0000-4000-8000-000000000999';
// SC-65: audit reports carry their financial year.
const AUDIT_YEAR = latestCompletedFinancialYear();

const societies = [
  {
    id: SUNRISE,
    societyCode: 'DEMO-SOC-001',
    nameEn: 'Example Sunrise Society',
    districtId: NORTH,
  },
  {
    id: LOTUS,
    societyCode: 'DEMO-SOC-003',
    nameEn: 'Example Lotus Society',
    districtId: CENTRAL,
  },
];

type StoredDocument = NewDocument & {
  version: number;
  status: string;
  uploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** In-memory stand-in for PostgreSQL, with the same visibility filtering as the real repository. */
class InMemoryDocumentsRepository {
  rows: StoredDocument[] = [];

  private withSociety(row: StoredDocument) {
    const society = societies.find((item) => item.id === row.societyId)!;
    return { ...row, society };
  }

  findSociety(id: string) {
    const society = societies.find((item) => item.id === id);
    return Promise.resolve(
      society
        ? {
            id: society.id,
            nameEn: society.nameEn,
            districtId: society.districtId,
          }
        : null,
    );
  }

  list(filters: DocumentListFilters) {
    const scope: DocumentScopeFilter = filters.scope;
    const visible = this.rows
      .map((row) => this.withSociety(row))
      .filter((row) => row.uploadedAt !== null)
      .filter(
        (row) => scope.includeRestricted || row.accessLevel === 'STANDARD',
      )
      .filter(
        (row) =>
          scope.kind !== 'societies' ||
          scope.societyIds.includes(row.societyId),
      )
      .filter(
        (row) =>
          scope.kind !== 'districts' ||
          scope.districtIds.includes(row.society.districtId),
      )
      .filter(
        (row) => !filters.societyId || row.societyId === filters.societyId,
      )
      .filter(
        (row) =>
          !filters.districtId || row.society.districtId === filters.districtId,
      )
      .filter(
        (row) =>
          !filters.documentType || row.documentType === filters.documentType,
      )
      .filter((row) => !filters.status || row.status === filters.status);
    const start = (filters.page - 1) * filters.pageSize;
    return Promise.resolve({
      records: visible.slice(start, start + filters.pageSize),
      totalItems: visible.length,
    });
  }

  findById(id: string) {
    const row = this.rows.find((item) => item.id === id);
    return Promise.resolve(row ? this.withSociety(row) : null);
  }

  create(document: NewDocument) {
    const version =
      Math.max(
        0,
        ...this.rows
          .filter(
            (row) =>
              row.societyId === document.societyId &&
              row.documentType === document.documentType &&
              row.title === document.title,
          )
          .map((row) => row.version),
      ) + 1;
    const now = new Date();
    const row: StoredDocument = {
      ...document,
      version,
      status: 'DRAFT',
      uploadedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return Promise.resolve(this.withSociety(row));
  }

  markUploaded(id: string, uploadedAt: Date) {
    const row = this.rows.find((item) => item.id === id)!;
    Object.assign(row, {
      uploadedAt,
      status: 'SUBMITTED',
      updatedAt: uploadedAt,
    });
    return Promise.resolve(this.withSociety(row));
  }
}

class InMemoryNotificationsRepository {
  rows: (NewNotification & {
    id: string;
    readAt: Date | null;
    createdAt: Date;
  })[] = [];

  listForRecipient(
    recipientUserId: string,
    options: { unreadOnly: boolean; page: number; pageSize: number },
  ) {
    const mine = this.rows.filter(
      (row) => row.recipientUserId === recipientUserId,
    );
    const shown = options.unreadOnly
      ? mine.filter((row) => row.readAt === null)
      : mine;
    return Promise.resolve({
      records: shown.map((row) => ({
        body: null,
        linkPath: null,
        societyId: null,
        documentId: null,
        ...row,
      })),
      totalItems: shown.length,
      unreadCount: mine.filter((row) => row.readAt === null).length,
    });
  }

  createMany(rows: NewNotification[]) {
    for (const row of rows) {
      this.rows.push({
        ...row,
        id: crypto.randomUUID(),
        readAt: null,
        createdAt: new Date(),
      });
    }
    return Promise.resolve({ count: rows.length });
  }

  markRead(id: string, recipientUserId: string, readAt: Date) {
    const row = this.rows.find(
      (item) =>
        item.id === id &&
        item.recipientUserId === recipientUserId &&
        !item.readAt,
    );
    if (row) row.readAt = readAt;
    return Promise.resolve(row ? 1 : 0);
  }

  exists(id: string, recipientUserId: string) {
    return Promise.resolve(
      this.rows.some(
        (row) => row.id === id && row.recipientUserId === recipientUserId,
      ),
    );
  }

  markAllRead(recipientUserId: string, readAt: Date) {
    const unread = this.rows.filter(
      (row) => row.recipientUserId === recipientUserId && !row.readAt,
    );
    unread.forEach((row) => (row.readAt = readAt));
    return Promise.resolve(unread.length);
  }
}

const PDF = Buffer.from('%PDF-1.7\nfictional demonstration file\n%%EOF\n');

describe('Documents and notifications (e2e)', () => {
  let app: INestApplication;
  let storageDir: string;
  let documents: InMemoryDocumentsRepository;
  let notifications: InMemoryNotificationsRepository;

  const as = (user: string) => ({ 'X-Demo-User': user });
  const http = () => request(app.getHttpServer());
  const pathOf = (url: string) => new URL(url).pathname;

  async function uploadDocument(
    user: string,
    body: Record<string, unknown>,
    file = PDF,
  ) {
    const created = await http()
      .post('/api/v1/documents')
      .set(as(user))
      .send({ contentType: 'application/pdf', sizeBytes: file.length, ...body })
      .expect(201);
    await http()
      .put(pathOf(created.body.upload.url))
      .set('Content-Type', created.body.upload.headers['Content-Type'])
      .send(file)
      .expect(200);
    const completed = await http()
      .post(`/api/v1/documents/${created.body.document.id}/complete`)
      .set(as(user))
      .expect(200);
    return completed.body as { id: string; status: string; version: number };
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'sc49-e2e-'));
    process.env['LOCAL_STORAGE_DIR'] = storageDir;
    process.env['STORAGE_SIGNING_SECRET'] = 'e2e-test-only-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DocumentsRepository)
      .useFactory({
        factory: () => (documents = new InMemoryDocumentsRepository()),
      })
      .overrideProvider(NotificationsRepository)
      .useFactory({
        factory: () => (notifications = new InMemoryNotificationsRepository()),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror the real bootstrap in src/main.ts
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
  });

  beforeEach(() => {
    documents.rows = [];
    notifications.rows = [];
  });

  afterAll(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
    delete process.env['LOCAL_STORAGE_DIR'];
    delete process.env['STORAGE_SIGNING_SECRET'];
  });

  it('requires a signed-in user', async () => {
    const response = await http().get('/api/v1/documents').expect(401);
    expect(response.body.error).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Sign in to continue',
    });
    await http().get('/api/v1/notifications').set(as('not-a-user')).expect(401);
  });

  it('uploads, completes, lists and downloads a document through pre-signed URLs', async () => {
    const created = await http()
      .post('/api/v1/documents')
      .set(as('demo-officer-sunrise'))
      .send({
        societyId: SUNRISE,
        documentType: 'AUDIT_REPORT',
        financialYear: AUDIT_YEAR,
        title: 'Audit report FY 2025/26',
        fileName: 'audit-report-2025-26.pdf',
        contentType: 'application/pdf',
        sizeBytes: PDF.length,
      })
      .expect(201);

    expect(created.body.document).toMatchObject({
      status: 'DRAFT',
      version: 1,
      accessLevel: 'STANDARD',
      uploadedBy: 'Demo Officer (Example Sunrise Society)',
    });
    expect(created.body.document).not.toHaveProperty('storageKey');
    expect(created.body.upload).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
    });

    // Not uploaded yet.
    await http()
      .post(`/api/v1/documents/${created.body.document.id}/complete`)
      .set(as('demo-officer-sunrise'))
      .expect(409);

    await http()
      .put(pathOf(created.body.upload.url))
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(200);
    const completed = await http()
      .post(`/api/v1/documents/${created.body.document.id}/complete`)
      .set(as('demo-officer-sunrise'))
      .expect(200);
    expect(completed.body).toMatchObject({
      status: 'SUBMITTED',
      uploadedAt: expect.any(String),
    });

    const listed = await http()
      .get('/api/v1/documents')
      .query({ documentType: 'AUDIT_REPORT' })
      .set(as('demo-dm-north'))
      .expect(200);
    expect(listed.body.meta).toMatchObject({ totalItems: 1, page: 1 });
    expect(listed.body.data[0]).toMatchObject({
      id: created.body.document.id,
      society: { nameEn: 'Example Sunrise Society' },
    });

    const link = await http()
      .get(`/api/v1/documents/${created.body.document.id}/download`)
      .set(as('demo-dm-north'))
      .expect(200);
    const file = await http()
      .get(pathOf(link.body.url))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(file.headers['content-disposition']).toBe(
      'attachment; filename="audit-report-2025-26.pdf"',
    );
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(file.body as Buffer, PDF)).toBe(0);
  });

  it('numbers new uploads of the same document as new versions', async () => {
    const body = {
      societyId: SUNRISE,
      documentType: 'AGM_MINUTES',
      title: 'AGM minutes 2026',
      fileName: 'agm.pdf',
    };
    expect((await uploadDocument('demo-officer-sunrise', body)).version).toBe(
      1,
    );
    expect((await uploadDocument('demo-officer-sunrise', body)).version).toBe(
      2,
    );
  });

  it('keeps every user inside their own societies and districts', async () => {
    const sunrise = await uploadDocument('demo-officer-sunrise', {
      societyId: SUNRISE,
      documentType: 'AGM_MINUTES',
      title: 'AGM minutes 2026',
      fileName: 'agm.pdf',
    });
    await uploadDocument('demo-officer-lotus', {
      societyId: LOTUS,
      documentType: 'AGM_MINUTES',
      title: 'AGM minutes 2026',
      fileName: 'agm.pdf',
    });

    // Creating for another society, or one that does not exist, looks the same.
    await http()
      .post('/api/v1/documents')
      .set(as('demo-officer-lotus'))
      .send({
        societyId: SUNRISE,
        documentType: 'OTHER',
        title: 'x',
        fileName: 'x.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
      })
      .expect(404);
    await http()
      .post('/api/v1/documents')
      .set(as('demo-hq-admin'))
      .send({
        societyId: MISSING,
        documentType: 'OTHER',
        title: 'x',
        fileName: 'x.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
      })
      .expect(404);

    const forLotus = await http()
      .get('/api/v1/documents')
      .set(as('demo-officer-lotus'))
      .expect(200);
    expect(
      forLotus.body.data.map((doc: { societyId: string }) => doc.societyId),
    ).toEqual([LOTUS]);
    const forCentral = await http()
      .get('/api/v1/documents')
      .set(as('demo-dm-central'))
      .expect(200);
    expect(forCentral.body.meta.totalItems).toBe(1);
    const forHq = await http()
      .get('/api/v1/documents')
      .set(as('demo-hq-admin'))
      .expect(200);
    expect(forHq.body.meta.totalItems).toBe(2);

    const hidden = await http()
      .get(`/api/v1/documents/${sunrise.id}`)
      .set(as('demo-dm-central'))
      .expect(404);
    expect(hidden.body.error.code).toBe('NOT_FOUND');
    await http()
      .get(`/api/v1/documents/${sunrise.id}/download`)
      .set(as('demo-officer-lotus'))
      .expect(404);
  });

  it('keeps the signed members list from society officers', async () => {
    const membersList = await uploadDocument('demo-officer-sunrise', {
      societyId: SUNRISE,
      documentType: 'MEMBERS_LIST',
      title: 'Members list 2026 (signed)',
      fileName: 'members-list-2026.pdf',
    });

    const forbidden = await http()
      .get(`/api/v1/documents/${membersList.id}/download`)
      .set(as('demo-officer-sunrise'))
      .expect(403);
    expect(forbidden.body.error).toMatchObject({
      code: 'FORBIDDEN',
      message: 'This document can only be opened by District Managers and HQ',
    });
    const officerList = await http()
      .get('/api/v1/documents')
      .set(as('demo-officer-sunrise'))
      .expect(200);
    expect(officerList.body.meta.totalItems).toBe(0);

    await http()
      .get(`/api/v1/documents/${membersList.id}/download`)
      .set(as('demo-dm-north'))
      .expect(200);
    await http()
      .get(`/api/v1/documents/${membersList.id}`)
      .set(as('demo-hq-admin'))
      .expect(200);
    await http()
      .get(`/api/v1/documents/${membersList.id}`)
      .set(as('demo-dm-central'))
      .expect(404);
  });

  it('validates new documents', async () => {
    const valid = {
      societyId: SUNRISE,
      documentType: 'AUDIT_REPORT',
      financialYear: AUDIT_YEAR,
      title: 'Audit report',
      fileName: 'audit.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
    };
    const send = (body: Record<string, unknown>) =>
      http()
        .post('/api/v1/documents')
        .set(as('demo-officer-sunrise'))
        .send(body);

    const tooLarge = await send({ ...valid, sizeBytes: 14_000_000 }).expect(
      400,
    );
    expect(tooLarge.body.error.code).toBe('VALIDATION_ERROR');
    await send({
      ...valid,
      contentType: 'application/msword',
      fileName: 'audit.doc',
    }).expect(400);
    await send({ ...valid, fileName: '../../etc/passwd.pdf' }).expect(400);
    await send({ ...valid, fileName: 'audit.png' }).expect(400);
    await send({ ...valid, documentType: 'SECRET' }).expect(400);
    await send({ ...valid, storageKey: 'societies/x' }).expect(400);
    // SC-65: audit reports need one of the last completed financial years.
    const { financialYear: _year, ...withoutYear } = valid;
    await send(withoutYear).expect(400);
    await send({ ...valid, financialYear: AUDIT_YEAR + 1 }).expect(400);
    await send({ ...valid, financialYear: AUDIT_YEAR - 5 }).expect(400);
    await send({
      ...valid,
      documentType: 'AGM_MINUTES',
      title: 'AGM minutes',
    }).expect(400);
    expect(documents.rows).toHaveLength(0);
  });

  it('lets only the Society Officer or assigned SPC upload the audit report (SC-65)', async () => {
    const auditReport = {
      societyId: SUNRISE,
      documentType: 'AUDIT_REPORT',
      financialYear: AUDIT_YEAR,
      title: 'Audit report',
      fileName: 'audit.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
    };
    const post = (user: string, body: Record<string, unknown>) =>
      http().post('/api/v1/documents').set(as(user)).send(body);

    // The District Manager only views societies in the district.
    const manager = await post('demo-dm-north', auditReport).expect(403);
    expect(manager.body.error.code).toBe('FORBIDDEN');
    await post('demo-dm-north', {
      ...auditReport,
      documentType: 'AGM_MINUTES',
      financialYear: undefined,
    }).expect(403);
    // Entering yearly figures and the audit report is still to be confirmed for DDMs and HQ.
    await post('demo-deputy-district-manager', auditReport).expect(403);
    await post('demo-hq-admin', auditReport).expect(403);
    // Societies outside the user's scope stay hidden.
    await post('demo-officer-lotus', auditReport).expect(404);

    const created = await post(
      'demo-programme-coordinator',
      auditReport,
    ).expect(201);
    expect(created.body.document).toMatchObject({
      title: `Audit report FY ${AUDIT_YEAR}/${String((AUDIT_YEAR + 1) % 100).padStart(2, '0')}`,
      financialYear: { startYear: AUDIT_YEAR },
      uploadedByRole: 'PROGRAMME_COORDINATOR',
    });
  });

  it('only accepts uploads that match the signed link', async () => {
    const created = await http()
      .post('/api/v1/documents')
      .set(as('demo-officer-sunrise'))
      .send({
        societyId: SUNRISE,
        documentType: 'FINANCE',
        title: 'Bank statement',
        fileName: 'bank.pdf',
        contentType: 'application/pdf',
        sizeBytes: PDF.length,
      })
      .expect(201);
    const path = pathOf(created.body.upload.url);

    await http()
      .put(path)
      .set('Content-Type', 'image/png')
      .send(PDF)
      .expect(400);
    await http()
      .put(path)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.concat([PDF, PDF]))
      .expect(400);
    await http()
      .put(`${path.slice(0, -4)}AAAA`)
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(403);
    await http().get(path).expect(403);
    await http()
      .put(path)
      .set('Content-Type', 'application/pdf')
      .send(PDF)
      .expect(200);
  });

  it('notifies the reviewers of the district when a document is submitted', async () => {
    const document = await uploadDocument('demo-officer-sunrise', {
      societyId: SUNRISE,
      documentType: 'AUDIT_REPORT',
      financialYear: AUDIT_YEAR,
      title: 'Audit report FY 2025/26',
      fileName: 'audit.pdf',
    });

    const north = await http()
      .get('/api/v1/notifications')
      .set(as('demo-dm-north'))
      .expect(200);
    expect(north.body.meta.unreadCount).toBe(1);
    expect(north.body.data[0]).toMatchObject({
      category: 'APPROVAL',
      title: 'Audit report from Example Sunrise Society is waiting for review',
      linkPath: `/documents?society=${SUNRISE}`,
      documentId: document.id,
      read: false,
    });
    const central = await http()
      .get('/api/v1/notifications')
      .set(as('demo-dm-central'))
      .expect(200);
    expect(central.body.meta.totalItems).toBe(0);
    const officer = await http()
      .get('/api/v1/notifications')
      .set(as('demo-officer-sunrise'))
      .expect(200);
    expect(officer.body.meta.totalItems).toBe(0);

    const id = north.body.data[0].id as string;
    await http()
      .post(`/api/v1/notifications/${id}/read`)
      .set(as('demo-dm-central'))
      .expect(404);
    await http()
      .post(`/api/v1/notifications/${id}/read`)
      .set(as('demo-dm-north'))
      .expect(200)
      .expect({ id, read: true });
    const unread = await http()
      .get('/api/v1/notifications')
      .query({ unreadOnly: 'true' })
      .set(as('demo-dm-north'))
      .expect(200);
    expect(unread.body.meta).toMatchObject({ totalItems: 0, unreadCount: 0 });

    await http()
      .post('/api/v1/notifications/read-all')
      .set(as('demo-hq-admin'))
      .expect(200)
      .expect({ updated: 1 });
  });
});
