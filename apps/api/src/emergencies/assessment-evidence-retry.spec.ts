import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { EmergenciesService } from './emergencies.service.js';

/**
 * Issue #125: the phone retries a photo whose upload was cut off. The retry
 * reuses the unfinished record, so it never uses up the 10-photo limit.
 * Everything here is fictional.
 */
const ASSESSMENT = '44444444-4444-4444-8444-444444444444';
const CHECKSUM = 'q1ZbvdrUw0pqtkBvKz7ZbVt7Rr2n0r1JjJ2wQqv0ZKk=';

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

function service({
  evidenceCount,
  pending,
}: {
  evidenceCount: number;
  pending: unknown;
}) {
  const prisma = {
    emergencyAssessment: {
      findUnique: vi.fn(async () => ({
        id: ASSESSMENT,
        incidentId: 'incident-1',
        societyId: 'society-1',
        createdById: officer.id,
        incident: { id: 'incident-1' },
        society: { id: 'society-1', districtId: 'district-1' },
        _count: { evidence: evidenceCount },
      })),
    },
    emergencyEvidence: {
      findFirst: vi.fn(async () => pending),
      create: vi.fn(async () => ({})),
    },
  };
  const storage = {
    createUploadRequest: vi.fn(async ({ key }: { key: string }) => ({
      method: 'PUT',
      url: `https://storage.invalid/${key}`,
      headers: {},
    })),
  };
  const svc = new EmergenciesService(
    prisma as never,
    {} as never,
    {} as never,
    storage as never,
    { get: () => undefined } as never,
  );
  const internals = svc as unknown as Record<string, unknown>;
  internals.canSee = vi.fn(async () => true);
  internals.assertActive = vi.fn();
  return { svc, prisma, storage };
}

describe('retrying a photo upload (issue #125)', () => {
  it('reuses the unfinished record, even at the photo limit', async () => {
    const { svc, prisma, storage } = service({
      evidenceCount: 10,
      pending: {
        id: 'evidence-9',
        storageKey: 'incidents/i/assessments/e9.jpg',
      },
    });
    await expect(
      svc.assessmentEvidence(ASSESSMENT, photo, officer),
    ).resolves.toMatchObject({
      evidence: { id: 'evidence-9', sizeBytes: 2048 },
      upload: { url: 'https://storage.invalid/incidents/i/assessments/e9.jpg' },
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
    const { svc, prisma } = service({ evidenceCount: 10, pending: null });
    await expect(
      svc.assessmentEvidence(ASSESSMENT, photo, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.emergencyEvidence.create).not.toHaveBeenCalled();
  });

  it('creates a new record for a new photo under the limit', async () => {
    const { svc, prisma } = service({ evidenceCount: 3, pending: null });
    const result = await svc.assessmentEvidence(ASSESSMENT, photo, officer);
    expect(prisma.emergencyEvidence.create).toHaveBeenCalledOnce();
    expect(result.evidence.id).not.toBe('evidence-9');
  });
});
