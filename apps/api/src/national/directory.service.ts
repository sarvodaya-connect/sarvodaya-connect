import { Injectable, NotFoundException } from '@nestjs/common';

import type { Principal } from '../auth/principal.js';
import { REGISTRAR_DOCUMENT_TYPES } from '../documents/upload-rules.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  canViewSociety,
  societyWhereForPrincipal,
} from '../societies/society-access.policy.js';
import type { DirectoryQueryDto, DirectoryViewValue } from './directory.dto.js';
import {
  type DirectoryRecord,
  DirectoryRepository,
} from './directory.repository.js';
import {
  auditPastDue,
  calendarYear,
  pageMeta,
  percent,
  period,
  staleCutoff,
} from './national-rules.js';
import { EXCO_SEATS } from '../societies/societies.service.js';
import { chosenYear } from './national.service.js';

const NONE: Prisma.SocietyWhereInput = { id: { in: [] } };

/** The eight fields a complete society record has (see the societies list). */
export function recordFields(record: {
  establishedOn: Date | null;
  addressLine: string | null;
  village: string | null;
  gnDivision: string | null;
  dsDivision: string | null;
  latitude: number | null;
  longitude: number | null;
  contacts?: { fullName: string | null; phone: string | null }[];
}) {
  const primary = record.contacts?.[0];
  const present = [
    record.establishedOn,
    record.addressLine,
    record.village,
    record.gnDivision,
    record.dsDivision,
    primary?.fullName,
    primary?.phone,
    record.latitude != null && record.longitude != null,
  ].filter(Boolean).length;
  return { present, total: 8 };
}

function figuresAdded(record: DirectoryRecord) {
  const summary = record.annualSummaries[0];
  return Boolean(
    summary && summary.totalProfit !== null && summary.totalExpenses !== null,
  );
}

/** V5 D04 / M66 society directory and M67 society summary, within each user's scope. */
@Injectable()
export class DirectoryService {
  constructor(private readonly repository: DirectoryRepository) {}

  private viewWhere(
    view: DirectoryViewValue,
    startYear: number,
    now: Date,
  ): Prisma.SocietyWhereInput {
    switch (view) {
      case 'not-updated':
        return { updatedAt: { lt: staleCutoff(now) } };
      case 'figures-not-added':
        return {
          NOT: {
            annualSummaries: {
              some: {
                financialYear: startYear,
                totalProfit: { not: null },
                totalExpenses: { not: null },
              },
            },
          },
        };
      case 'audit-past-due':
        return auditPastDue(startYear, now)
          ? {
              documents: {
                none: {
                  documentType: 'AUDIT_REPORT',
                  financialYear: startYear,
                  uploadedAt: { not: null },
                },
              },
            }
          : NONE;
      default:
        return {};
    }
  }

