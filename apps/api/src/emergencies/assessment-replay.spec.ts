import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import { EmergenciesService } from './emergencies.service.js';

/**
 * Issue #125: the phone retries saved assessments with the same
 * clientMutationId. These check the endpoint records one assessment and
 * confirms a retry, even after the incident closed or access ended.
 */
const INCIDENT = '11111111-1111-4111-8111-111111111111';
const SOCIETY = '22222222-2222-4222-8222-222222222222';
const MUTATION = '33333333-3333-4333-8333-333333333333';

const ddm: Principal = {
  id: 'ddm-1',
  displayName: 'Fictional DDM',
  roles: ['DEPUTY_DISTRICT_MANAGER'],
  districtIds: [],
  // Temporary district access has ended: nothing on the principal any more.
  societyIds: [],
};

const input = {
  clientMutationId: MUTATION,
  societyId: SOCIETY,
  impact: 'CRITICAL' as const,
  families: 1,
  people: 3,
  housesFully: 0,
  housesPartly: 0,
  injured: 0,
  displaced: 0,
  roadAccess: 'OPEN' as const,
  needs: [],
  note: '',
  confirmedWithPresident: false,
};

function service(replay: unknown, incident: unknown = null) {
  const prisma = {
    emergencyAssessment: {
      findUnique: vi.fn(async () => replay),
      create: vi.fn(),
    },
    emergencyIncident: { findUnique: vi.fn(async () => incident) },
    society: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
    },
    $transaction: vi.fn(),
  };
  const svc = new EmergenciesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { svc, prisma };
}

describe('sending the same assessment again (issue #125)', () => {
  it('confirms an assessment already received without recording it again', async () => {
    const { svc, prisma } = service({
      id: 'a1',
      incidentId: INCIDENT,
      societyId: SOCIETY,
      createdAt: new Date('2026-11-10T03:00:00Z'),
    });
    await expect(svc.sendAssessment(INCIDENT, input, ddm)).resolves.toEqual({
      id: 'a1',
      sentAt: '2026-11-10T03:00:00.000Z',
      replayed: true,
    });
    expect(prisma.emergencyAssessment.findUnique).toHaveBeenCalledWith({
      where: {
        createdById_clientMutationId: {
          createdById: 'ddm-1',
          clientMutationId: MUTATION,
        },
      },
    });
    // Neither the incident's state nor the user's current access is consulted for a replay.
    expect(prisma.emergencyIncident.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses the same id for another incident or society', async () => {
    const { svc } = service({
      id: 'a1',
      incidentId: 'another',
      societyId: SOCIETY,
      createdAt: new Date(),
    });
    await expect(
      svc.sendAssessment(INCIDENT, input, ddm),
    ).rejects.toBeInstanceOf(ConflictException);
    const other = service({
      id: 'a1',
      incidentId: INCIDENT,
      societyId: 'another',
      createdAt: new Date(),
    });
    await expect(
      other.svc.sendAssessment(INCIDENT, input, ddm),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('still checks access and the incident for a new assessment', async () => {
    const { svc, prisma } = service(null, null);
    await expect(
      svc.sendAssessment(INCIDENT, input, ddm),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
