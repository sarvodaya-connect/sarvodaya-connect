import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findDemoPrincipal } from '../auth/demo-principals.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import { latestCompletedFinancialYear } from './financial-year.js';
import {
  describeAnnualSummaryChange,
  SocietyRecordService,
} from './society-record.service.js';
import type { SocietyRecordRepository } from './society-record.repository.js';

const NORTH = '29000000-0000-4000-8000-000000000001';
const SUNRISE = {
  id: '29000000-0000-4000-8000-000000000101',
  nameEn: 'Example Sunrise Society',
  societyCode: 'DEMO-SOC-001',
  districtId: NORTH,
  grade: 'B' as const,
};
const LOTUS_ID = '29000000-0000-4000-8000-000000000103';
const REQUEST_ID = '29000000-0000-4000-8000-000000000611';

const officer = findDemoPrincipal('demo-officer-sunrise')!;
const spc = findDemoPrincipal('demo-programme-coordinator')!;
const ddm = findDemoPrincipal('demo-deputy-district-manager')!;
const dm = findDemoPrincipal('demo-dm-north')!;
const hq = findDemoPrincipal('demo-hq-admin')!;
const YEAR = latestCompletedFinancialYear();

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    societyId: SUNRISE.id,
    fromGrade: 'B',
    toGrade: 'A',
    reason: 'The Exco was re-formed and every planned activity took place.',
    status: 'PENDING',
    requestedById: spc.id,
    requestedByName: spc.displayName,
    requestedByRole: 'PROGRAMME_COORDINATOR',
    requestedAt: new Date('2026-10-24T10:10:00.000Z'),
    decidedById: null,
    decidedByName: null,
    decidedAt: null,
    decisionComment: null,
    ...overrides,
  };
}

