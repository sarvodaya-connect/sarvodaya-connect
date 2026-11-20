import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { EmergenciesService } from './emergencies.service.js';

/**
 * Issue #125: the phone retries photos after a cut-off upload or a lost
 * answer. A retry resumes or confirms the same photo, so it never uses up
 * the 10-photo limit. Everything here is fictional. The PostgreSQL test in
 * test/db/emergencies.db-spec.ts runs the same journey against a database.
 */
const ASSESSMENT = '44444444-4444-4444-8444-444444444444';
const CHECKSUM = 'q1ZbvdrUw0pqtkBvKz7ZbVt7Rr2n0r1JjJ2wQqv0ZKk=';
const PHOTO_ID = '55555555-5555-4555-8555-555555555555';

const officer: Principal = {
  id: 'so-1',
  displayName: 'Fictional Officer',
  roles: ['SOCIETY_OFFICER'],
  districtIds: [],
  societyIds: [],
};

const photo = {
  contentType: 'image/jpeg' as const,
  sizeBytes: 2048,
  checksumSha256: CHECKSUM,
};

type Row = {
  id: string;
  assessmentId: string | null;
  helperId: string | null;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  clientUploadId: string | null;
  uploadedById: string;
  uploadedAt: Date | null;
  createdAt: Date;
};

const row = (extra: Partial<Row> = {}): Row => ({
  id: `evidence-${Math.random().toString(16).slice(2)}`,
  assessmentId: ASSESSMENT,
  helperId: null,
  storageKey: `incidents/i/assessments/${Math.random()}.jpg`,
  contentType: photo.contentType,
  sizeBytes: photo.sizeBytes,
  checksumSha256: CHECKSUM,
  clientUploadId: null,
  uploadedById: officer.id,
  uploadedAt: null,
  createdAt: new Date(),
  ...extra,
});

/** An evidence table with the unique (uploader, clientUploadId) index. */
function service(rows: Row[] = []) {
  const matches = (r: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(
      ([key, value]) => (r as Record<string, unknown>)[key] === value,
    );
  const evidence = {
    findFirst: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => matches(r, where)).at(-1) ?? null,
    ),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          id?: string;
          uploadedById_clientUploadId?: {
            uploadedById: string;
            clientUploadId: string;
          };
        };
      }) => {
        const key = where.uploadedById_clientUploadId;
        return (
          rows.find((r) =>
            key
              ? r.uploadedById === key.uploadedById &&
                r.clientUploadId === key.clientUploadId
              : r.id === where.id,
          ) ?? null
        );
      },
    ),
    count: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => matches(r, where)).length,
    ),
    create: vi.fn(async ({ data }: { data: Partial<Row> }) => {
      if (
        data.clientUploadId &&
        rows.some(
          (r) =>
            r.uploadedById === data.uploadedById &&
            r.clientUploadId === data.clientUploadId,
        )
      ) {
        throw Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
        });
      }
      const created = row({ ...data, uploadedAt: null });
      rows.push(created);
      return created;
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<Row> }) =>
        Object.assign(
          rows.find((r) => r.id === where.id)!,
          data,
        ),
    ),
  };
  const tx = { $queryRaw: vi.fn(async () => []), emergencyEvidence: evidence };
  let locked: Promise<void> = Promise.resolve();
  const prisma = {
    emergencyAssessment: {
      findUnique: vi.fn(async () => ({
        id: ASSESSMENT,
        incidentId: 'incident-1',
        societyId: 'society-1',
        createdById: officer.id,
        incident: { id: 'incident-1' },
        society: { id: 'society-1', districtId: 'district-1' },
        _count: {
          evidence: rows.filter((r) => r.assessmentId === ASSESSMENT).length,
        },
      })),
    },
    emergencyEvidence: evidence,
    // Like the row lock (SELECT … FOR UPDATE): one transaction at a time, so a
    // second one counts the first one's insert.
    $transaction: vi.fn((run: (db: typeof tx) => unknown) => {
      const result = locked.then(() => run(tx));
      locked = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    }),
  };
  const storage = {
    createUploadRequest: vi.fn(async ({ key }: { key: string }) => ({
      method: 'PUT',
      url: `https://storage.invalid/${key}`,
      headers: {},
    })),
    getObjectInfo: vi.fn(async () => ({ sizeBytes: photo.sizeBytes })),
  };
  const svc = new EmergenciesService(
    prisma as never,
    {} as never,
    {} as never,
    storage as never,
    { get: () => undefined } as never,
  );
  const internals = svc as unknown as Record<string, unknown>;
  const assertActive = vi.fn();
  internals.canSee = vi.fn(async () => true);
  internals.assertActive = assertActive;
  return { svc, prisma, storage, rows, assertActive };
}

