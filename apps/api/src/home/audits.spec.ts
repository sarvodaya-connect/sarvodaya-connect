import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { Principal } from '../auth/principal.js';
import type { RegistrarDocumentsRepository } from '../documents/registrar-documents.repository.js';
import type { DistrictAccessService } from '../identity/district-access.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HomeService } from './home.service.js';

const D1 = '11111111-1111-4111-8111-111111111111';
const S1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const now = new Date('2026-11-09T06:00:00Z');

function setup() {
  const registrar = {
    scopedTotals: vi.fn(async () => ({
      activeSocieties: 4,
      byType: new Map([
        ['AUDIT_REPORT', 3],
        ['MEMBERS_LIST', 1],
      ]),
      allFour: 1,
    })),
    missing: vi.fn(async () => ({
      societies: [
        {
          id: S1,
          nameEn: 'Fictional North One',
          societyCode: 'S-91001',
          district: { nameEn: 'Fictional North' },
        },
      ],
      totalItems: 1,
    })),
  };
  const service = new HomeService(
    {} as PrismaService,
    {} as DistrictAccessService,
    registrar as unknown as RegistrarDocumentsRepository,
  );
  return { service, registrar };
}

const principal = (
  role: Principal['roles'][number],
  extra: Partial<Principal> = {},
): Principal => ({
  id: 'p',
  displayName: 'Fictional',
  roles: [role],
  districtIds: [D1],
  societyIds: [S1],
  ...extra,
});

describe('scoped Audits & AGM (issue #119)', () => {
  it('passes only the DM district to every query and keeps HQ rules', async () => {
    const { service, registrar } = setup();
    const result = await service.audits(
      principal('DISTRICT_MANAGER'),
      { year: 2025, page: 1, pageSize: 20 },
      now,
    );
    expect(registrar.scopedTotals).toHaveBeenCalledWith(2025, {
      districtId: { in: [D1] },
    });
    expect(registrar.missing).toHaveBeenCalledWith(
      'AUDIT_REPORT',
      2025,
      1,
      20,
      { districtId: { in: [D1] } },
    );
    expect(result.byType).toEqual([
      { documentType: 'AUDIT_REPORT', submitted: 3, missing: 1 },
      { documentType: 'AGM_MINUTES', submitted: 0, missing: 4 },
      { documentType: 'OFFICE_BEARER_LIST', submitted: 0, missing: 4 },
      { documentType: 'MEMBERS_LIST', submitted: 1, missing: 3 },
    ]);
    expect(result).toMatchObject({
      activeSocieties: 4,
      allFour: 1,
      auditReportDueOn: '2026-09-30',
      financialYear: { startYear: 2025 },
    });
    expect(result.followUp).toMatchObject({
      pastDue: true,
      meta: { totalItems: 1, totalPages: 1 },
    });
  });

  it('is not past due before the end of 30 September in Sri Lanka', async () => {
    const { service } = setup();
    const result = await service.audits(
      principal('DISTRICT_MANAGER'),
      { year: 2025, page: 1, pageSize: 20 },
      new Date('2026-09-30T18:00:00Z'),
    );
    expect(result.followUp.pastDue).toBe(false);
  });

  it('gives the SPC only assigned societies and refuses the district', async () => {
    const { service, registrar } = setup();
    await service.audits(
      principal('PROGRAMME_COORDINATOR'),
      { year: 2025, page: 2, pageSize: 20 },
      now,
    );
    expect(registrar.missing).toHaveBeenCalledWith(
      'AUDIT_REPORT',
      2025,
      2,
      20,
      { id: { in: [S1] } },
    );
    await expect(
      service.audits(
        principal('PROGRAMME_COORDINATOR'),
        { scope: 'DISTRICT', page: 1, pageSize: 20 },
        now,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('gives a DDM the district only while a grant is valid', async () => {
    const { service, registrar } = setup();
    const valid = principal('DEPUTY_DISTRICT_MANAGER', {
      delegatedDistrictAccess: [
        {
          districtId: D1,
          startsAt: '2026-11-08T00:00:00Z',
          expiresAt: '2026-11-12T00:00:00Z',
        },
      ],
    });
    const result = await service.audits(
      valid,
      { scope: 'DISTRICT', year: 2025, page: 1, pageSize: 20 },
      now,
    );
    expect(registrar.scopedTotals).toHaveBeenCalledWith(2025, {
      districtId: { in: [D1] },
    });
    expect(result.districtView).toEqual({
      available: true,
      expiresAt: '2026-11-12T00:00:00Z',
    });
    const expired = principal('DEPUTY_DISTRICT_MANAGER', {
      delegatedDistrictAccess: [
        {
          districtId: D1,
          startsAt: '2026-11-01T00:00:00Z',
          expiresAt: '2026-11-09T05:00:00Z',
        },
      ],
    });
    await expect(
      service.audits(
        expired,
        { scope: 'DISTRICT', page: 1, pageSize: 20 },
        now,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const mine = await service.audits(expired, { page: 1, pageSize: 20 }, now);
    expect(mine.districtView).toEqual({ available: false, expiresAt: null });
  });

  it('refuses HQ, which keeps the national view, and years outside the selector', async () => {
    const { service } = setup();
    await expect(
      service.audits(principal('HQ_ADMIN'), { page: 1, pageSize: 20 }, now),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.audits(
        principal('DISTRICT_MANAGER'),
        { year: 2015, page: 1, pageSize: 20 },
        now,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
