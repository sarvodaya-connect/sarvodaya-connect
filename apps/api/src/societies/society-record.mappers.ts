import { USER_ROLES, type UserRole } from '../auth/principal.js';
import { financialYear } from './financial-year.js';

/**
 * Response shapes for the SC-65 society record, matching
 * packages/api-contracts/src/society-record.ts.
 */

type DecimalValue = { toNumber(): number } | number | null | undefined;

export function toAmount(value: DecimalValue): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

export function actorReference(
  displayName: string | null | undefined,
  role: string | null | undefined,
) {
  return {
    displayName: displayName || 'Unknown user',
    ...(role && (USER_ROLES as readonly string[]).includes(role)
      ? { role: role as UserRole }
      : {}),
  };
}

export interface AnnualSummaryRow {
  totalProfit: DecimalValue;
  totalExpenses: DecimalValue;
  previousProfit: DecimalValue;
  previousExpenses: DecimalValue;
  profitUpdatedAt: Date | null;
  profitUpdatedByName: string | null;
  profitUpdatedByRole: string | null;
  expensesUpdatedAt: Date | null;
  expensesUpdatedByName: string | null;
  expensesUpdatedByRole: string | null;
}

export interface AuditReportRow {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date | null;
  uploadedByName: string;
  uploadedByRole?: string | null;
}

function amountChange(
  updatedAt: Date | null,
  name: string | null,
  role: string | null,
  previous: DecimalValue,
) {
  if (!updatedAt) return undefined;
  const previousValue = toAmount(previous);
  return {
    updatedAt: updatedAt.toISOString(),
    updatedBy: actorReference(name, role),
    ...(previousValue != null ? { previousValue } : {}),
  };
}

export function toAnnualSummary(
  societyId: string,
  year: number,
  summary: AnnualSummaryRow | null | undefined,
  auditReport: AuditReportRow | null | undefined,
) {
  const profitChange = summary
    ? amountChange(
        summary.profitUpdatedAt,
        summary.profitUpdatedByName,
        summary.profitUpdatedByRole,
        summary.previousProfit,
      )
    : undefined;
  const expensesChange = summary
    ? amountChange(
        summary.expensesUpdatedAt,
        summary.expensesUpdatedByName,
        summary.expensesUpdatedByRole,
        summary.previousExpenses,
      )
    : undefined;
  return {
    societyId,
    financialYear: financialYear(year),
    totalProfit: toAmount(summary?.totalProfit),
    totalExpenses: toAmount(summary?.totalExpenses),
    ...(profitChange ? { profitChange } : {}),
    ...(expensesChange ? { expensesChange } : {}),
    auditReport:
      auditReport?.uploadedAt != null
        ? {
            documentId: auditReport.id,
            fileName: auditReport.fileName,
            contentType: auditReport.contentType,
            sizeBytes: auditReport.sizeBytes,
            uploadedAt: auditReport.uploadedAt.toISOString(),
            uploadedBy: actorReference(
              auditReport.uploadedByName,
              auditReport.uploadedByRole,
            ),
          }
        : null,
  };
}

export interface GradeRequestRow {
  id: string;
  societyId: string;
  fromGrade: 'A' | 'B' | 'C' | null;
  toGrade: 'A' | 'B' | 'C';
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedByName: string;
  requestedByRole: string;
  requestedAt: Date;
  decidedByName: string | null;
  decidedAt: Date | null;
  decisionComment: string | null;
}

export function toGradeRequest(row: GradeRequestRow) {
  return {
    id: row.id,
    societyId: row.societyId,
    fromGrade: row.fromGrade,
    toGrade: row.toGrade,
    reason: row.reason,
    status: row.status,
    requestedBy: actorReference(row.requestedByName, row.requestedByRole),
    requestedAt: row.requestedAt.toISOString(),
    ...(row.decidedAt
      ? {
          decidedBy: actorReference(row.decidedByName, 'HQ_ADMIN'),
          decidedAt: row.decidedAt.toISOString(),
        }
      : {}),
    ...(row.decisionComment ? { decisionComment: row.decisionComment } : {}),
  };
}
