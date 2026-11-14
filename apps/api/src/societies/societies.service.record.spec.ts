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
  femaleMembers: null as number | null,
  maleMembers: null as number | null,
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
        membershipChanged: true,
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
      { summary: 'Landline added', membershipChanged: false },
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

describe('female and male members on the profile (issue #141)', () => {
  const repository = {
    findById: vi.fn(),
    findRecordContext: vi.fn(),
    updateProfile: vi.fn(),
  };
  const lotus = findDemoPrincipal('demo-officer-lotus')!;
  let service: SocietiesService;
  const withSplit = {
    ...record,
    memberCount: 42,
    femaleMembers: 25,
    maleMembers: 17,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(record);
    repository.findRecordContext.mockResolvedValue({
      staff: [],
      summary: null,
      auditReport: null,
      lastChange: null,
    });
    service = new SocietiesService(
      repository as unknown as SocietiesRepository,
    );
  });

  it('works out the total from female and male and saves all three', async () => {
    await service.updateProfile(
      SUNRISE_ID,
      { femaleMembers: 25, maleMembers: 17 },
      officer,
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(
      SUNRISE_ID,
      { femaleMembers: 25, maleMembers: 17, memberCount: 42 },
      officer,
      {
        summary:
          'Members 412 → 42; Female members entered: 25; Male members entered: 17',
        membershipChanged: true,
      },
    );
  });

  it('rejects a total that contradicts female and male', async () => {
    await expect(
      service.updateProfile(
        SUNRISE_ID,
        { femaleMembers: 25, maleMembers: 17, memberCount: 50 },
        officer,
      ),
    ).rejects.toThrow(
      'The total members must be the female plus the male members',
    );
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('needs female and male together, and at most 1,000,000 in all', async () => {
    await expect(
      service.updateProfile(SUNRISE_ID, { femaleMembers: 25 }, officer),
    ).rejects.toThrow('Enter both the female and the male members');
    await expect(
      service.updateProfile(
        SUNRISE_ID,
        { femaleMembers: 600_000, maleMembers: 500_000 },
        officer,
      ),
    ).rejects.toThrow('cannot be more than 1,000,000');
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('records a change to female as a change to the total', async () => {
    repository.findById.mockResolvedValue(withSplit);
    await service.updateProfile(
      SUNRISE_ID,
      { femaleMembers: 30, maleMembers: 17 },
      officer,
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(
      SUNRISE_ID,
      { femaleMembers: 30, maleMembers: 17, memberCount: 47 },
      officer,
      {
        summary: 'Members 42 → 47; Female members 25 → 30',
        membershipChanged: true,
      },
    );
  });

  it('does not save again when the same split is retried', async () => {
    repository.findById.mockResolvedValue(withSplit);
    await service.updateProfile(
      SUNRISE_ID,
      { femaleMembers: 25, maleMembers: 17 },
      officer,
    );
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('accepts an old app total only while it does not contradict the split', async () => {
    // No split yet: an app from before #141 may still change the total.
    await service.updateProfile(SUNRISE_ID, { memberCount: 420 }, officer);
    expect(repository.updateProfile).toHaveBeenCalledWith(
      SUNRISE_ID,
      { memberCount: 420 },
      officer,
      { summary: 'Members 412 → 420', membershipChanged: true },
    );
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(withSplit);
    // Re-sending the same total (an old form saved unchanged) is fine.
    await service.updateProfile(SUNRISE_ID, { memberCount: 42 }, officer);
    expect(repository.updateProfile).not.toHaveBeenCalled();
    await expect(
      service.updateProfile(SUNRISE_ID, { memberCount: 60 }, officer),
    ).rejects.toThrow('Update those instead');
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('lets no one outside the society change the figures', async () => {
    for (const outsider of [lotus, dm]) {
      await expect(
        service.updateProfile(
          SUNRISE_ID,
          { femaleMembers: 25, maleMembers: 17 },
          outsider,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('returns the split, or null when it has not been entered', async () => {
    await expect(service.getById(SUNRISE_ID, officer)).resolves.toMatchObject({
      memberCount: 412,
      femaleMembers: null,
      maleMembers: null,
    });
    repository.findById.mockResolvedValue(withSplit);
    await expect(service.getById(SUNRISE_ID, officer)).resolves.toMatchObject({
      memberCount: 42,
      femaleMembers: 25,
      maleMembers: 17,
    });
  });
});

describe('members under 18 and the membership Last updated (issue #143)', () => {
  const repository = {
    findById: vi.fn(),
    findRecordContext: vi.fn(),
    updateProfile: vi.fn(),
  };
  const lotus = findDemoPrincipal('demo-officer-lotus')!;
  let service: SocietiesService;
  const withSplit = {
    ...record,
    memberCount: 42,
    femaleMembers: 25,
    maleMembers: 17,
    under18Members: 10 as number | null,
    membershipUpdatedAt: new Date('2026-11-01T08:30:00.000Z') as Date | null,
  };
  const saved = () => repository.updateProfile.mock.calls[0];

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(record);
    repository.findRecordContext.mockResolvedValue({
      staff: [],
      summary: null,
      auditReport: null,
      lastChange: null,
    });
    service = new SocietiesService(
      repository as unknown as SocietiesRepository,
    );
  });

  it('counts under 18s inside the total: 25 + 17 with 10 under 18 is 42', async () => {
    await service.updateProfile(
      SUNRISE_ID,
      { femaleMembers: 25, maleMembers: 17, under18Members: 10 },
      officer,
    );
    expect(saved()).toEqual([
      SUNRISE_ID,
      {
        femaleMembers: 25,
        maleMembers: 17,
        under18Members: 10,
        memberCount: 42,
      },
      officer,
      {
        summary:
          'Members 412 → 42; Female members entered: 25; Male members entered: 17; Under 18s entered: 10',
        membershipChanged: true,
      },
    ]);
  });

  it('refuses more under 18s than the total, and allows exactly the total or 0', async () => {
    await expect(
      service.updateProfile(
        SUNRISE_ID,
        { femaleMembers: 25, maleMembers: 17, under18Members: 43 },
        officer,
      ),
    ).rejects.toThrow('cannot be more than the female plus the male members');
    expect(repository.updateProfile).not.toHaveBeenCalled();
    for (const under18Members of [42, 0]) {
      vi.clearAllMocks();
      repository.findById.mockResolvedValue(record);
      await service.updateProfile(
        SUNRISE_ID,
        { femaleMembers: 25, maleMembers: 17, under18Members },
        officer,
      );
      expect(saved()[1]).toMatchObject({ under18Members, memberCount: 42 });
    }
  });

  it('needs the female and male split before under 18s', async () => {
    // An older total-only record: under 18s alone would have no total to sit in.
    await expect(
      service.updateProfile(SUNRISE_ID, { under18Members: 5 }, officer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateProfile).not.toHaveBeenCalled();
    // With a saved split, under 18s may be changed on their own.
    repository.findById.mockResolvedValue(withSplit);
    await service.updateProfile(SUNRISE_ID, { under18Members: 12 }, officer);
    expect(saved()[1]).toEqual({ under18Members: 12 });
    expect(saved()[3]).toEqual({
      summary: 'Under 18s 10 → 12',
      membershipChanged: true,
    });
  });

  it('does not let a smaller split leave the saved under 18s above the total', async () => {
    repository.findById.mockResolvedValue(withSplit);
    await expect(
      service.updateProfile(
        SUNRISE_ID,
        { femaleMembers: 5, maleMembers: 4 },
        officer,
      ),
    ).rejects.toThrow('records 10 members under 18');
    expect(repository.updateProfile).not.toHaveBeenCalled();
    // Lowering both together is fine.
    await service.updateProfile(
      SUNRISE_ID,
      { femaleMembers: 5, maleMembers: 4, under18Members: 3 },
      officer,
    );
    expect(saved()[1]).toMatchObject({ memberCount: 9, under18Members: 3 });
  });

  it('moves the membership Last updated only when a figure changes', async () => {
    repository.findById.mockResolvedValue(withSplit);
    // Another profile field: saved, but not a membership change.
    await service.updateProfile(
      SUNRISE_ID,
      { businessDescription: 'Fictional coir rope' },
      officer,
    );
    expect(saved()[3]).toEqual({
      summary: 'Business description added',
      membershipChanged: false,
    });
    // The same figures again (a retry): nothing is saved at all.
    vi.clearAllMocks();
    repository.findById.mockResolvedValue(withSplit);
    await service.updateProfile(
      SUNRISE_ID,
      { femaleMembers: 25, maleMembers: 17, under18Members: 10 },
      officer,
    );
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('lets no one outside the society change under 18s', async () => {
    repository.findById.mockResolvedValue(withSplit);
    for (const outsider of [lotus, dm]) {
      await expect(
        service.updateProfile(SUNRISE_ID, { under18Members: 1 }, outsider),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('returns under 18s and the membership time, or null when not entered', async () => {
    await expect(service.getById(SUNRISE_ID, officer)).resolves.toMatchObject({
      under18Members: null,
      membershipUpdatedAt: null,
    });
    repository.findById.mockResolvedValue(withSplit);
    await expect(service.getById(SUNRISE_ID, officer)).resolves.toMatchObject({
      memberCount: 42,
      under18Members: 10,
      membershipUpdatedAt: '2026-11-01T08:30:00.000Z',
    });
  });
});
