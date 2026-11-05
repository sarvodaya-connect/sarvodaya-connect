import { REGISTRAR_DOCUMENT_TYPES } from '../documents/upload-rules.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { financialYear } from '../societies/financial-year.js';
import { sriLankaToday } from '../national/requests.service.js';
import type { ToolOutcome } from './assistant-tools.js';

const ROW_LIMIT = 20;
const DAY_MS = 86_400_000;
const documentLabels = {
  AUDIT_REPORT: 'Audit report', AGM_MINUTES: 'AGM minutes',
  OFFICE_BEARER_LIST: 'Office-bearer list', MEMBERS_LIST: 'Members list',
};
const societyFields = {
  id: true, societyCode: true, nameEn: true, updatedAt: true,
  district: { select: { nameEn: true } },
} as const;

/** Operational evidence only: no document contents, contacts or Exco identities. */
export class AssistantInsights {
  constructor(private readonly prisma: PrismaService, private readonly fictionalOnly: boolean) {}

  private scope(districtId?: string): Prisma.SocietyWhereInput {
    return {
      ...(this.fictionalOnly ? { societyCode: { startsWith: 'TEST-' }, district: { code: 'TEST-ONLY' } } : {}),
      ...(districtId ? { districtId } : {}),
    };
  }

  async overview(societyCode: string, year: number, now: Date): Promise<ToolOutcome> {
    return this.prisma.$transaction(async (db) => {
      const society = await db.society.findFirst({
        where: { AND: [this.scope(), { societyCode }] },
        select: { ...societyFields, status: true, grade: true },
      });
      if (!society) return {
        content: JSON.stringify({ matches: [], note: 'No matching society in the permitted scope.' }),
        answer: { scope: { financialYears: [financialYear(year).label], societiesIncluded: 0 }, details: { recordsUsed: ['Exact S-number lookup within permitted society records'], sources: [] } },
      };
      const day = new Date(`${sriLankaToday(now)}T00:00:00Z`);
      const [documents, figures, activities, pendingGrades, overdueRequests, excoSeats] = await Promise.all([
        db.societyDocument.findMany({
          where: { societyId: society.id, financialYear: year, documentType: { in: [...REGISTRAR_DOCUMENT_TYPES] }, uploadedAt: { not: null } },
          select: { documentType: true, updatedAt: true }, distinct: ['documentType'],
          orderBy: { updatedAt: 'desc' },
        }),
        db.annualFinancialSummary.findUnique({
          where: { societyId_financialYear: { societyId: society.id, financialYear: year } },
          select: { totalProfit: true, totalExpenses: true, updatedAt: true },
        }),
        db.workPlanActivity.findMany({
          where: { societyId: society.id, status: 'APPROVED' },
          select: { id: true, name: true, year: true, month: true, updatedAt: true },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 5,
        }),
        db.gradeChangeRequest.count({ where: { societyId: society.id, status: 'PENDING' } }),
        db.informationRequestSociety.count({ where: { societyId: society.id, respondedAt: null, request: { dueOn: { lt: day } } } }),
        db.societyCouncilMember.count({ where: { societyId: society.id, isActive: true, endedOn: null, fullName: { not: '' } } }),
      ]);
      const uploaded = new Set(documents.map((item) => item.documentType));
      const missing = REGISTRAR_DOCUMENT_TYPES.filter((type) => !uploaded.has(type)).map((type) => documentLabels[type]);
      const data = {
        society: { name: society.nameEn, societyCode, district: society.district.nameEn, status: society.status, grade: society.grade },
        profileUpdatedAt: society.updatedAt.toISOString(), dataAsOf: now.toISOString(),
        financialYear: financialYear(year).label,
        totalProfitLkr: figures?.totalProfit == null ? null : Number(figures.totalProfit),
        totalExpensesLkr: figures?.totalExpenses == null ? null : Number(figures.totalExpenses),
        figuresUpdatedAt: figures?.updatedAt.toISOString() ?? null,
        missingRegistrarUploads: missing, currentExcoSeats: excoSeats, requiredExcoSeats: 25,
        pendingGradeRequests: pendingGrades, overdueUnansweredRequests: overdueRequests,
        recentApprovedActivities: activities.map((item) => ({ name: item.name, year: item.year, month: item.month, updatedAt: item.updatedAt.toISOString() })),
        note: 'Activity list is the five most recently updated approved records across all years, not a total or a list restricted to the selected financial year. Activity year/month are plan dates; approval does not establish completion or outcomes. Profile timestamp is not a timestamp for all related records. Null figures are missing, not zero. Current Exco seat count counts active named rows, not a validation of committee composition. Upload completeness does not establish document approval or legal compliance.',
      };
      return {
        content: JSON.stringify(data),
        answer: {
          scope: { financialYears: [financialYear(year).label], district: society.district.nameEn, societiesIncluded: 1 },
          table: { columns: ['Check', 'Recorded result'], rows: [
            ['Status', society.status], ['Grade', society.grade], ['Current Exco seats', excoSeats],
            ['Missing Registrar uploads', missing.join(', ') || 'None'],
            ['Pending grade requests', pendingGrades], ['Overdue unanswered requests', overdueRequests],
            ['Yearly profit (LKR)', data.totalProfitLkr], ['Yearly expenses (LKR)', data.totalExpensesLkr],
          ], totalRows: 8 },
          details: {
            recordsUsed: [`Society ${society.societyCode}: profile, Registrar upload metadata, annual totals, approved activities, pending grades and unanswered requests`],
            calculation: data.note,
            sources: [
              { label: `${society.societyCode} — society profile`, href: `/societies/${society.id}`, updatedAt: society.updatedAt.toISOString() },
              { label: 'Registrar uploads', href: `/societies/${society.id}/documents`, updatedAt: documents[0]?.updatedAt.toISOString() },
              { label: 'Exco completeness', href: `/societies/${society.id}/exco` },
              { label: 'Work plan and activities', href: `/societies/${society.id}/work-plan`, updatedAt: activities[0]?.updatedAt.toISOString() },
              { label: 'Grade requests', href: `/societies/${society.id}/grade` },
              { label: 'Information requests', href: '/requests' },
            ],
          },
        },
      };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async compliance(year: number, now: Date, districtId?: string, district?: string): Promise<ToolOutcome> {
    const scope: Prisma.SocietyWhereInput = { ...this.scope(districtId), status: 'ACTIVE' };
    // Match the existing Registrar screen: an upload requires uploadedAt,
    // not a draft row. Do not mistake presence for acceptance/approval.
    const gapWhere: Prisma.SocietyWhereInput = {
      ...scope,
      OR: REGISTRAR_DOCUMENT_TYPES.map((documentType) => ({
        documents: { none: { documentType, financialYear: year, uploadedAt: { not: null } } },
      })),
    };
    const [total, missingCount, rows] = await this.prisma.$transaction([
      this.prisma.society.count({ where: scope }),
      this.prisma.society.count({ where: gapWhere }),
      this.prisma.society.findMany({
        where: gapWhere, orderBy: [{ societyCode: 'asc' }, { id: 'asc' }], take: ROW_LIMIT,
        select: {
          ...societyFields,
          documents: {
            where: { documentType: { in: [...REGISTRAR_DOCUMENT_TYPES] }, financialYear: year, uploadedAt: { not: null } },
            select: { documentType: true }, distinct: ['documentType'],
          },
        },
      }),
    ], { isolationLevel: 'RepeatableRead' });
    const records = rows.map((society) => {
      const uploaded = new Set(society.documents.map((doc) => doc.documentType));
      return { societyCode: society.societyCode, name: society.nameEn, district: society.district.nameEn,
        missingUploads: REGISTRAR_DOCUMENT_TYPES.filter((type) => !uploaded.has(type)).map((type) => documentLabels[type]),
        profileUpdatedAt: society.updatedAt.toISOString() };
    });
    const rule = 'Four Registrar upload types for the selected financial year. Drafts without a confirmed upload do not count. Presence is not approval or legal compliance; no deadline is inferred. Missing counts are for all active societies in scope; the list is limited to 20, ordered by S number.';
    return {
      content: JSON.stringify({ financialYear: financialYear(year).label, district: district ?? 'All permitted districts', dataAsOf: now.toISOString(), activeSocieties: total, societiesMissingUploads: missingCount, societiesWithAllFourUploads: total - missingCount, shown: records.length, truncated: missingCount > records.length, records, rule }),
      answer: {
        scope: { financialYears: [financialYear(year).label], district, societiesIncluded: total },
        table: { columns: ['S number', 'Society', 'District', 'Missing uploads'], rows: records.map((row) => [row.societyCode, row.name, row.district, row.missingUploads.join(', ')]), totalRows: missingCount },
        details: {
          recordsUsed: ['Active society records and Registrar upload metadata for the selected financial year; document contents were not read'],
          calculation: `${missingCount} of ${total} active societies have at least one missing upload. ${rule}`,
          sources: rows.map((society) => ({ label: `${society.societyCode} — Registrar documents`, href: `/societies/${society.id}/documents` })),
        },
      },
    };
  }

  async outstanding(now: Date, districtId?: string, district?: string): Promise<ToolOutcome> {
    const scope: Prisma.SocietyWhereInput = { ...this.scope(districtId), status: 'ACTIVE' };
    const cutoff = new Date(now.getTime() - 90 * DAY_MS);
    const overdueWhere = { respondedAt: null, society: scope, request: { dueOn: { lt: new Date(`${sriLankaToday(now)}T00:00:00Z`) } } };
    const gradeWhere = { status: 'PENDING' as const, society: scope };
    const activityWhere = { status: 'WAITING_FOR_SPC' as const, society: scope };
    const staleWhere = { ...scope, updatedAt: { lt: cutoff } };
    const [overdue, grades, activities, stale, overdueRows, gradeRows, activityRows, staleRows] = await this.prisma.$transaction([
      this.prisma.informationRequestSociety.count({ where: overdueWhere }),
      this.prisma.gradeChangeRequest.count({ where: gradeWhere }),
      this.prisma.workPlanActivity.count({ where: activityWhere }),
      this.prisma.society.count({ where: staleWhere }),
      this.prisma.informationRequestSociety.findMany({ where: overdueWhere, orderBy: [{ request: { dueOn: 'asc' } }, { requestId: 'asc' }, { societyId: 'asc' }], take: 5,
        select: { society: { select: societyFields }, request: { select: { dueOn: true, createdAt: true } } } }),
      this.prisma.gradeChangeRequest.findMany({ where: gradeWhere, orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }], take: 5,
        select: { society: { select: societyFields }, requestedAt: true } }),
      this.prisma.workPlanActivity.findMany({ where: activityWhere, orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }], take: 5,
        select: { society: { select: societyFields }, submittedAt: true, updatedAt: true } }),
      this.prisma.society.findMany({ where: staleWhere, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 5, select: societyFields }),
    ], { isolationLevel: 'RepeatableRead' });
    const totals = { overdueUnansweredSocietyRequests: overdue, pendingHqGradeReviews: grades, activitiesWaitingForSpc: activities, profilesNotUpdatedIn90Days: stale };
    const examples = [
      ...overdueRows.map((row) => ({ reason: 'Unanswered society request past due', societyCode: row.society.societyCode, date: row.request.dueOn.toISOString(), href: '/requests' })),
      ...gradeRows.map((row) => ({ reason: 'HQ grade decision pending', societyCode: row.society.societyCode, date: row.requestedAt.toISOString(), href: `/societies/${row.society.id}/grade` })),
      ...activityRows.map((row) => ({ reason: 'SPC review pending — HQ follow-up only', societyCode: row.society.societyCode, date: row.submittedAt?.toISOString() ?? null, href: `/societies/${row.society.id}/work-plan` })),
      ...staleRows.map((row) => ({ reason: 'Profile older than 90 days', societyCode: row.societyCode, date: row.updatedAt.toISOString(), href: `/societies/${row.id}` })),
    ];
    const rule = 'Fixed queue order: overdue unanswered society-request pairs, pending HQ grade decisions, activities waiting for their SPC, then profiles older than 90 days. Oldest first within each queue; at most five examples per queue. These are follow-up reasons, not AI risk scores or proof of poor performance. Categories can overlap: do not add counts as unique societies. An absent submitted date is unknown, not zero waiting time. Due dates use Sri Lanka local today; a request due today is not overdue.';
    return {
      content: JSON.stringify({ dataAsOf: now.toISOString(), district: district ?? 'All permitted districts', totals, examples, rule }),
      answer: {
        scope: { financialYears: [], district },
        table: { columns: ['Follow-up queue', 'Items'], rows: [
          ['Overdue unanswered society-request pairs', overdue], ['HQ grade decisions pending', grades],
          ['Activities waiting for SPC review', activities], ['Society profiles older than 90 days', stale],
        ], totalRows: 4 },
        details: {
          recordsUsed: ['Active societies, information-request response status/due dates, pending grade requests and SPC activity queue metadata'],
          calculation: rule,
          sources: [...new Map(examples.map((item) => [item.href, { label: `${item.societyCode} — ${item.reason}`, href: item.href }])).values()],
        },
      },
    };
  }
}
