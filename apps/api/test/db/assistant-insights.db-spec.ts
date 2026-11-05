/** Fictional fixtures in disposable localhost PostgreSQL; no model or AWS calls. */
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AssistantTools } from '../../src/assistant/assistant-tools.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const url = process.env.DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname)) throw new Error('Use disposable localhost PostgreSQL');

const now = new Date('2026-11-05T00:30:00Z');
const day = 86_400_000;
const year = 2025;
const ids = Array.from({ length: 25 }, () => randomUUID());
const districtId = randomUUID();
const outsideDistrictId = randomUUID();
const codes = ids.map((_, i) => `TEST-AI-${String(i).padStart(2, '0')}`);
const requestIds = Array.from({ length: 3 }, () => randomUUID());
const fixture = 'Fictional insight fixture';

describe('SarvoAI insight tools and fictional scope (PostgreSQL)', () => {
  let db: PrismaService;
  let tools: AssistantTools;
  const run = async (name: string, input: object) => {
    const outcome = await tools.run(name, input, now);
    return { ...outcome, data: JSON.parse(outcome.content) };
  };

  beforeAll(async () => {
    db = new PrismaService(new ConfigService());
    await db.$connect();
    tools = new AssistantTools(db, new ConfigService({ SARVOAI_FICTIONAL_ONLY: 'true' }));
    await db.district.createMany({ data: [
      { id: districtId, code: 'TEST-ONLY', nameEn: fixture },
      { id: outsideDistrictId, code: 'AI-OUTSIDE', nameEn: 'Outside fictional scope' },
    ] });
    await db.society.createMany({ data: ids.map((id, i) => ({
      id, societyCode: i === 24 ? 'NONTEST-AI' : codes[i]!, nameEn: `Fictional society ${i}`,
      districtId: i === 23 ? outsideDistrictId : districtId,
      status: i === 22 ? 'INACTIVE' as const : 'ACTIVE' as const,
      grade: 'C' as const, updatedAt: new Date(now.getTime() - (i === 0 || i === 22 ? 91 : i === 1 ? 90 : 1) * day),
    })) });
    await db.annualFinancialSummary.create({ data: { societyId: ids[0]!, financialYear: year, totalProfit: null, totalExpenses: 0 } });
    await db.societyCouncilMember.createMany({ data: [
      { societyId: ids[0]!, seatNumber: 1, fullName: 'Fictional active member', seatType: 'ORDINARY', position: 'President', phone: '+94000000009', nicLastFour: '9999' },
      { societyId: ids[0]!, seatNumber: 2, fullName: 'Fictional inactive member', seatType: 'ORDINARY', position: 'Member', isActive: false },
    ] });
    const types = ['AUDIT_REPORT', 'AGM_MINUTES', 'OFFICE_BEARER_LIST', 'MEMBERS_LIST'] as const;
    await db.societyDocument.createMany({ data: [
      ...types.map((documentType) => ({ societyId: ids[0]!, documentType, accessLevel: documentType === 'MEMBERS_LIST' ? 'REVIEWERS_ONLY' as const : 'STANDARD' as const, financialYear: year, title: documentType, fileName: 'fictional.pdf', contentType: 'application/pdf', sizeBytes: 1, storageKey: randomUUID(), uploadedById: fixture, uploadedByName: fixture, uploadedAt: now })),
      { societyId: ids[1]!, documentType: 'AUDIT_REPORT' as const, financialYear: year, title: 'Draft only', fileName: 'fictional.pdf', contentType: 'application/pdf', sizeBytes: 1, storageKey: randomUUID(), uploadedById: fixture, uploadedByName: fixture, uploadedAt: null },
    ] });
    await db.gradeChangeRequest.createMany({ data: [0, 22, 23, 24].map((i) => ({ societyId: ids[i]!, toGrade: 'B' as const, reason: 'Private free text must not be selected', requestedById: fixture, requestedByName: fixture, requestedByRole: 'SOCIETY_OFFICER', requestedAt: now })) });
    await db.workPlanActivity.createMany({ data: [
      ...Array.from({ length: 6 }, (_, i) => ({ societyId: ids[0]!, year: 2024, month: i + 1, name: `Approved fictional activity ${i}`, description: 'Private activity text must not be selected', allocatedCost: 0, updatedAt: new Date(now.getTime() - i * day) })),
      ...[0, 1, 22, 23, 24].map((i) => ({ societyId: ids[i]!, year: 2026, month: 11, name: 'Waiting fictional activity', description: 'Private activity text must not be selected', allocatedCost: 0, status: 'WAITING_FOR_SPC' as const, submittedAt: i === 1 ? null : new Date(now.getTime() - day) })),
    ] });
    await db.informationRequest.createMany({ data: requestIds.map((id, i) => ({ id, title: 'Fictional request', audience: 'ALL_ACTIVE' as const, dueOn: new Date(i === 1 ? '2026-11-05T00:00:00Z' : '2026-11-04T00:00:00Z'), createdById: fixture, createdByName: fixture })) });
    await db.informationRequestSociety.createMany({ data: [
      ...[0, 1, 22, 23, 24].map((i) => ({ requestId: requestIds[0]!, societyId: ids[i]!, note: 'Private request note must not be selected' })),
      { requestId: requestIds[1]!, societyId: ids[0]! },
      { requestId: requestIds[2]!, societyId: ids[0]!, respondedAt: now },
    ] });
  });

  afterAll(async () => {
    if (!db) return;
    await db.informationRequest.deleteMany({ where: { id: { in: requestIds } } });
    await db.gradeChangeRequest.deleteMany({ where: { societyId: { in: ids } } });
    await db.workPlanActivity.deleteMany({ where: { societyId: { in: ids } } });
    await db.societyDocument.deleteMany({ where: { societyId: { in: ids } } });
    await db.societyCouncilMember.deleteMany({ where: { societyId: { in: ids } } });
    await db.annualFinancialSummary.deleteMany({ where: { societyId: { in: ids } } });
    await db.society.deleteMany({ where: { id: { in: ids } } });
    await db.district.deleteMany({ where: { id: { in: [districtId, outsideDistrictId] } } });
    await db.$disconnect();
  });

  it('returns an overview with missing money as null and zero as zero, without personal fields', async () => {
    const result = await run('get_society_overview', { societyCode: codes[0], financialYear: year });
    expect(result.data).toMatchObject({ totalProfitLkr: null, totalExpensesLkr: 0, currentExcoSeats: 1, missingRegistrarUploads: [], pendingGradeRequests: 1, overdueUnansweredRequests: 1 });
    expect(result.data.recentApprovedActivities).toHaveLength(5);
    expect(result.data.recentApprovedActivities[0]).toMatchObject({ name: 'Approved fictional activity 0', year: 2024 });
    expect(result.data.note).toContain('across all years');
    expect(result.answer?.details.sources).toContainEqual(expect.objectContaining({ href: `/societies/${ids[0]}/documents` }));
    for (const secret of ['+94000000009', '9999', 'Fictional active member', 'Private activity text', 'Private request note']) expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('excludes out-of-scope societies from exact lookups but permits inactive fictional profiles', async () => {
    for (const societyCode of [codes[23], 'NONTEST-AI', 'TEST-UNKNOWN']) {
      const result = await run('get_society_overview', { societyCode, financialYear: year });
      expect(result.data.matches).toEqual([]);
      expect(result.answer?.scope?.societiesIncluded).toBe(0);
    }
    expect((await run('get_society_overview', { societyCode: codes[22], financialYear: year })).data.society.status).toBe('INACTIVE');
  });

  it('counts all gaps, excludes drafts and inactive/out-of-scope societies, and reports truncation', async () => {
    const result = await run('find_compliance_gaps', { financialYear: year, district: '' });
    expect(result.data).toMatchObject({ activeSocieties: 22, societiesMissingUploads: 21, societiesWithAllFourUploads: 1, shown: 20, truncated: true });
    expect(result.data.records[0]).toMatchObject({ societyCode: codes[1], missingUploads: ['Audit report', 'AGM minutes', 'Office-bearer list', 'Members list'] });
    expect(result.answer?.table?.totalRows).toBe(21);
    expect(result.data.rule).toContain('not approval or legal compliance');
  });

  it('reports outstanding queues with Sri Lanka due-date boundaries and overlapping counts', async () => {
    const result = await run('list_outstanding_work', { district: '' });
    expect(result.data.totals).toEqual({ overdueUnansweredSocietyRequests: 2, pendingHqGradeReviews: 1, activitiesWaitingForSpc: 2, profilesNotUpdatedIn90Days: 1 });
    expect(result.data.examples[0].reason).toContain('Unanswered');
    expect(result.data.examples.some((row: { date: string | null }) => row.date === null)).toBe(true);
    expect(result.data.rule).toContain('do not add counts as unique societies');
    expect(result.data.rule).toContain('due today is not overdue');
    expect(JSON.stringify(result)).not.toContain('Private request note');
  });

  it('applies district scope and rejects future years and invalid inputs before query execution', async () => {
    expect((await run('find_compliance_gaps', { financialYear: year, district: fixture })).data.activeSocieties).toBe(22);
    for (const name of ['find_compliance_gaps', 'list_outstanding_work']) {
      const result = await tools.run(name, { financialYear: year, district: 'Outside fictional scope' }, now);
      expect(result.isError).toBe(true);
    }
    for (const financialYear of [2026, '2025', 1999]) {
      expect((await tools.run('get_society_overview', { societyCode: codes[0], financialYear }, now)).isError).toBe(true);
    }
  });

  it('scopes legacy tools too and disables personal Exco lookups in the pilot', async () => {
    expect((await run('list_districts', {})).data.districts).toEqual([fixture]);
    const found = await run('find_societies', { query: 'Fictional society' });
    expect(found.data.matches.every((row: { societyCode: string }) => row.societyCode.startsWith('TEST-') && row.societyCode !== codes[23])).toBe(true);
    const exco = await tools.run('get_exco_member', { societyCode: codes[0], position: 'President' }, now);
    expect(exco.isError).toBe(true);
    expect(exco.content).not.toContain('Fictional active member');
    const total = await run('summarize_yearly_figure', { financialYear: year, metric: 'expenses', district: '' });
    expect(total.data.activeSocieties).toBe(22);
  });

  it('does not create or mutate records while answering insight questions', async () => {
    const snapshot = async () => ({
      societies: await db.society.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
      documents: await db.societyDocument.count({ where: { societyId: { in: ids } } }),
      requests: await db.informationRequestSociety.count({ where: { societyId: { in: ids } } }),
      audits: await db.platformAuditEvent.count(),
    });
    const before = await snapshot();
    await run('get_society_overview', { societyCode: codes[0], financialYear: year });
    await run('find_compliance_gaps', { financialYear: year, district: '' });
    await run('list_outstanding_work', { district: '' });
    expect(await snapshot()).toEqual(before);
  });
});
