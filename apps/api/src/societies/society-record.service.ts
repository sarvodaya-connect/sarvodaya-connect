import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Principal } from '../auth/principal.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type {
  AnnualSummaryUpdateDto,
  GradeChangeRequestDto,
  GradeDecisionDto,
  HistoryCategoryValue,
} from './dto/society-record.dto.js';
import {
  financialYear,
  isSelectableFinancialYear,
  latestCompletedFinancialYear,
  selectableFinancialYears,
} from './financial-year.js';
import { canViewSociety } from './society-access.policy.js';
import {
  actorReference,
  toAmount,
  toAnnualSummary,
  toGradeRequest,
} from './society-record.mappers.js';
import {
  assertCanDecideGrade,
  assertCanEditAnnualSummary,
  assertCanRequestGradeChange,
} from './society-record.policy.js';
import { SocietyRecordRepository } from './society-record.repository.js';
import { SOCIETY_CHANGE_ACTIONS } from './societies.repository.js';

/** Which history tab (M06h) each recorded action belongs to. */
const HISTORY_CATEGORY: Record<
  (typeof SOCIETY_CHANGE_ACTIONS)[number],
  HistoryCategoryValue
> = {
  SOCIETY_PROFILE_UPDATED: 'SOCIETY',
  SOCIETY_MEMBERSHIP_UPDATED: 'SOCIETY',
  SOCIETY_COUNCIL_UPDATED: 'EXCO',
  MEMBER_NIC_UPDATED: 'EXCO',
  SOCIETY_GRADE_CHANGED: 'GRADE',
  GRADE_CHANGE_REQUESTED: 'GRADE',
  GRADE_CHANGE_APPROVED: 'GRADE',
  GRADE_CHANGE_REJECTED: 'GRADE',
  ANNUAL_SUMMARY_UPDATED: 'ANNUAL_SUMMARY',
  AUDIT_REPORT_UPLOADED: 'ANNUAL_SUMMARY',
  DOCUMENT_UPLOADED: 'DOCUMENTS',
  WORK_PLAN_UPDATED: 'WORK_PLAN',
};

/** Fixed wording for actions whose stored detail is technical. */
const FIXED_SUMMARY: Partial<Record<string, string>> = {
  SOCIETY_COUNCIL_UPDATED: 'Exco members updated',
  MEMBER_NIC_UPDATED: 'Exco member NIC recorded',
  SOCIETY_MEMBERSHIP_UPDATED: 'Membership counts updated',
};

function historySummary(event: { action: string; detail: string }) {
  const fixed = FIXED_SUMMARY[event.action];
  if (fixed) return fixed;
  // Profile edits recorded before SC-65 only listed field names.
  if (event.detail.startsWith('Fields:')) return 'Society information updated';
  return event.detail || event.action;
}

const lkr = (value: number) =>
  `LKR ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

/** "FY 2025/26 profit LKR 398,000 → 412,500; expenses entered: LKR 1,286,000" */
export function describeAnnualSummaryChange(
  yearLabel: string,
  previous: { profit: number | null; expenses: number | null },
  next: { profit: number; expenses: number },
) {
  const part = (label: string, before: number | null, after: number) =>
    before == null
      ? `${label} entered: ${lkr(after)}`
      : `${label} ${lkr(before)} → ${after.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  const parts: string[] = [];
  if (previous.profit !== next.profit)
    parts.push(part('profit', previous.profit, next.profit));
  if (previous.expenses !== next.expenses)
    parts.push(part('expenses', previous.expenses, next.expenses));
  return parts.length ? `${yearLabel} ${parts.join('; ')}` : '';
}

/** SC-65: yearly figures, grade requests, change history and the work-plan overview. */
@Injectable()
export class SocietyRecordService {
  private readonly logger = new Logger(SocietyRecordService.name);

