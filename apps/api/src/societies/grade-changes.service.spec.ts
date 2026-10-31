import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Principal } from '../auth/principal.js';
import { GradeChangesService } from './grade-changes.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const societyId = '29000000-0000-4000-8000-000000000101';
const requestId = '29000000-0000-4000-8000-000000000901';
const officer: Principal = { id: 'officer', displayName: 'Officer', roles: ['SOCIETY_OFFICER'], districtIds: [], societyIds: [societyId] };
const dm: Principal = { id: 'dm', displayName: 'District Manager', roles: ['DISTRICT_MANAGER'], districtIds: ['district-1'], societyIds: [] };
const hq: Principal = { id: 'hq', displayName: 'HQ Reviewer', roles: ['HQ_ADMIN'], districtIds: [], societyIds: [] };

function serviceForDecision(decision: 'APPROVED' | 'REJECTED') {
  const baseRecord = {
    id: requestId, societyId, currentGrade: 'B', proposedGrade: 'A', rationale: 'Published criteria met.', status: 'PENDING',
    requestedById: officer.id, requestedByName: officer.displayName, requestedAt: new Date('2026-10-20T00:00:00Z'),
    society: { id: societyId, districtId: 'district-1', societyCode: 'DEMO-001', nameEn: 'Example Society', grade: 'B', district: { id: 'district-1', code: 'N', nameEn: 'North' }, memberships: [], _count: { councilMembers: 25 }, auditEvents: [] },
  };
  const tx = {
    gradeChangeRequest: { findUnique: vi.fn().mockResolvedValue(baseRecord), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    society: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    societyAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    notification: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    gradeChangeRequest: { findUnique: vi.fn().mockResolvedValue({ ...baseRecord, status: decision, society: { ...baseRecord.society, auditEvents: [] } }) },
    districtDelegation: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { service: new GradeChangesService(prisma as unknown as PrismaService), tx };
}

describe('GradeChangesService authorization and decisions', () => {
  it('rejects grade requests from District Managers', async () => {
    const prisma = { $transaction: vi.fn(), districtDelegation: { findMany: vi.fn() } };
    const service = new GradeChangesService(prisma as unknown as PrismaService);
    await expect(service.create(societyId, { proposedGrade: 'A', rationale: 'Published criteria met.' }, dm)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('limits Society Officer requests to their assigned societies', async () => {
    const prisma = { districtDelegation: { findMany: vi.fn() }, society: { findUnique: vi.fn() } };
    const service = new GradeChangesService(prisma as unknown as PrismaService);
    await expect(service.create('29000000-0000-4000-8000-000000000102', { proposedGrade: 'A', rationale: 'Published criteria met.' }, officer)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.society.findUnique).not.toHaveBeenCalled();
  });

  it('allows HQ to approve, changes the grade, and records an audit event', async () => {
    const { service, tx } = serviceForDecision('APPROVED');
    await service.decide(requestId, { decision: 'APPROVED', comment: 'Evidence reviewed and accepted.' }, hq);
    expect(tx.society.updateMany).toHaveBeenCalledWith({ where: { id: societyId, grade: 'B' }, data: { grade: 'A' } });
    expect(tx.societyAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'GRADE_CHANGE_APPROVED', fromGrade: 'B', toGrade: 'A', actorId: hq.id }) }));
  });

  it('rejects the request without changing the existing grade and records the decision', async () => {
    const { service, tx } = serviceForDecision('REJECTED');
    await service.decide(requestId, { decision: 'REJECTED', comment: 'Evidence is insufficient.' }, hq);
    expect(tx.society.updateMany).not.toHaveBeenCalled();
    expect(tx.societyAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'GRADE_CHANGE_REJECTED', fromGrade: 'B', toGrade: 'B' }) }));
  });

  it('blocks grade decisions from District Managers before opening a transaction', async () => {
    const { service, tx } = serviceForDecision('APPROVED');
    await expect(service.decide(requestId, { decision: 'APPROVED', comment: 'Evidence reviewed and accepted.' }, dm)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.gradeChangeRequest.findUnique).not.toHaveBeenCalled();
  });
});
