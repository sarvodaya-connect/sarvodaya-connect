import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findDemoPrincipal } from '../auth/demo-principals.js';
import { latestCompletedFinancialYear } from './financial-year.js';
import {
  describeProfileChange,
  normaliseLandline,
  SocietiesService,
} from './societies.service.js';
import type { SocietiesRepository } from './societies.repository.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const SUNRISE_ID = '29000000-0000-4000-8000-000000000101';
const officer = findDemoPrincipal('demo-officer-sunrise')!;
const dm = findDemoPrincipal('demo-dm-north')!;
const hq = findDemoPrincipal('demo-hq-admin')!;

const record = {
  id: SUNRISE_ID,
  societyCode: 'DEMO-SOC-001',
  nameEn: 'Example Sunrise Society',
  nameLocal: null,
  districtId: NORTH,
  district: { id: NORTH, code: 'DEMO-N', nameEn: 'Fictional North District' },
  status: 'ACTIVE',
  establishedOn: null,
  addressLine: '1 Fictional Lane',
  village: null,
  gnDivision: null,
  dsDivision: null,
  latitude: null,
  longitude: null,
  memberCount: 412,
  landline: null,
  businessDescription: null,
  grade: 'B',
  gradeChangedAt: new Date('2025-03-12T05:50:00.000Z'),
  gradeChangedByName: 'Demo HQ Administrator',
  gradeChangedByRole: 'HQ_ADMIN',
  contacts: [],
  councilMembers: [],
  memberships: [],
  gradeRequests: [],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-30T00:00:00.000Z'),
};

describe('SocietiesService V4 society record (SC-65)', () => {
  const repository = {
    findById: vi.fn(),
    findRecordContext: vi.fn(),
    updateProfile: vi.fn(),
  };
  let service: SocietiesService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(record);
    repository.findRecordContext.mockResolvedValue({
      summary: {
        totalProfit: { toNumber: () => 412500 },
        totalExpenses: { toNumber: () => 1286000 },
        previousProfit: { toNumber: () => 398000 },
        previousExpenses: null,
        profitUpdatedAt: new Date('2026-10-22T10:40:00.000Z'),
        profitUpdatedByName: officer.displayName,
        profitUpdatedByRole: 'SOCIETY_OFFICER',
        expensesUpdatedAt: null,
        expensesUpdatedByName: null,
        expensesUpdatedByRole: null,
      },
      auditReport: null,
      staff: [
        {
          displayName: 'R. Fernando',
          role: 'DISTRICT_MANAGER',
          status: 'ACTIVE',
        },
      ],
      lastChange: null,
    });
    service = new SocietiesService(
      repository as unknown as SocietiesRepository,
    );
  });

  it('returns the V4 fields, the yearly summary and what the user may do', async () => {
    const result = await service.getById(SUNRISE_ID, dm);
    expect(repository.findRecordContext).toHaveBeenCalledWith(
      record,
      latestCompletedFinancialYear(),
    );
    expect(result).toMatchObject({
      memberCount: 412,
      grade: 'B',
      gradeChangedBy: {
        displayName: 'Demo HQ Administrator',
        role: 'HQ_ADMIN',
      },
      openGradeRequest: null,
      staff: [
        {
          role: 'DISTRICT_MANAGER',
          displayName: 'R. Fernando',
          accountStatus: 'ACTIVE',
        },
      ],
      annualSummary: {
        totalProfit: 412500,
        totalExpenses: 1286000,
        profitChange: {
          previousValue: 398000,
          updatedBy: { role: 'SOCIETY_OFFICER' },
        },
        auditReport: null,
      },
      permissions: { canEdit: false, viewOnlyReason: 'DISTRICT_MANAGER' },
    });
    expect(result.annualSummary).not.toHaveProperty('expensesChange');
  });

  it('lets only HQ correct the S number or change the grade', async () => {
    await expect(
      service.updateProfile(SUNRISE_ID, { societyCode: 'S-104233' }, officer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateProfile(
        SUNRISE_ID,
        { grade: 'A', gradeReason: 'Strong record this year' },
        officer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('needs a reason for a direct HQ grade change and records it separately', async () => {
    await expect(
      service.updateProfile(SUNRISE_ID, { grade: 'A' }, hq),
    ).rejects.toThrow('Enter a reason for the grade change');

    await service.updateProfile(
      SUNRISE_ID,
      { grade: 'A', gradeReason: 'Strong record this year', memberCount: 418 },
      hq,
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(
      SUNRISE_ID,
      { memberCount: 418 },
      hq,
      {
        summary: 'Members 412 → 418',
        grade: { from: 'B', to: 'A', reason: 'Strong record this year' },
      },
    );
  });

  it('formats a valid landline and rejects others', async () => {
    await service.updateProfile(
      SUNRISE_ID,
      { landline: '0370000123' },
      officer,
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(
      SUNRISE_ID,
      { landline: '037 000 0123' },
      officer,
      { summary: 'Landline added' },
    );
    await expect(
      service.updateProfile(SUNRISE_ID, { landline: '037 22' }, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('treats saving unchanged values as no change', async () => {
    await expect(
      service.updateProfile(SUNRISE_ID, { memberCount: 412 }, officer),
    ).resolves.toMatchObject({ memberCount: 412 });
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('describes profile changes for the history', () => {
    expect(normaliseLandline('+94 37 000 0123')).toBe('+94 37 000 0123');
    expect(normaliseLandline('12345')).toBeNull();
    expect(
      describeProfileChange(
        { ...record, landline: '037 000 0100' },
        {
          landline: '',
          businessDescription: 'A small rice mill',
          memberCount: 418,
        },
      ),
    ).toBe('Members 412 → 418; Landline removed; Business description added');
  });
});
