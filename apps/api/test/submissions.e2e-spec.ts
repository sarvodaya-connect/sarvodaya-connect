import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from './../src/app.module.js';
import { ApiExceptionFilter } from './../src/common/api-exception.filter.js';
import { DocumentsRepository } from './../src/documents/documents.repository.js';
import { NotificationsRepository } from './../src/notifications/notifications.repository.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import {
  SubmissionsRepository,
  type NewSubmission,
  type TransitionInput,
} from './../src/submissions/submissions.repository.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const SUNRISE = '29000000-0000-4000-8000-000000000101';
const LOTUS = '29000000-0000-4000-8000-000000000103';

const OFFICER = 'demo-officer-sunrise';
const MANAGER = 'demo-dm-north';
const OTHER_MANAGER = 'demo-dm-central';

const societies = [{ id: SUNRISE, districtId: NORTH }];
const OPEN = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED'];

/** In-memory stand-in for PostgreSQL with the same optimistic-locking rule as the real repository. */
class InMemorySubmissionsRepository {
  rows: any[] = [];
  auditActions: string[] = [];
  private seq = 0;

  findById(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return Promise.resolve(null);
    const society = societies.find((s) => s.id === row.societyId) ?? { districtId: 'unknown' };
    return Promise.resolve({
      ...row,
      fields: [...row.fields].sort((a, b) => a.field.localeCompare(b.field)),
      society: { districtId: society.districtId },
    });
  }

  findSociety(id: string) {
    const society = societies.find((s) => s.id === id);
    return Promise.resolve(society ? { id: society.id, districtId: society.districtId } : null);
  }

  findOpen(societyId: string, type: string) {
    const row = this.rows.find(
      (r) => r.societyId === societyId && r.type === type && OPEN.includes(r.status),
    );
    return Promise.resolve(row ? { id: row.id } : null);
  }

  list(where: any, page: number, pageSize: number) {
    let rows = this.rows.filter((r) => {
      if (where.status?.not && r.status === where.status.not) return false;
      if (typeof where.status === 'string' && r.status !== where.status) return false;
      if (where.societyId?.in && !where.societyId.in.includes(r.societyId)) return false;
      if (where.society?.districtId?.in) {
        const society = societies.find((s) => s.id === r.societyId);
        if (!society || !where.society.districtId.in.includes(society.districtId)) return false;
      }
      return true;
    });
    const totalItems = rows.length;
    rows = rows.slice((page - 1) * pageSize, page * pageSize);
    return Promise.all(rows.map((r) => this.findById(r.id))).then((records) => ({
      records,
      totalItems,
    }));
  }

  create(input: NewSubmission) {
    const now = new Date();
    const row = {
      id: randomUUID(),
      seq: ++this.seq,
      societyId: input.societyId,
      type: input.type,
      title: input.title,
      submittedById: input.actor.id,
      submittedByName: input.actor.name,
      status: 'DRAFT',
      version: 1,
      reviewerId: null,
      reviewerName: null,
      reviewStartedAt: null,
      submittedAt: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
      events: [] as any[],
      fields: input.changes.map((c) => ({
        field: c.field,
        label: c.label,
        previousValue: c.previousValue ?? null,
        proposedValue: c.proposedValue,
        correctionStatus: 'NONE',
        reviewerComment: null,
        correctedValue: null,
      })),
    };
    this.rows.push(row);
    this.auditActions.push('SUBMISSION_CREATED');
    return Promise.resolve({ id: row.id });
  }

  transition(input: TransitionInput) {
    const row = this.rows.find((r) => r.id === input.id);
    if (!row || row.version !== input.version || row.status !== input.from) {
      return Promise.resolve(false);
    }
    Object.assign(row, input.data ?? {}, {
      status: input.to,
      version: row.version + 1,
      updatedAt: new Date(),
    });
    for (const update of input.fieldUpdates ?? []) {
      Object.assign(
        row.fields.find((f: any) => f.field === update.field),
        update.data,
      );
    }
    row.events.push({
      id: randomUUID(),
      action: input.action,
      fromStatus: input.from,
      toStatus: input.to,
      actorId: input.actor.id,
      actorName: input.actor.name,
      comment: input.comment ?? null,
      createdAt: new Date(),
    });
    this.auditActions.push(`SUBMISSION_${input.action}`);
    return Promise.resolve(true);
  }
}