  constructor(
    private readonly repository: SocietyRecordRepository,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** Societies outside the user's scope are reported as not found. */
  private async visibleSociety(id: string, principal: Principal) {
    const society = await this.repository.findSociety(id);
    if (!society || !canViewSociety(principal, society)) {
      throw new NotFoundException('Society not found');
    }
    return society;
  }

  private checkYear(year: number) {
    if (!isSelectableFinancialYear(year)) {
      throw new BadRequestException(
        `Choose one of the last completed financial years (latest ${financialYear(latestCompletedFinancialYear()).label})`,
      );
    }
  }

  async getAnnualSummary(
    id: string,
    year: number | undefined,
    principal: Principal,
  ) {
    const society = await this.visibleSociety(id, principal);
    const startYear = year ?? latestCompletedFinancialYear();
    this.checkYear(startYear);
    const { summary, auditReport } = await this.repository.findAnnualSummary(
      society.id,
      startYear,
    );
    return {
      financialYears: selectableFinancialYears(),
      summary: toAnnualSummary(society.id, startYear, summary, auditReport),
    };
  }

  async updateAnnualSummary(
    id: string,
    year: number,
    input: AnnualSummaryUpdateDto,
    principal: Principal,
  ) {
    const society = await this.visibleSociety(id, principal);
    assertCanEditAnnualSummary(principal, society);
    this.checkYear(year);
    const { summary } = await this.repository.findAnnualSummary(
      society.id,
      year,
    );
    const previousProfit = toAmount(summary?.totalProfit);
    const previousExpenses = toAmount(summary?.totalExpenses);
    const description = describeAnnualSummaryChange(
      financialYear(year).label,
      { profit: previousProfit, expenses: previousExpenses },
      { profit: input.totalProfit, expenses: input.totalExpenses },
    );
    // Saving unchanged figures is not a change and adds nothing to the history.
    if (!description) return this.getAnnualSummary(society.id, year, principal);
    await this.repository.saveAnnualSummary(
      society,
      year,
      {
        totalProfit: input.totalProfit,
        totalExpenses: input.totalExpenses,
        profitChanged: previousProfit !== input.totalProfit,
        expensesChanged: previousExpenses !== input.totalExpenses,
        previousProfit,
        previousExpenses,
        summary: description,
      },
      principal,
    );
    return this.getAnnualSummary(society.id, year, principal);
  }

  async listGradeRequests(id: string, principal: Principal) {
    const society = await this.visibleSociety(id, principal);
    const requests = await this.repository.listGradeRequests(society.id);
    return { data: requests.map(toGradeRequest) };
  }

  async requestGradeChange(
    id: string,
    input: GradeChangeRequestDto,
    principal: Principal,
  ) {
    const society = await this.visibleSociety(id, principal);
    assertCanRequestGradeChange(principal, society);
    if (society.grade === input.toGrade) {
      throw new BadRequestException(
        `The society is already grade ${input.toGrade}. Choose a different grade`,
      );
    }
    const pending = (await this.repository.listGradeRequests(society.id)).some(
      (request) => request.status === 'PENDING',
    );
    if (pending) {
      throw new ConflictException(
        'This society already has a grade-change request waiting for HQ',
      );
    }
    const request = await this.repository.createGradeRequest(
      society,
      input,
      principal,
    );
    await this.notify(
      () =>
        this.repository.hqRecipientIds(
          this.config.get<string>('NODE_ENV') !== 'production',
        ),
      {
        category: 'REQUEST',
        title: `Grade change ${society.grade ?? '—'} → ${input.toGrade} requested`,
        body: `${society.nameEn} · sent by ${principal.displayName}`,
        linkPath: `/societies/${society.id}`,
        societyId: society.id,
      },
      request.id,
    );
    return toGradeRequest(request);
  }

  /** Only HQ decides. Approving is the only way a request changes the grade. */
  async decideGradeRequest(
    id: string,
    requestId: string,
    input: GradeDecisionDto,
    principal: Principal,
  ) {
    assertCanDecideGrade(principal);
    const society = await this.visibleSociety(id, principal);
    const request = await this.repository.findGradeRequest(requestId);
    if (!request || request.societyId !== society.id) {
      throw new NotFoundException('Grade-change request not found');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        'This grade-change request has already been decided',
      );
    }
    const approve = input.decision === 'APPROVE';
    if (!approve && !input.comment) {
      throw new BadRequestException(
        'Add a comment explaining why the request is rejected',
      );
    }
    const decided = await this.repository.decideGradeRequest(
      society,
      request,
      { approve, comment: input.comment || null },
      principal,
    );
    await this.notify(
      () => Promise.resolve([request.requestedById]),
      {
        category: approve ? 'APPROVAL' : 'RETURNED',
        title: `Grade ${request.fromGrade ?? '—'} → ${request.toGrade} ${approve ? 'approved' : 'rejected'} by HQ`,
        body: `${society.nameEn}${input.comment ? ` · “${input.comment}”` : ''}`,
        linkPath: `/societies/${society.id}`,
        societyId: society.id,
      },
      request.id,
    );
    return toGradeRequest(decided);
  }

