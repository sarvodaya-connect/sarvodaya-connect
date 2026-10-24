/**
 * Database tests for the submission workflow: run against a real PostgreSQL
 * with migrations applied (`npm run prisma:deploy`, then `npm run test:db`).
 *
 * submission_events and audit_log are append-only (triggers) and events are
 * ON DELETE RESTRICT, so fixtures cannot be deleted. Every fixture is titled
 * "db-test <runId>" and is forced to a closed status after each test so that
 * reruns never collide with the open-submission unique index.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { ApiExceptionFilter } from '../../src/common/api-exception.filter.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { SubmissionTypeValue } from '../../src/submissions/dto/submission.dto.js';
import { SubmissionsRepository } from '../../src/submissions/submissions.repository.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL is required for database tests');
if (!['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Database tests only run against a local PostgreSQL');
}

// Same fictional SC-29 seed values as the documents DB spec.
const NORTH = {
  id: '29000000-0000-4000-8000-000000000001',
  code: 'DEMO-N',
  nameEn: 'Fictional North District',
};
const SUNRISE = {
  id: '29000000-0000-4000-8000-000000000101',
  societyCode: 'DEMO-SOC-001',
  nameEn: 'Example Sunrise Society',
  districtId: NORTH.id,
  status: 'ACTIVE' as const,
};

const OFFICER = { id: 'demo-officer-sunrise', name: 'Demo Officer (Example Sunrise Society)' };
const MANAGER = { id: 'demo-dm-north', name: 'Demo District Manager (Fictional North District)' };
const OTHER_MANAGER = { id: 'demo-dm-central', name: 'Demo District Manager (Fictional Central District)' };

const OPEN_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED'] as const;

describe('Submission workflow persistence (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let repo: SubmissionsRepository;
  let storageDir: string;
  const created: string[] = [];
  const runId = randomUUID().slice(0, 8);

  const closeFixtures = (ids: string[]) =>
    prisma.submission.updateMany({
      where: { id: { in: ids }, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'REJECTED' },
    });

  async function draft(
    type: SubmissionTypeValue = 'COUNCIL_UPDATE',
    fields = ['treasurer.fullName', 'secretary.fullName'],
  ) {
    const { id } = await repo.create({
      societyId: SUNRISE.id,
      type,
      title: `db-test ${runId}`,
      actor: OFFICER,
      changes: fields.map((field) => ({
        field,
        label: field,
        previousValue: 'old',
        proposedValue: 'new',
      })),
    });
    created.push(id);
    return id;
  }

  const row = (id: string) => prisma.submission.findUniqueOrThrow({ where: { id } });
  const events = (id: string) => prisma.submissionEvent.findMany({ where: { submissionId: id } });
  const audit = (id: string) => prisma.auditLogEntry.findMany({ where: { entityId: id } });

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'sc46-db-'));
    process.env['LOCAL_STORAGE_DIR'] = storageDir;
    process.env['STORAGE_SIGNING_SECRET'] = 'db-test-only-secret';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    repo = app.get(SubmissionsRepository);

    await prisma.district.upsert({ where: { id: NORTH.id }, create: NORTH, update: {} });
    await prisma.society.upsert({ where: { id: SUNRISE.id }, create: SUNRISE, update: {} });

    // Close anything a crashed earlier run left open.
    await prisma.submission.updateMany({
      where: { title: { startsWith: 'db-test ' }, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'REJECTED' },
    });
  });

  afterEach(async () => {
    await closeFixtures(created);
  });

  afterAll(async () => {
    if (prisma) await closeFixtures(created);
    await app?.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('persists a full lifecycle with one event and one audit row per step', async () => {
    const id = await draft();
    const ok = [
      await repo.transition({
        id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER,
        data: { submittedAt: new Date() },
      }),
      await repo.transition({
        id, version: 2, from: 'SUBMITTED', to: 'UNDER_REVIEW', action: 'START_REVIEW', actor: MANAGER,
        data: { reviewerId: MANAGER.id, reviewerName: MANAGER.name, reviewStartedAt: new Date() },
      }),
      await repo.transition({
        id, version: 3, from: 'UNDER_REVIEW', to: 'CHANGES_REQUESTED', action: 'REQUEST_CHANGES',
        actor: MANAGER, data: { decidedAt: new Date() },
        fieldUpdates: [
          { field: 'treasurer.fullName', data: { correctionStatus: 'REQUIRED', reviewerComment: 'Use full legal name' } },
        ],
      }),
      await repo.transition({
        id, version: 4, from: 'CHANGES_REQUESTED', to: 'RESUBMITTED', action: 'RESUBMIT', actor: OFFICER,
        data: { submittedAt: new Date() },
        fieldUpdates: [
          { field: 'treasurer.fullName', data: { correctionStatus: 'CORRECTED', correctedValue: 'B Perera' } },
        ],
      }),
      await repo.transition({
        id, version: 5, from: 'RESUBMITTED', to: 'UNDER_REVIEW', action: 'START_REVIEW', actor: MANAGER,
      }),
      await repo.transition({
        id, version: 6, from: 'UNDER_REVIEW', to: 'APPROVED', action: 'APPROVE', actor: MANAGER,
        comment: 'Looks good', data: { decidedAt: new Date() },
      }),
    ];
    expect(ok).toEqual([true, true, true, true, true, true]);

    const final = await row(id);
    expect(final).toMatchObject({ status: 'APPROVED', version: 7, reviewerId: MANAGER.id });
    expect(final.submittedAt).toBeInstanceOf(Date);
    expect(final.reviewStartedAt).toBeInstanceOf(Date);
    expect(final.decidedAt).toBeInstanceOf(Date);
    expect(final.updatedAt.getTime()).toBeGreaterThanOrEqual(final.createdAt.getTime());

    const treasurer = await prisma.submissionField.findFirstOrThrow({
      where: { submissionId: id, field: 'treasurer.fullName' },
    });
    expect(treasurer).toMatchObject({
      correctionStatus: 'CORRECTED',
      reviewerComment: 'Use full legal name',
      correctedValue: 'B Perera',
    });

    expect((await events(id)).map((e) => e.action).sort()).toEqual(
      ['APPROVE', 'REQUEST_CHANGES', 'RESUBMIT', 'START_REVIEW', 'START_REVIEW', 'SUBMIT'],
    );
    const entries = await audit(id);
    expect(entries.map((e) => e.action).sort()).toEqual(
      [
        'SUBMISSION_APPROVE', 'SUBMISSION_CREATED', 'SUBMISSION_REQUEST_CHANGES',
        'SUBMISSION_RESUBMIT', 'SUBMISSION_START_REVIEW', 'SUBMISSION_START_REVIEW',
        'SUBMISSION_SUBMIT',
      ],
    );
    const approval = entries.find((e) => e.action === 'SUBMISSION_APPROVE');
    expect(approval?.metadata).toMatchObject({
      from: 'UNDER_REVIEW', to: 'APPROVED', version: 6, comment: 'Looks good',
    });
  });

  it('refuses a stale version or wrong status and writes nothing', async () => {
    const id = await draft();
    await repo.transition({ id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER });

    const staleVersion = await repo.transition({
      id, version: 1, from: 'SUBMITTED', to: 'UNDER_REVIEW', action: 'START_REVIEW', actor: MANAGER,
    });
    const wrongStatus = await repo.transition({
      id, version: 2, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER,
    });
    expect(staleVersion).toBe(false);
    expect(wrongStatus).toBe(false);

    expect(await row(id)).toMatchObject({ status: 'SUBMITTED', version: 2 });
    expect(await events(id)).toHaveLength(1);
    expect(await audit(id)).toHaveLength(2); // CREATED + SUBMIT
  });

  it('lets exactly one of many concurrent transitions win', async () => {
    const id = await draft();
    await repo.transition({ id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        repo.transition({
          id, version: 2, from: 'SUBMITTED', to: 'UNDER_REVIEW', action: 'START_REVIEW',
          actor: { id: `racer-${i}`, name: `Racer ${i}` },
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await row(id)).toMatchObject({ status: 'UNDER_REVIEW', version: 3 });
    expect(await events(id)).toHaveLength(2); // SUBMIT + exactly one START_REVIEW
    expect(await audit(id)).toHaveLength(3); // CREATED + SUBMIT + START_REVIEW
  });

  it('answers two simultaneous approvals with one 200 and one 409', async () => {
    const id = await draft();
    const http = () => request(app.getHttpServer());
    const as = (user: string) => ({ 'X-Demo-User': user });

    await http().post(`/api/v1/submissions/${id}/submit`).set(as(OFFICER.id)).send({ version: 1 }).expect(200);
    await http().post(`/api/v1/submissions/${id}/start-review`).set(as(MANAGER.id)).send({ version: 2 }).expect(200);

    const responses = await Promise.all([
      http().post(`/api/v1/submissions/${id}/approve`).set(as(MANAGER.id)).send({ version: 3 }),
      http().post(`/api/v1/submissions/${id}/approve`).set(as(MANAGER.id)).send({ version: 3 }),
    ]);
    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(await row(id)).toMatchObject({ status: 'APPROVED', version: 4 });
    expect((await events(id)).filter((e) => e.action === 'APPROVE')).toHaveLength(1);
  });

  it('rolls everything back when one step inside the transaction fails', async () => {
    const id = await draft();
    await repo.transition({ id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER });
    await repo.transition({ id, version: 2, from: 'SUBMITTED', to: 'UNDER_REVIEW', action: 'START_REVIEW', actor: MANAGER });
    const before = { events: (await events(id)).length, audit: (await audit(id)).length };

    // The status update succeeds first, then the unknown field makes the transaction throw.
    await expect(
      repo.transition({
        id, version: 3, from: 'UNDER_REVIEW', to: 'CHANGES_REQUESTED', action: 'REQUEST_CHANGES',
        actor: MANAGER,
        fieldUpdates: [{ field: 'does.not.exist', data: { correctionStatus: 'REQUIRED', reviewerComment: 'x' } }],
      }),
    ).rejects.toThrow();

    expect(await row(id)).toMatchObject({ status: 'UNDER_REVIEW', version: 3 });
    expect((await events(id)).length).toBe(before.events);
    expect((await audit(id)).length).toBe(before.audit);
  });

  it('allows only one open submission per society and type', async () => {
    await draft('PROFILE_UPDATE');
    // The partial unique index rejects this. The API currently surfaces the race as 503, not 409.
    await expect(draft('PROFILE_UPDATE')).rejects.toThrow();
    // A different type is fine.
    await expect(draft('MEMBERSHIP_COUNTS')).resolves.toBeTruthy();
  });

  it('allows a new open submission once the previous one is closed', async () => {
    const first = await draft('ACTIVITY_REPORT');
    await closeFixtures([first]);
    await expect(draft('ACTIVITY_REPORT')).resolves.toBeTruthy();
  });

  it('rejects duplicate fields inside one submission', async () => {
    await expect(draft('PAYMENT', ['same.field', 'same.field'])).rejects.toThrow();
  });

  it('keeps history append-only: no update or delete on events or audit rows', async () => {
    const id = await draft();
    await repo.transition({ id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER });

    await expect(
      prisma.submissionEvent.updateMany({ where: { submissionId: id }, data: { comment: 'tampered' } }),
    ).rejects.toThrow();
    await expect(prisma.submissionEvent.deleteMany({ where: { submissionId: id } })).rejects.toThrow();
    await expect(
      prisma.auditLogEntry.updateMany({ where: { entityId: id }, data: { action: 'TAMPERED' } }),
    ).rejects.toThrow();
    await expect(prisma.auditLogEntry.deleteMany({ where: { entityId: id } })).rejects.toThrow();

    expect(await events(id)).toHaveLength(1);
    expect((await audit(id)).every((e) => e.action !== 'TAMPERED')).toBe(true);
  });

  it('refuses to delete a submission that has history', async () => {
    const id = await draft();
    await repo.transition({ id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER });
    await expect(prisma.submission.delete({ where: { id } })).rejects.toThrow();
    expect(await row(id)).toMatchObject({ status: 'SUBMITTED' });
  });

  it('keeps reviewers from other districts out of the record', async () => {
    const id = await draft();
    await repo.transition({ id, version: 1, from: 'DRAFT', to: 'SUBMITTED', action: 'SUBMIT', actor: OFFICER });
    const http = () => request(app.getHttpServer());
    await http().get(`/api/v1/submissions/${id}`).set('X-Demo-User', OTHER_MANAGER.id).expect(404);
    await http().get(`/api/v1/submissions/${id}`).set('X-Demo-User', MANAGER.id).expect(200);
  });
});