describe('Submissions workflow (e2e)', () => {
  let app: INestApplication;
  let repo: InMemorySubmissionsRepository;
  let storageDir: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'sarvodaya-submissions-e2e-'));
    process.env['DOCUMENT_STORAGE_DIR'] = storageDir; // adjust to match documents.e2e-spec.ts

    repo = new InMemorySubmissionsRepository();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DocumentsRepository)
      .useValue({})
      .overrideProvider(NotificationsRepository)
      .useValue({})
      .overrideProvider(SubmissionsRepository)
      .useValue(repo)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo.rows = [];
    repo.auditActions = [];
  });

  // ---- helpers ----
  const http = () => request(app.getHttpServer());
  const post = (path: string, user: string, body: object) =>
    http().post(`/api/v1/submissions${path}`).set('X-Demo-User', user).send(body);
  const getOne = (id: string, user: string) =>
    http().get(`/api/v1/submissions/${id}`).set('X-Demo-User', user);

  const draftBody = (overrides: object = {}) => ({
    societyId: SUNRISE,
    type: 'COUNCIL_UPDATE',
    title: 'Treasurer change',
    changes: [
      { field: 'treasurer.fullName', label: 'Treasurer', previousValue: 'A', proposedValue: 'B' },
      { field: 'secretary.fullName', label: 'Secretary', previousValue: 'C', proposedValue: 'D' },
    ],
    ...overrides,
  });

  const createDraft = async () => {
    const res = await post('', OFFICER, draftBody()).expect(201);
    return res.body as { id: string; version: number };
  };
  const toSubmitted = async () => {
    const { id } = await createDraft();
    await post(`/${id}/submit`, OFFICER, { version: 1 }).expect(200);
    return id; // version 2
  };
  const toUnderReview = async () => {
    const id = await toSubmitted();
    await post(`/${id}/start-review`, MANAGER, { version: 2 }).expect(200);
    return id; // version 3
  };
  const toChangesRequested = async () => {
    const id = await toUnderReview();
    await post(`/${id}/request-changes`, MANAGER, {
      version: 3,
      fields: [{ field: 'treasurer.fullName', comment: 'Use full legal name' }],
    }).expect(200);
    return id; // version 4
  };
  const toResubmitted = async () => {
    const id = await toChangesRequested();
    await post(`/${id}/resubmit`, OFFICER, {
      version: 4,
      corrections: [{ field: 'treasurer.fullName', correctedValue: 'B Perera' }],
    }).expect(200);
    return id; // version 5
  };

  // ---- happy paths ----
  describe('happy paths', () => {
    it('creates a draft the officer can submit', async () => {
      const res = await post('', OFFICER, draftBody()).expect(201);
      expect(res.body).toMatchObject({
        status: 'DRAFT',
        version: 1,
        editable: true,
        allowedActions: ['SUBMIT'],
        events: [],
      });
      expect(res.body.reference).toMatch(/^SUB-\d{5}$/);
    });

    it('runs submit, review, return, resubmit and approve with a version bump each time', async () => {
      const id = await toResubmitted();
      const resubmitted = await getOne(id, OFFICER).expect(200);
      expect(resubmitted.body).toMatchObject({
        status: 'RESUBMITTED',
        version: 5,
        correctionStatus: 'CORRECTED',
        editable: false,
        allowedActions: [],
      });

      const review = await post(`/${id}/start-review`, MANAGER, { version: 5 }).expect(200);
      expect(review.body).toMatchObject({ status: 'UNDER_REVIEW', version: 6 });

      const approved = await post(`/${id}/approve`, MANAGER, { version: 6 }).expect(200);
      expect(approved.body.status).toBe('APPROVED');
      expect(approved.body.version).toBe(7);
      expect(approved.body.allowedActions).toEqual([]);
    });

    it('records one event and one audit entry per transition', async () => {
      const id = await toResubmitted();
      const res = await getOne(id, MANAGER).expect(200);
      expect(res.body.events.map((e: any) => e.action)).toEqual([
        'SUBMIT',
        'START_REVIEW',
        'REQUEST_CHANGES',
        'RESUBMIT',
      ]);
      expect(repo.auditActions).toEqual([
        'SUBMISSION_CREATED',
        'SUBMISSION_SUBMIT',
        'SUBMISSION_START_REVIEW',
        'SUBMISSION_REQUEST_CHANGES',
        'SUBMISSION_RESUBMIT',
      ]);
    });

    it('returns field-level comments and corrected values', async () => {
      const id = await toChangesRequested();
      const res = await getOne(id, OFFICER).expect(200);
      expect(res.body).toMatchObject({ correctionStatus: 'REQUIRED', editable: true });
      const treasurer = res.body.changes.find((c: any) => c.field === 'treasurer.fullName');
      const secretary = res.body.changes.find((c: any) => c.field === 'secretary.fullName');
      expect(treasurer).toMatchObject({
        correctionStatus: 'REQUIRED',
        reviewerComment: 'Use full legal name',
      });
      expect(secretary.correctionStatus).toBe('NONE');
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0].decision).toBe('CHANGES_REQUESTED');
    });

    it('rejects with a reason and records it', async () => {
      const id = await toUnderReview();
      const res = await post(`/${id}/reject`, MANAGER, {
        version: 3,
        comment: 'Not a registered member',
      }).expect(200);
      expect(res.body.status).toBe('REJECTED');
      expect(res.body.reviews[0]).toMatchObject({
        decision: 'REJECTED',
        comment: 'Not a registered member',
      });
    });
  });

  // ---- permissions and scope ----
  describe('permissions and scope', () => {
    it('401 without an identity', async () => {
      await http().get('/api/v1/submissions').expect(401);
    });

    it('403 when an officer tries to approve', async () => {
      const id = await toResubmitted();
      await post(`/${id}/approve`, OFFICER, { version: 5 }).expect(403);
    });

    it('403 when a manager tries to create or submit', async () => {
      await post('', MANAGER, draftBody()).expect(403);
      const { id } = await createDraft();
      await post(`/${id}/submit`, MANAGER, { version: 1 }).expect(403);
    });

    it('403 when an officer creates for a society they do not belong to', async () => {
      await post('', OFFICER, draftBody({ societyId: LOTUS })).expect(403);
    });

    it('404 for a manager from another district, on read and on every action', async () => {
      const id = await toSubmitted();
      await getOne(id, OTHER_MANAGER).expect(404);
      await post(`/${id}/start-review`, OTHER_MANAGER, { version: 2 }).expect(404);
      await post(`/${id}/approve`, OTHER_MANAGER, { version: 2 }).expect(404);
    });

    it('hides drafts from reviewers (404 on read and absent from lists)', async () => {
      const { id } = await createDraft();
      await getOne(id, MANAGER).expect(404);
      const list = await http().get('/api/v1/submissions').set('X-Demo-User', MANAGER).expect(200);
      expect(list.body.data).toHaveLength(0);
    });

    it('lets the officer list their own drafts', async () => {
      await createDraft();
      const list = await http().get('/api/v1/submissions').set('X-Demo-User', OFFICER).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.meta).toMatchObject({ page: 1, totalItems: 1 });
    });

    it('failed requests change nothing', async () => {
      const id = await toResubmitted();
      const before = repo.rows[0].events.length;
      await post(`/${id}/approve`, OFFICER, { version: 5 }).expect(403);
      await getOne(id, OTHER_MANAGER).expect(404);
      expect(repo.rows[0].events.length).toBe(before);
      expect(repo.rows[0].status).toBe('RESUBMITTED');
    });
  });

  // ---- conflicts and invalid transitions ----
  describe('invalid transitions and conflicts', () => {
    it('409 for a stale version', async () => {
      const id = await toSubmitted(); // now version 2
      await post(`/${id}/start-review`, MANAGER, { version: 1 }).expect(409);
      expect(repo.rows[0].status).toBe('SUBMITTED');
    });

    it('409 when approving before review has started', async () => {
      const id = await toSubmitted();
      await post(`/${id}/approve`, MANAGER, { version: 2 }).expect(409);
    });

    it('409 when submitting twice', async () => {
      const id = await toSubmitted();
      await post(`/${id}/submit`, OFFICER, { version: 2 }).expect(409);
    });

    it('409 for any action once approved or rejected', async () => {
      const id = await toUnderReview();
      await post(`/${id}/approve`, MANAGER, { version: 3 }).expect(200);
      await post(`/${id}/approve`, MANAGER, { version: 4 }).expect(409);
      await post(`/${id}/reject`, MANAGER, { version: 4, comment: 'x' }).expect(409);
      await post(`/${id}/start-review`, MANAGER, { version: 4 }).expect(409);
    });

    it('409 when an open submission of the same type already exists', async () => {
      await createDraft();
      await post('', OFFICER, draftBody()).expect(409);
    });

    it('allows a new submission of the same type once the previous one is closed', async () => {
      const id = await toUnderReview();
      await post(`/${id}/reject`, MANAGER, { version: 3, comment: 'No' }).expect(200);
      await post('', OFFICER, draftBody()).expect(201);
    });

    it('checks role and state before the stale version (documented order)', async () => {
      const id = await toSubmitted();
      // Wrong role with a stale version -> 403, not 409.
      await post(`/${id}/approve`, OFFICER, { version: 1 }).expect(403);
    });
  });

  // ---- input validation ----
  describe('validation', () => {
    it('400 for a non-UUID id', async () => {
      await getOne('not-a-uuid', OFFICER).expect(400);
      await post('/not-a-uuid/submit', OFFICER, { version: 1 }).expect(400);
    });

    it('400 for a missing or invalid version', async () => {
      const { id } = await createDraft();
      await post(`/${id}/submit`, OFFICER, {}).expect(400);
      await post(`/${id}/submit`, OFFICER, { version: 0 }).expect(400);
      await post(`/${id}/submit`, OFFICER, { version: 'one' }).expect(400);
    });

    it('400 for an invalid create body', async () => {
      await post('', OFFICER, draftBody({ changes: [] })).expect(400);
      await post('', OFFICER, draftBody({ type: 'NOT_A_TYPE' })).expect(400);
      await post('', OFFICER, draftBody({ title: '   ' })).expect(400);
      await post('', OFFICER, draftBody({ societyId: 'nope' })).expect(400);
    });

    it('400 for duplicate fields in a create body', async () => {
      const change = { field: 'a', label: 'A', proposedValue: 1 };
      await post('', OFFICER, draftBody({ changes: [change, change] })).expect(400);
    });

    it('400 when rejecting without a reason', async () => {
      const id = await toUnderReview();
      await post(`/${id}/reject`, MANAGER, { version: 3 }).expect(400);
      await post(`/${id}/reject`, MANAGER, { version: 3, comment: '   ' }).expect(400);
      expect(repo.rows[0].status).toBe('UNDER_REVIEW');
    });

    it('400 when requesting changes with no fields, an empty comment or an unknown field', async () => {
      const id = await toUnderReview();
      await post(`/${id}/request-changes`, MANAGER, { version: 3 }).expect(400);
      await post(`/${id}/request-changes`, MANAGER, { version: 3, fields: [] }).expect(400);
      await post(`/${id}/request-changes`, MANAGER, {
        version: 3,
        fields: [{ field: 'treasurer.fullName', comment: '  ' }],
      }).expect(400);
      await post(`/${id}/request-changes`, MANAGER, {
        version: 3,
        fields: [{ field: 'does.not.exist', comment: 'x' }],
      }).expect(400);
      await post(`/${id}/request-changes`, MANAGER, {
        version: 3,
        fields: [
          { field: 'treasurer.fullName', comment: 'x' },
          { field: 'treasurer.fullName', comment: 'y' },
        ],
      }).expect(400);
      expect(repo.rows[0].status).toBe('UNDER_REVIEW');
    });

    it('400 when resubmitting corrections that do not match the returned fields', async () => {
      const id = await toChangesRequested();
      await post(`/${id}/resubmit`, OFFICER, {
        version: 4,
        corrections: [{ field: 'secretary.fullName', correctedValue: 'X' }],
      }).expect(400);
      await post(`/${id}/resubmit`, OFFICER, {
        version: 4,
        corrections: [
          { field: 'treasurer.fullName', correctedValue: 'X' },
          { field: 'secretary.fullName', correctedValue: 'Y' },
        ],
      }).expect(400);
      await post(`/${id}/resubmit`, OFFICER, {
        version: 4,
        corrections: [{ field: 'treasurer.fullName' }],
      }).expect(400);
      expect(repo.rows[0].status).toBe('CHANGES_REQUESTED');
    });

    it('400 for an invalid status filter or page size', async () => {
      await http().get('/api/v1/submissions?status=BOGUS').set('X-Demo-User', OFFICER).expect(400);
      await http().get('/api/v1/submissions?pageSize=500').set('X-Demo-User', OFFICER).expect(400);
    });
  });

  // ---- allowedActions / editable per role and status ----
  describe('allowedActions and editable', () => {
    it('shows the right actions to each role at each status', async () => {
      const id = await toSubmitted();
      expect((await getOne(id, OFFICER)).body).toMatchObject({ allowedActions: [], editable: false });
      expect((await getOne(id, MANAGER)).body.allowedActions).toEqual(['START_REVIEW']);

      await post(`/${id}/start-review`, MANAGER, { version: 2 }).expect(200);
      const review = await getOne(id, MANAGER);
      expect(review.body.allowedActions).toEqual(
        expect.arrayContaining(['REQUEST_CHANGES', 'APPROVE', 'REJECT']),
      );
      expect((await getOne(id, OFFICER)).body.allowedActions).toEqual([]);
    });
  });
});