describe('SocietyRecordService', () => {
  const repository = {
    findSociety: vi.fn(),
    findAnnualSummary: vi.fn(),
    saveAnnualSummary: vi.fn(),
    listGradeRequests: vi.fn(),
    findGradeRequest: vi.fn(),
    createGradeRequest: vi.fn(),
    decideGradeRequest: vi.fn(),
    listHistory: vi.fn(),
    accountNames: vi.fn(),
    latestWorkPlanYear: vi.fn(),
    listWorkPlan: vi.fn(),
    lastWorkPlanChange: vi.fn(),
    hqRecipientIds: vi.fn(),
  };
  const notifications = { notifyUsers: vi.fn() };
  const config = { get: vi.fn().mockReturnValue('test') };
  let service: SocietyRecordService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findSociety.mockImplementation((id: string) =>
      Promise.resolve(
        id === SUNRISE.id
          ? SUNRISE
          : id === LOTUS_ID
            ? { ...SUNRISE, id: LOTUS_ID, districtId: 'central' }
            : null,
      ),
    );
    repository.findAnnualSummary.mockResolvedValue({
      summary: null,
      auditReport: null,
    });
    repository.listGradeRequests.mockResolvedValue([]);
    repository.hqRecipientIds.mockResolvedValue(['demo-hq-admin']);
    service = new SocietyRecordService(
      repository as unknown as SocietyRecordRepository,
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService,
    );
  });

  describe('annual financial summary (M06f)', () => {
    it('shows "not added" totals for a society without figures', async () => {
      const result = await service.getAnnualSummary(SUNRISE.id, undefined, dm);
      expect(result.summary).toMatchObject({
        financialYear: { startYear: YEAR },
        totalProfit: null,
        totalExpenses: null,
        auditReport: null,
      });
      expect(result.financialYears).toHaveLength(5);
    });

    it('hides societies outside the user scope', async () => {
      await expect(
        service.getAnnualSummary(LOTUS_ID, undefined, officer),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('saves both totals for the Society Officer with old and new values in the history', async () => {
      repository.findAnnualSummary.mockResolvedValueOnce({
        summary: { totalProfit: 398000, totalExpenses: null },
        auditReport: null,
      });
      await service.updateAnnualSummary(
        SUNRISE.id,
        YEAR,
        { totalProfit: 412500, totalExpenses: 1286000 },
        officer,
      );
      expect(repository.saveAnnualSummary).toHaveBeenCalledWith(
        SUNRISE,
        YEAR,
        expect.objectContaining({
          profitChanged: true,
          expensesChanged: true,
          previousProfit: 398000,
          previousExpenses: null,
          summary: expect.stringContaining('profit LKR 398,000 → 412,500'),
        }),
        officer,
      );
    });

    it.each([
      ['District Manager', dm],
      ['DDM (to confirm)', ddm],
      ['HQ (to confirm)', hq],
    ])('does not let the %s change the figures', async (_label, principal) => {
      await expect(
        service.updateAnnualSummary(
          SUNRISE.id,
          YEAR,
          { totalProfit: 1, totalExpenses: 1 },
          principal,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.saveAnnualSummary).not.toHaveBeenCalled();
    });

    it('rejects years that have not ended or are too old, and does not record unchanged figures', async () => {
      for (const year of [YEAR + 1, YEAR - 5]) {
        await expect(
          service.updateAnnualSummary(
            SUNRISE.id,
            year,
            { totalProfit: 1, totalExpenses: 1 },
            spc,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      repository.findAnnualSummary.mockResolvedValueOnce({
        summary: { totalProfit: 5, totalExpenses: 6 },
        auditReport: null,
      });
      await service.updateAnnualSummary(
        SUNRISE.id,
        YEAR,
        { totalProfit: 5, totalExpenses: 6 },
        spc,
      );
      expect(repository.saveAnnualSummary).not.toHaveBeenCalled();
    });

    it('describes changes in plain words', () => {
      expect(
        describeAnnualSummaryChange(
          'FY 2025/26',
          { profit: null, expenses: 1000 },
          { profit: 412500, expenses: 1000 },
        ),
      ).toBe('FY 2025/26 profit entered: LKR 412,500');
    });
  });

  describe('grade-change requests (M06g, M06q)', () => {
    const input = {
      toGrade: 'A' as const,
      reason: 'The Exco was re-formed and every planned activity took place.',
    };

    it('records the request, keeps the grade and tells HQ', async () => {
      repository.createGradeRequest.mockResolvedValue(pendingRequest());
      const result = await service.requestGradeChange(SUNRISE.id, input, spc);
      expect(repository.createGradeRequest).toHaveBeenCalledWith(
        SUNRISE,
        input,
        spc,
      );
      expect(result).toMatchObject({
        fromGrade: 'B',
        toGrade: 'A',
        status: 'PENDING',
        requestedBy: { role: 'PROGRAMME_COORDINATOR' },
      });
      expect(notifications.notifyUsers).toHaveBeenCalledWith(
        ['demo-hq-admin'],
        expect.objectContaining({ category: 'REQUEST' }),
      );
    });

    it.each([
      ['District Manager', dm],
      ['HQ, who changes grades directly', hq],
    ])('refuses requests from the %s', async (_label, principal) => {
      await expect(
        service.requestGradeChange(SUNRISE.id, input, principal),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.createGradeRequest).not.toHaveBeenCalled();
    });

    it('refuses a request for the current grade or while another one waits', async () => {
      await expect(
        service.requestGradeChange(
          SUNRISE.id,
          { ...input, toGrade: 'B' },
          officer,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      repository.listGradeRequests.mockResolvedValueOnce([pendingRequest()]);
      await expect(
        service.requestGradeChange(SUNRISE.id, input, officer),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('keeps the request when notifications fail', async () => {
      repository.createGradeRequest.mockResolvedValue(pendingRequest());
      notifications.notifyUsers.mockRejectedValueOnce(new Error('down'));
      await expect(
        service.requestGradeChange(SUNRISE.id, input, ddm),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });
  });

  describe('HQ grade decisions', () => {
    beforeEach(() => {
      repository.findGradeRequest.mockResolvedValue(pendingRequest());
    });

    it('lets only HQ decide', async () => {
      for (const principal of [officer, spc, ddm, dm]) {
        await expect(
          service.decideGradeRequest(
            SUNRISE.id,
            REQUEST_ID,
            { decision: 'APPROVE' },
            principal,
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
      expect(repository.decideGradeRequest).not.toHaveBeenCalled();
    });

    it('needs a comment to reject and tells the requester the outcome', async () => {
      await expect(
        service.decideGradeRequest(
          SUNRISE.id,
          REQUEST_ID,
          { decision: 'REJECT' },
          hq,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      repository.decideGradeRequest.mockResolvedValue(
        pendingRequest({
          status: 'APPROVED',
          decidedByName: hq.displayName,
          decidedAt: new Date('2026-10-26T05:00:00.000Z'),
        }),
      );
      const result = await service.decideGradeRequest(
        SUNRISE.id,
        REQUEST_ID,
        { decision: 'APPROVE', comment: 'Strong record this year.' },
        hq,
      );
      expect(repository.decideGradeRequest).toHaveBeenCalledWith(
        SUNRISE,
        expect.objectContaining({ id: REQUEST_ID }),
        { approve: true, comment: 'Strong record this year.' },
        hq,
      );
      expect(result).toMatchObject({
        status: 'APPROVED',
        decidedBy: { displayName: hq.displayName, role: 'HQ_ADMIN' },
      });
      expect(notifications.notifyUsers).toHaveBeenCalledWith(
        [spc.id],
        expect.objectContaining({ category: 'APPROVAL' }),
      );
    });

    it('refuses requests from another society or already decided', async () => {
      repository.findGradeRequest.mockResolvedValueOnce(
        pendingRequest({ societyId: LOTUS_ID }),
      );
      await expect(
        service.decideGradeRequest(
          SUNRISE.id,
          REQUEST_ID,
          { decision: 'APPROVE' },
          hq,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      repository.findGradeRequest.mockResolvedValueOnce(
        pendingRequest({ status: 'REJECTED' }),
      );
      await expect(
        service.decideGradeRequest(
          SUNRISE.id,
          REQUEST_ID,
          { decision: 'APPROVE' },
          hq,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('change history (M06h)', () => {
    it('filters by tab and names who made each change', async () => {
      repository.listHistory.mockResolvedValue([
        {
          id: 'event-1',
          action: 'ANNUAL_SUMMARY_UPDATED',
          detail: 'FY 2025/26 profit LKR 398,000 → 412,500',
          actorId: officer.id,
          actorName: officer.displayName,
          actorRole: 'SOCIETY_OFFICER',
          createdAt: new Date('2026-10-22T10:40:00.000Z'),
        },
        {
          id: 'event-2',
          action: 'SOCIETY_COUNCIL_UPDATED',
          detail:
            'Council updated; NIC retained only for unchanged member identities',
          actorId: 'demo-programme-coordinator',
          actorName: null,
          actorRole: null,
          createdAt: new Date('2026-10-20T10:40:00.000Z'),
        },
      ]);
      repository.accountNames.mockResolvedValue(
        new Map([
          [
            spc.id,
            { displayName: spc.displayName, role: 'PROGRAMME_COORDINATOR' },
          ],
        ]),
      );

      const result = await service.history(SUNRISE.id, undefined, dm);
      expect(result.data).toEqual([
        expect.objectContaining({
          category: 'ANNUAL_SUMMARY',
          summary: 'FY 2025/26 profit LKR 398,000 → 412,500',
          actor: { displayName: officer.displayName, role: 'SOCIETY_OFFICER' },
        }),
        expect.objectContaining({
          category: 'EXCO',
          summary: 'Exco members updated',
          actor: {
            displayName: spc.displayName,
            role: 'PROGRAMME_COORDINATOR',
          },
        }),
      ]);

      await service.history(SUNRISE.id, 'GRADE', dm);
      const actions = repository.listHistory.mock.calls[1]![1] as string[];
      expect(actions).toContain('GRADE_CHANGE_REQUESTED');
      expect(actions).not.toContain('ANNUAL_SUMMARY_UPDATED');
      // NIC reveals are access events, not changes to the record.
      expect(actions).not.toContain('MEMBER_NIC_REVEALED');
    });
  });

  describe('work plan overview (D05w)', () => {
    it('totals the planning allocations for the latest planned year', async () => {
      repository.latestWorkPlanYear.mockResolvedValue(2027);
      repository.lastWorkPlanChange.mockResolvedValue(null);
      repository.listWorkPlan.mockResolvedValue([
        {
          id: 'a1',
          year: 2027,
          month: 1,
          name: 'Tank cleaning shramadana',
          description: 'Clear the village tank.',
          sector: '10 · Environment',
          datesLabel: null,
          allocatedCost: 25000,
          updatedAt: new Date('2026-10-18T04:00:00.000Z'),
          updatedByName: spc.displayName,
          updatedByRole: 'PROGRAMME_COORDINATOR',
        },
        {
          id: 'a2',
          year: 2027,
          month: 9,
          name: 'Youth leadership camp',
          description: 'Three-day camp.',
          sector: null,
          datesLabel: '12–14 Sep',
          allocatedCost: 55000.5,
          updatedAt: new Date('2026-10-17T04:00:00.000Z'),
          updatedByName: spc.displayName,
          updatedByRole: 'PROGRAMME_COORDINATOR',
        },
      ]);
      const result = await service.workPlan(SUNRISE.id, undefined, hq);
      expect(result).toMatchObject({
        year: 2027,
        totalAllocated: 80000.5,
        lastChange: { by: { role: 'PROGRAMME_COORDINATOR' } },
      });
      expect(result.activities[1]).toEqual(
        expect.objectContaining({ datesLabel: '12–14 Sep' }),
      );
      expect(result.activities[1]).not.toHaveProperty('sector');
    });
  });
});