  private async filters(
    query: DirectoryQueryDto,
    principal: Principal,
    now: Date,
  ): Promise<Prisma.SocietyWhereInput[]> {
    const search = query.q?.trim();
    const spcSocieties = query.spcId
      ? await this.repository.spcSocietyIds(query.spcId)
      : undefined;
    return [
      societyWhereForPrincipal(principal),
      query.status === 'ALL' ? {} : { status: 'ACTIVE' },
      search
        ? {
            OR: [
              { nameEn: { contains: search, mode: 'insensitive' } },
              { nameLocal: { contains: search, mode: 'insensitive' } },
              { societyCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      query.districtId ? { districtId: query.districtId } : {},
      query.dsDivision ? { dsDivision: query.dsDivision } : {},
      query.grade === 'NONE'
        ? { grade: null }
        : query.grade
          ? { grade: query.grade }
          : {},
      spcSocieties === undefined
        ? {}
        : spcSocieties === null
          ? NONE
          : { id: { in: spcSocieties } },
      query.records === 'stale'
        ? { updatedAt: { lt: staleCutoff(now) } }
        : query.records === 'recent'
          ? { updatedAt: { gte: staleCutoff(now) } }
          : {},
      query.gradeRequest === 'waiting'
        ? { gradeRequests: { some: { status: 'PENDING' } } }
        : query.gradeRequest === 'none'
          ? { gradeRequests: { none: { status: 'PENDING' } } }
          : {},
    ];
  }

  async list(query: DirectoryQueryDto, principal: Principal, now = new Date()) {
    const startYear = chosenYear(query.year, now);
    const base = await this.filters(query, principal, now);
    const where = (view: DirectoryViewValue): Prisma.SocietyWhereInput => ({
      AND: [...base, this.viewWhere(view, startYear, now)],
    });
    const [page, all, notUpdated, figures, audit, grades] = await Promise.all([
      this.repository.page(
        where(query.view),
        startYear,
        query.page,
        query.pageSize,
      ),
      this.repository.count(where('all')),
      this.repository.count(where('not-updated')),
      this.repository.count(where('figures-not-added')),
      this.repository.count(where('audit-past-due')),
      this.repository.gradeCounts(where(query.view)),
    ]);
    const staff = await this.repository.staffFor(
      page.records.map((record) => record.id),
    );
    const cutoff = staleCutoff(now).getTime();

    return {
      financialYear: period(startYear),
      views: {
        all,
        'not-updated': notUpdated,
        'figures-not-added': figures,
        'audit-past-due': audit,
      },
      grades,
      data: page.records.map((record) => {
        const spc = staff.find(
          (account) =>
            account.role === 'PROGRAMME_COORDINATOR' &&
            account.societyIds.includes(record.id),
        );
        const officer = staff.find(
          (account) =>
            account.role === 'SOCIETY_OFFICER' &&
            account.societyIds.includes(record.id),
        );
        return {
          id: record.id,
          societyCode: record.societyCode,
          name: record.nameEn,
          nameLocal: record.nameLocal,
          district: { id: record.district.id, name: record.district.nameEn },
          dsDivision: record.dsDivision,
          status: record.status,
          grade: record.grade,
          requestedGrade: record.gradeRequests[0]?.toGrade ?? null,
          members: record.memberCount,
          spc: spc ? { id: spc.id, name: spc.displayName } : null,
          societyOfficer: officer
            ? { name: officer.displayName, status: officer.status }
            : null,
          figuresAdded: figuresAdded(record),
          excoSeatsFilled: Math.min(record._count.councilMembers, EXCO_SEATS),
          updatedAt: record.updatedAt.toISOString(),
          notUpdatedIn90Days: record.updatedAt.getTime() < cutoff,
        };
      }),
      meta: pageMeta(query.page, query.pageSize, page.totalItems),
    };
  }

  /** M67. Societies outside the user's scope are reported as not found. */
  async summary(id: string, principal: Principal, now = new Date()) {
    const startYear = chosenYear(undefined, now);
    const planYear = calendarYear(now);
    const record = await this.repository.summary(id, startYear, planYear);
    if (!record || !canViewSociety(principal, record, now))
      throw new NotFoundException('Society not found');
    const staff = await this.repository.staffFor([record.id]);
    const fields = recordFields(record);
    const membershipYear = record.memberships[0]?.year ?? null;
    const membershipTotal = record.memberships
      .filter((row) => row.year === membershipYear)
      .reduce((sum, row) => sum + row.female + row.male, 0);
    const summary = record.annualSummaries[0];
    const uploaded = new Set(record.documents.map((doc) => doc.documentType));
    const request = record.gradeRequests[0];
    const approved = record.workPlanActivities.filter(
      (activity) => activity.status === 'APPROVED',
    );
    const spc = staff.find(
      (account) => account.role === 'PROGRAMME_COORDINATOR',
    );

    return {
      id: record.id,
      name: record.nameEn,
      societyCode: record.societyCode,
      districtId: record.district.id,
      district: record.district.nameEn,
      grade: record.grade,
      status: record.status,
      updatedAt: record.updatedAt.toISOString(),
      members: record.memberCount ?? (membershipYear ? membershipTotal : null),
      membershipYear,
      recordsCompletePercent: percent(fields.present, fields.total),
      missingFields: fields.total - fields.present,
      financialYear: period(startYear),
      profit: summary?.totalProfit?.toString() ?? null,
      expenses: summary?.totalExpenses?.toString() ?? null,
      hasSocietyOfficer: staff.some(
        (account) => account.role === 'SOCIETY_OFFICER',
      ),
      spcName: spc?.displayName ?? null,
      registrarDocuments: REGISTRAR_DOCUMENT_TYPES.map((documentType) => ({
        documentType,
        uploaded: uploaded.has(documentType),
      })),
      auditReportPastDue:
        !uploaded.has('AUDIT_REPORT') && auditPastDue(startYear, now),
      gradeRequest: request
        ? {
            fromGrade: request.fromGrade,
            toGrade: request.toGrade,
            requestedAt: request.requestedAt.toISOString(),
          }
        : null,
      activities: {
        planned: record.workPlanActivities.length,
        approved: approved.length,
        latest: approved[0]
          ? {
              name: approved[0].name,
              sdgs: approved[0].sdgs.map((row) => row.sdg),
            }
          : null,
      },
    };
  }
}