  async history(
    id: string,
    category: HistoryCategoryValue | undefined,
    principal: Principal,
  ) {
    const society = await this.visibleSociety(id, principal);
    const actions = SOCIETY_CHANGE_ACTIONS.filter(
      (action) => !category || HISTORY_CATEGORY[action] === category,
    );
    const events = await this.repository.listHistory(society.id, actions);
    const names = await this.repository.accountNames(
      events.filter((event) => !event.actorName).map((event) => event.actorId),
    );
    return {
      data: events.map((event) => {
        const fallback = names.get(event.actorId);
        const action = event.action as (typeof SOCIETY_CHANGE_ACTIONS)[number];
        return {
          id: event.id,
          category: HISTORY_CATEGORY[action],
          action: event.action,
          summary: historySummary(event),
          actor: actorReference(
            event.actorName ?? fallback?.displayName,
            event.actorRole ?? fallback?.role,
          ),
          occurredAt: event.createdAt.toISOString(),
        };
      }),
    };
  }

  /** D05w overview. Allocated costs are planning figures only. */
  async workPlan(id: string, year: number | undefined, principal: Principal) {
    const society = await this.visibleSociety(id, principal);
    const planYear =
      year ??
      (await this.repository.latestWorkPlanYear(society.id)) ??
      new Date().getFullYear() + 1;
    const [activities, lastChange] = await Promise.all([
      this.repository.listWorkPlan(society.id, planYear),
      this.repository.lastWorkPlanChange(society.id),
    ]);
    const rows = activities.map((activity) => ({
      id: activity.id,
      year: activity.year,
      month: activity.month,
      name: activity.name,
      description: activity.description,
      ...(activity.sector ? { sector: activity.sector } : {}),
      ...(activity.datesLabel ? { datesLabel: activity.datesLabel } : {}),
      allocatedCost: toAmount(activity.allocatedCost) ?? 0,
    }));
    const latestActivity = activities.reduce<
      (typeof activities)[number] | null
    >(
      (latest, activity) =>
        !latest || activity.updatedAt > latest.updatedAt ? activity : latest,
      null,
    );
    return {
      societyId: society.id,
      year: planYear,
      activities: rows,
      totalAllocated:
        Math.round(
          rows.reduce((sum, row) => sum + row.allocatedCost, 0) * 100,
        ) / 100,
      ...(lastChange
        ? {
            lastChange: {
              at: lastChange.createdAt.toISOString(),
              by: actorReference(lastChange.actorName, lastChange.actorRole),
            },
          }
        : latestActivity?.updatedByName
          ? {
              lastChange: {
                at: latestActivity.updatedAt.toISOString(),
                by: actorReference(
                  latestActivity.updatedByName,
                  latestActivity.updatedByRole,
                ),
              },
            }
          : {}),
    };
  }

  /** A failed notification must not undo a saved request or decision. */
  private async notify(
    recipients: () => Promise<string[]>,
    notification: Parameters<NotificationsService['notifyUsers']>[1],
    requestId: string,
  ) {
    try {
      await this.notifications.notifyUsers(await recipients(), notification);
    } catch (error) {
      this.logger.warn(
        `Could not send notifications for grade-change request ${requestId}`,
        error as Error,
      );
    }
  }
}