describe('retrying a photo upload without an id (released clients)', () => {
  it('reuses the unfinished record, even at the photo limit', async () => {
    const pending = row({ id: 'evidence-9', storageKey: 'k/e9.jpg' });
    const others = Array.from({ length: 9 }, () =>
      row({ uploadedAt: new Date(), checksumSha256: null }),
    );
    const { svc, prisma, storage } = service([...others, pending]);
    await expect(
      svc.assessmentEvidence(ASSESSMENT, photo, officer),
    ).resolves.toMatchObject({
      evidence: { id: 'evidence-9', sizeBytes: 2048 },
      upload: { url: 'https://storage.invalid/k/e9.jpg' },
    });
    expect(prisma.emergencyEvidence.findFirst).toHaveBeenCalledWith({
      where: {
        assessmentId: ASSESSMENT,
        helperId: null,
        uploadedById: officer.id,
        uploadedAt: null,
        contentType: 'image/jpeg',
        sizeBytes: 2048,
        checksumSha256: CHECKSUM,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.emergencyEvidence.create).not.toHaveBeenCalled();
    expect(storage.createUploadRequest).toHaveBeenCalledOnce();
  });

  it('still refuses a new photo past the limit', async () => {
    const full = Array.from({ length: 10 }, () =>
      row({ uploadedAt: new Date() }),
    );
    const { svc, prisma } = service(full);
    await expect(
      svc.assessmentEvidence(ASSESSMENT, photo, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.emergencyEvidence.create).not.toHaveBeenCalled();
  });

  it('creates a new record for a new photo under the limit', async () => {
    const { svc, prisma, rows } = service();
    const result = await svc.assessmentEvidence(ASSESSMENT, photo, officer);
    expect(prisma.emergencyEvidence.create).toHaveBeenCalledOnce();
    expect(result.upload).not.toBeNull();
    expect(rows[0]?.clientUploadId).toBeNull();
  });
});

describe('retrying a photo with its clientUploadId', () => {
  const withId = { ...photo, clientUploadId: PHOTO_ID };

  it('confirms a photo already completed, without a new upload link, even at the limit', async () => {
    const done = row({ clientUploadId: PHOTO_ID, uploadedAt: new Date() });
    const others = Array.from({ length: 9 }, () =>
      row({ uploadedAt: new Date() }),
    );
    const { svc, prisma, storage, assertActive } = service([...others, done]);
    await expect(
      svc.assessmentEvidence(ASSESSMENT, withId, officer),
    ).resolves.toEqual({
      evidence: {
        id: done.id,
        contentType: 'image/jpeg',
        sizeBytes: 2048,
        uploaded: true,
      },
      upload: null,
    });
    // Nothing new, and the stored file is never offered for replacement.
    expect(prisma.emergencyEvidence.create).not.toHaveBeenCalled();
    expect(storage.createUploadRequest).not.toHaveBeenCalled();
    // Confirmed before the incident's state is checked, like an assessment replay.
    expect(assertActive).not.toHaveBeenCalled();
  });

  it('resumes the same unfinished record with a new link', async () => {
    const pending = row({ clientUploadId: PHOTO_ID, storageKey: 'k/p.jpg' });
    const { svc, prisma, storage } = service([pending]);
    await expect(
      svc.assessmentEvidence(ASSESSMENT, withId, officer),
    ).resolves.toMatchObject({
      evidence: { id: pending.id, uploaded: false },
      upload: { url: 'https://storage.invalid/k/p.jpg' },
    });
    expect(prisma.emergencyEvidence.create).not.toHaveBeenCalled();
    expect(storage.createUploadRequest).toHaveBeenCalledOnce();
  });

  it('confirms a completed photo whose assessment id differs only in letter case', async () => {
    // The completed-photo check compares the route's id with the stored one.
    const lettered = 'abcdef12-3456-4abc-8def-0123456789ab';
    const done = row({
      assessmentId: lettered,
      clientUploadId: PHOTO_ID,
      uploadedAt: new Date(),
    });
    const { svc, prisma } = service([done]);
    await expect(
      svc.assessmentEvidence(lettered.toUpperCase(), withId, officer),
    ).resolves.toMatchObject({ evidence: { id: done.id }, upload: null });
    expect(prisma.emergencyEvidence.create).not.toHaveBeenCalled();
  });

  it('refuses the same id for a different photo', async () => {
    const done = row({ clientUploadId: PHOTO_ID, uploadedAt: new Date() });
    const { svc } = service([done]);
    await expect(
      svc.assessmentEvidence(
        ASSESSMENT,
        { ...withId, sizeBytes: 4096 },
        officer,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("never finds another person's photo with the same id", async () => {
    const theirs = row({
      clientUploadId: PHOTO_ID,
      uploadedById: 'someone-else',
      uploadedAt: new Date(),
    });
    const { svc, rows } = service([theirs]);
    const result = await svc.assessmentEvidence(ASSESSMENT, withId, officer);
    expect(result.evidence.id).not.toBe(theirs.id);
    expect(result.upload).not.toBeNull();
    expect(rows).toHaveLength(2);
  });

  it('two retries arriving together leave one record', async () => {
    const { svc, rows } = service();
    // Both look up the id before either has recorded it.
    const results = await Promise.all([
      svc.assessmentEvidence(ASSESSMENT, withId, officer),
      svc.assessmentEvidence(ASSESSMENT, withId, officer),
    ]);
    expect(rows).toHaveLength(1);
    expect(results.map((r) => r.evidence.id)).toEqual([
      rows[0]!.id,
      rows[0]!.id,
    ]);
  });

  it('two retries of the tenth photo arriving together leave one record and refuse neither', async () => {
    const others = Array.from({ length: 9 }, () =>
      row({ uploadedAt: new Date() }),
    );
    const { svc, rows } = service(others);
    // Both miss the id lookup; the first takes the last place, and the
    // second then counts 10 under the lock.
    const results = await Promise.all([
      svc.assessmentEvidence(ASSESSMENT, withId, officer),
      svc.assessmentEvidence(ASSESSMENT, withId, officer),
    ]);
    expect(rows).toHaveLength(10);
    const tenth = rows.find((r) => r.clientUploadId === PHOTO_ID)!;
    expect(results.map((r) => r.evidence.id)).toEqual([tenth.id, tenth.id]);
  });

  it('still refuses an eleventh photo with a new id', async () => {
    const full = Array.from({ length: 10 }, () =>
      row({ uploadedAt: new Date() }),
    );
    const { svc, rows } = service(full);
    await expect(
      svc.assessmentEvidence(ASSESSMENT, withId, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(10);
  });

  it('completing a photo twice confirms it, without checking storage again', async () => {
    const done = row({ clientUploadId: PHOTO_ID, uploadedAt: new Date() });
    const { svc, storage } = service([done]);
    await expect(svc.completeEvidence(done.id, officer)).resolves.toEqual({
      id: done.id,
      uploaded: true,
    });
    expect(storage.getObjectInfo).not.toHaveBeenCalled();
  });
});
