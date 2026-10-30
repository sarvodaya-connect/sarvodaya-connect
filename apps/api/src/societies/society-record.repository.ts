import { ConflictException, Injectable } from '@nestjs/common';

import { DEMO_PRINCIPALS } from '../auth/demo-principals.js';
import type { Principal } from '../auth/principal.js';
import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Grade = 'A' | 'B' | 'C';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorFields(principal: Principal) {
  return {
    actorId: principal.id,
    actorName: principal.displayName,
    actorRole: principal.roles[0] ?? null,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export interface AnnualSummaryChange {
  totalProfit: number;
  totalExpenses: number;
  profitChanged: boolean;
  expensesChanged: boolean;
  previousProfit: number | null;
  previousExpenses: number | null;
  summary: string;
}

/** PostgreSQL access for the SC-65 society record. No access rules live here. */
@Injectable()
export class SocietyRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSociety(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.society.findUnique({
        where: { id },
        select: {
          id: true,
          nameEn: true,
          societyCode: true,
          districtId: true,
          grade: true,
        },
      }),
    );
  }

  async findAnnualSummary(societyId: string, financialYear: number) {
    const [summary, auditReport] = await executeDatabaseOperation(() =>
      this.prisma.$transaction([
        this.prisma.annualFinancialSummary.findUnique({
          where: { societyId_financialYear: { societyId, financialYear } },
        }),
        this.prisma.societyDocument.findFirst({
          where: {
            societyId,
            documentType: 'AUDIT_REPORT',
            financialYear,
            uploadedAt: { not: null },
          },
          orderBy: [{ uploadedAt: 'desc' }, { version: 'desc' }],
        }),
      ]),
    );
    return { summary, auditReport };
  }

  /** Saves both totals, keeps the previous values and writes the history entry. */
  saveAnnualSummary(
    society: { id: string; districtId: string },
    financialYear: number,
    change: AnnualSummaryChange,
    principal: Principal,
  ) {
    const now = new Date();
    const role = principal.roles[0] ?? null;
    const profitMeta = change.profitChanged
      ? {
          previousProfit: change.previousProfit,
          profitUpdatedAt: now,
          profitUpdatedByName: principal.displayName,
          profitUpdatedByRole: role,
        }
      : {};
    const expensesMeta = change.expensesChanged
      ? {
          previousExpenses: change.previousExpenses,
          expensesUpdatedAt: now,
          expensesUpdatedByName: principal.displayName,
          expensesUpdatedByRole: role,
        }
      : {};
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.annualFinancialSummary.upsert({
          where: {
            societyId_financialYear: { societyId: society.id, financialYear },
          },
          create: {
            societyId: society.id,
            financialYear,
            totalProfit: change.totalProfit,
            totalExpenses: change.totalExpenses,
            ...profitMeta,
            ...expensesMeta,
          },
          update: {
            totalProfit: change.totalProfit,
            totalExpenses: change.totalExpenses,
            ...profitMeta,
            ...expensesMeta,
          },
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'ANNUAL_SUMMARY_UPDATED',
            targetId: society.id,
            societyId: society.id,
            districtId: society.districtId,
            detail: change.summary.slice(0, 2000),
          },
        });
      }),
    );
  }

  listGradeRequests(societyId: string) {
    return executeDatabaseOperation(() =>
      this.prisma.gradeChangeRequest.findMany({
        where: { societyId },
        orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
        take: 50,
      }),
    );
  }

  findGradeRequest(id: string) {
    return executeDatabaseOperation(() =>
      this.prisma.gradeChangeRequest.findUnique({ where: { id } }),
    );
  }

  async createGradeRequest(
    society: { id: string; districtId: string; grade: Grade | null },
    input: { toGrade: Grade; reason: string },
    principal: Principal,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.gradeChangeRequest.create({
          data: {
            societyId: society.id,
            fromGrade: society.grade,
            toGrade: input.toGrade,
            reason: input.reason,
            requestedById: principal.id,
            requestedByName: principal.displayName,
            requestedByRole: principal.roles[0] ?? 'UNKNOWN',
          },
        });
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: 'GRADE_CHANGE_REQUESTED',
            targetId: request.id,
            societyId: society.id,
            districtId: society.districtId,
            detail:
              `Grade change ${society.grade ?? 'not set'} → ${input.toGrade} requested · “${input.reason}”`.slice(
                0,
                2000,
              ),
          },
        });
        return request;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This society already has a grade-change request waiting for HQ',
        );
      }
      return executeDatabaseOperation(() => Promise.reject(error));
    }
  }

  /**
   * Records HQ's decision. Only a request that is still waiting can be
   * decided, so two HQ users cannot decide the same request twice.
   */
  decideGradeRequest(
    society: { id: string; districtId: string },
    request: { id: string; fromGrade: Grade | null; toGrade: Grade },
    decision: { approve: boolean; comment: string | null },
    principal: Principal,
  ) {
    const now = new Date();
    return executeDatabaseOperation(() =>
      this.prisma.$transaction(async (tx) => {
        const updated = await tx.gradeChangeRequest.updateMany({
          where: { id: request.id, status: 'PENDING' },
          data: {
            status: decision.approve ? 'APPROVED' : 'REJECTED',
            decidedById: principal.id,
            decidedByName: principal.displayName,
            decidedAt: now,
            decisionComment: decision.comment,
          },
        });
        if (updated.count === 0) {
          throw new ConflictException(
            'This grade-change request has already been decided',
          );
        }
        if (decision.approve) {
          await tx.society.update({
            where: { id: society.id },
            data: {
              grade: request.toGrade,
              gradeChangedAt: now,
              gradeChangedByName: principal.displayName,
              gradeChangedByRole: principal.roles[0] ?? null,
            },
          });
        }
        const change = `${request.fromGrade ?? 'not set'} → ${request.toGrade}`;
        await tx.platformAuditEvent.create({
          data: {
            ...actorFields(principal),
            action: decision.approve
              ? 'GRADE_CHANGE_APPROVED'
              : 'GRADE_CHANGE_REJECTED',
            targetId: request.id,
            societyId: society.id,
            districtId: society.districtId,
            detail:
              `Grade ${change} ${decision.approve ? 'approved' : 'rejected'} by HQ${
                decision.comment ? ` · “${decision.comment}”` : ''
              }`.slice(0, 2000),
          },
        });
        return tx.gradeChangeRequest.findUniqueOrThrow({
          where: { id: request.id },
        });
      }),
    );
  }

  listHistory(societyId: string, actions: readonly string[]) {
    return executeDatabaseOperation(() =>
      this.prisma.platformAuditEvent.findMany({
        where: { societyId, action: { in: [...actions] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
    );
  }

  /** Display names for history entries written before names were stored. */
  async accountNames(ids: string[]) {
    const uuids = [...new Set(ids)].filter((id) => UUID_PATTERN.test(id));
    const accounts = uuids.length
      ? await executeDatabaseOperation(() =>
          this.prisma.platformAccount.findMany({
            where: { id: { in: uuids } },
            select: { id: true, displayName: true, role: true },
          }),
        )
      : [];
    const names = new Map<string, { displayName: string; role: string }>();
    for (const account of accounts) names.set(account.id, account);
    for (const principal of DEMO_PRINCIPALS) {
      if (ids.includes(principal.id)) {
        names.set(principal.id, {
          displayName: principal.displayName,
          role: principal.roles[0]!,
        });
      }
    }
    return names;
  }

  async latestWorkPlanYear(societyId: string) {
    const latest = await executeDatabaseOperation(() =>
      this.prisma.workPlanActivity.aggregate({
        where: { societyId },
        _max: { year: true },
      }),
    );
    return latest._max.year;
  }

  listWorkPlan(societyId: string, year: number) {
    return executeDatabaseOperation(() =>
      this.prisma.workPlanActivity.findMany({
        where: { societyId, year },
        orderBy: [{ month: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  }

  lastWorkPlanChange(societyId: string) {
    return executeDatabaseOperation(() =>
      this.prisma.platformAuditEvent.findFirst({
        where: { societyId, action: 'WORK_PLAN_UPDATED' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** Active HQ accounts, plus the demo HQ user outside production. */
  async hqRecipientIds(includeDemo: boolean) {
    const accounts = await executeDatabaseOperation(() =>
      this.prisma.platformAccount.findMany({
        where: { role: 'HQ_ADMIN', status: 'ACTIVE' },
        select: { id: true },
      }),
    );
    return [
      ...accounts.map((account) => account.id),
      ...(includeDemo
        ? DEMO_PRINCIPALS.filter((principal) =>
            principal.roles.includes('HQ_ADMIN'),
          ).map((principal) => principal.id)
        : []),
    ];
  }
}
