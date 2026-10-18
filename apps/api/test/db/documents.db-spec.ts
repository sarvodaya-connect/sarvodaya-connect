/**
 * Database tests: run against a real PostgreSQL with the migrations applied
 * (`npm run prisma:deploy`, then `npm run test:db`). CI provides a throwaway
 * PostgreSQL 17 service. Only fictional records are created, and every
 * document and notification created here is removed afterwards.
 */
import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { documentScopeFilter } from '../../src/documents/document-access.policy.js';
import {
  DocumentsRepository,
  type NewDocument,
} from '../../src/documents/documents.repository.js';
import { findDemoPrincipal } from '../../src/auth/demo-principals.js';
import { NotificationsRepository } from '../../src/notifications/notifications.repository.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl)
  throw new Error('DATABASE_URL is required for database tests');
if (
  !['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)
) {
  throw new Error('Database tests only run against a local PostgreSQL');
}

// The fictional SC-29 seed districts and societies that the demo users cover.
const NORTH = {
  id: '29000000-0000-4000-8000-000000000001',
  code: 'DEMO-N',
  nameEn: 'Fictional North District',
};
const CENTRAL = {
  id: '29000000-0000-4000-8000-000000000002',
  code: 'DEMO-C',
  nameEn: 'Fictional Central District',
};
const SUNRISE = {
  id: '29000000-0000-4000-8000-000000000101',
  societyCode: 'DEMO-SOC-001',
  nameEn: 'Example Sunrise Society',
  districtId: NORTH.id,
  status: 'ACTIVE' as const,
};
const LOTUS = {
  id: '29000000-0000-4000-8000-000000000103',
  societyCode: 'DEMO-SOC-003',
  nameEn: 'Example Lotus Society',
  districtId: CENTRAL.id,
  status: 'ACTIVE' as const,
};

describe('Document and notification persistence (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let documents: DocumentsRepository;
  let notifications: NotificationsRepository;
  let storageDir: string;
  const createdDocumentIds: string[] = [];
  const createdNotificationTitles: string[] = [];
  const runId = randomUUID().slice(0, 8);

  function newDocument(overrides: Partial<NewDocument> = {}): NewDocument {
    const id = randomUUID();
    createdDocumentIds.push(id);
    return {
      id,
      societyId: SUNRISE.id,
      documentType: 'AUDIT_REPORT',
      title: `Audit report ${runId}`,
      fileName: 'audit-report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1_400_000,
      storageKey: `societies/${SUNRISE.id}/documents/${id}.pdf`,
      accessLevel: 'STANDARD',
      uploadedById: 'demo-officer-sunrise',
      uploadedByName: 'Demo Officer (Example Sunrise Society)',
      ...overrides,
    };
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'sc49-db-'));
    process.env['LOCAL_STORAGE_DIR'] = storageDir;
    process.env['STORAGE_SIGNING_SECRET'] = 'db-test-only-secret';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
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

    prisma = app.get(PrismaService);
    documents = app.get(DocumentsRepository);
    notifications = app.get(NotificationsRepository);

    // Same values as prisma/seed.ts, so this is safe on a seeded database.
    for (const district of [NORTH, CENTRAL]) {
      await prisma.district.upsert({
        where: { id: district.id },
        create: district,
        update: {},
      });
    }
    for (const society of [SUNRISE, LOTUS]) {
      await prisma.society.upsert({
        where: { id: society.id },
        create: society,
        update: {},
      });
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { documentId: { in: createdDocumentIds } },
            { title: { in: createdNotificationTitles } },
          ],
        },
      });
      await prisma.societyDocument.deleteMany({
        where: { id: { in: createdDocumentIds } },
      });
    }
    await app?.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('stores society, uploader, type, status, version and timestamps', async () => {
    const first = await documents.create(newDocument());
    const second = await documents.create(newDocument());

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT society_id, document_type::text, status::text, access_level::text, version,
             uploaded_by_id, uploaded_by_name, uploaded_at, created_at, updated_at, storage_key
      FROM society_documents WHERE id = ${second.id}::uuid`;
    expect(row).toMatchObject({
      society_id: SUNRISE.id,
      document_type: 'AUDIT_REPORT',
      status: 'DRAFT',
      access_level: 'STANDARD',
      version: 2,
      uploaded_by_id: 'demo-officer-sunrise',
      uploaded_by_name: 'Demo Officer (Example Sunrise Society)',
      uploaded_at: null,
      storage_key: `societies/${SUNRISE.id}/documents/${second.id}.pdf`,
    });
    expect(row?.['created_at']).toBeInstanceOf(Date);

    const uploadedAt = new Date('2026-10-18T10:05:00.000Z');
    const uploaded = await documents.markUploaded(second.id, uploadedAt);
    expect(uploaded).toMatchObject({ status: 'SUBMITTED', uploadedAt });
    expect(uploaded.updatedAt.getTime()).toBeGreaterThanOrEqual(
      uploaded.createdAt.getTime(),
    );
  });

  it('filters lists by scope in SQL and hides restricted and unfinished uploads', async () => {
    const title = `Scope check ${runId}`;
    const standard = await documents.create(
      newDocument({ title, documentType: 'AGM_MINUTES' }),
    );
    await documents.markUploaded(standard.id, new Date());
    const restricted = await documents.create(
      newDocument({
        title,
        documentType: 'MEMBERS_LIST',
        accessLevel: 'REVIEWERS_ONLY',
      }),
    );
    await documents.markUploaded(restricted.id, new Date());
    const draft = await documents.create(
      newDocument({ title, documentType: 'FINANCE' }),
    );
    const lotus = await documents.create(
      newDocument({
        title,
        societyId: LOTUS.id,
        documentType: 'AGM_MINUTES',
        storageKey: `societies/${LOTUS.id}/documents/${randomUUID()}.pdf`,
      }),
    );
    await documents.markUploaded(lotus.id, new Date());

    const idsFor = async (userId: string) => {
      const { records } = await documents.list({
        scope: documentScopeFilter(findDemoPrincipal(userId)!),
        page: 1,
        pageSize: 100,
      });
      return records
        .filter((record) => record.title === title)
        .map((record) => record.id)
        .sort();
    };

    expect(await idsFor('demo-officer-sunrise')).toEqual([standard.id]);
    expect(await idsFor('demo-dm-north')).toEqual(
      [standard.id, restricted.id].sort(),
    );
    expect(await idsFor('demo-dm-central')).toEqual([lotus.id]);
    expect(await idsFor('demo-hq-admin')).toEqual(
      [standard.id, restricted.id, lotus.id].sort(),
    );
    expect(await idsFor('demo-hq-admin')).not.toContain(draft.id);

    const filtered = await documents.list({
      scope: documentScopeFilter(findDemoPrincipal('demo-hq-admin')!),
      districtId: CENTRAL.id,
      documentType: 'AGM_MINUTES',
      status: 'SUBMITTED',
      page: 1,
      pageSize: 100,
    });
    expect(filtered.records.map((record) => record.id)).toContain(lotus.id);
    expect(filtered.records.map((record) => record.id)).not.toContain(
      standard.id,
    );
  });

  it('enforces the document rules in the database', async () => {
    const invalid = async (overrides: Record<string, unknown>) => {
      const document = newDocument();
      await expect(
        prisma.societyDocument.create({ data: { ...document, ...overrides } }),
      ).rejects.toThrow();
    };

    await invalid({ sizeBytes: 0 });
    await invalid({ sizeBytes: 10_000_001 });
    await invalid({ contentType: 'text/html' });
    await invalid({ documentType: 'MEMBERS_LIST', accessLevel: 'STANDARD' });
    await invalid({ status: 'SUBMITTED', uploadedAt: null });
    await invalid({ version: 0 });

    const existing = await documents.create(newDocument());
    await expect(
      documents.create(newDocument({ storageKey: existing.storageKey })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps societies with documents and clears notification links when a document is removed', async () => {
    const document = await documents.create(newDocument());
    // A society that has documents cannot be deleted.
    await expect(
      prisma.society.delete({ where: { id: SUNRISE.id } }),
    ).rejects.toThrow();

    const title = `Linked notification ${runId}`;
    createdNotificationTitles.push(title);
    await notifications.createMany([
      {
        recipientUserId: 'demo-dm-north',
        category: 'APPROVAL',
        title,
        societyId: SUNRISE.id,
        documentId: document.id,
      },
    ]);

    await prisma.societyDocument.delete({ where: { id: document.id } });
    const notification = await prisma.notification.findFirstOrThrow({
      where: { title },
    });
    expect(notification.documentId).toBeNull();
    expect(notification.societyId).toBe(SUNRISE.id);
  });

  it('stores notifications per recipient with read state', async () => {
    const recipient = `db-test-${runId}`;
    const titles = [`First ${runId}`, `Second ${runId}`];
    createdNotificationTitles.push(...titles);
    await notifications.createMany(
      titles.map((title) => ({
        recipientUserId: recipient,
        category: 'AUDIT' as const,
        title,
      })),
    );

    const before = await notifications.listForRecipient(recipient, {
      unreadOnly: false,
      page: 1,
      pageSize: 10,
    });
    expect(before.totalItems).toBe(2);
    expect(before.unreadCount).toBe(2);

    expect(
      await notifications.markRead(
        before.records[0]!.id,
        'someone-else',
        new Date(),
      ),
    ).toBe(0);
    expect(
      await notifications.markRead(
        before.records[0]!.id,
        recipient,
        new Date(),
      ),
    ).toBe(1);
    const after = await notifications.listForRecipient(recipient, {
      unreadOnly: true,
      page: 1,
      pageSize: 10,
    });
    expect(after).toMatchObject({ totalItems: 1, unreadCount: 1 });
    expect(await notifications.markAllRead(recipient, new Date())).toBe(1);
  });

  it('persists a document uploaded through the API', async () => {
    const http = () => request(app.getHttpServer());
    const file = Buffer.from('%PDF-1.7\nfictional\n%%EOF\n');
    const created = await http()
      .post('/api/v1/documents')
      .set('X-Demo-User', 'demo-officer-sunrise')
      .send({
        societyId: SUNRISE.id,
        documentType: 'OFFICE_BEARER_LIST',
        title: `Office-bearer list ${runId}`,
        fileName: 'office-bearers.pdf',
        contentType: 'application/pdf',
        sizeBytes: file.length,
      })
      .expect(201);
    createdDocumentIds.push(created.body.document.id as string);

    await http()
      .put(new URL(created.body.upload.url as string).pathname)
      .set('Content-Type', 'application/pdf')
      .send(file)
      .expect(200);
    await http()
      .post(`/api/v1/documents/${created.body.document.id}/complete`)
      .set('X-Demo-User', 'demo-officer-sunrise')
      .expect(200);

    const stored = await prisma.societyDocument.findUniqueOrThrow({
      where: { id: created.body.document.id as string },
    });
    expect(stored).toMatchObject({
      status: 'SUBMITTED',
      sizeBytes: file.length,
      uploadedById: 'demo-officer-sunrise',
    });
    expect(stored.uploadedAt).toBeInstanceOf(Date);
    const reviewerNotifications = await prisma.notification.findMany({
      where: { documentId: stored.id },
    });
    expect(
      reviewerNotifications
        .map((notification) => notification.recipientUserId)
        .sort(),
    ).toEqual(['demo-dm-north', 'demo-hq-admin']);
  });
});
