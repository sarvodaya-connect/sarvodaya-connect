import { BadRequestException, Injectable } from '@nestjs/common';

import { ACTIVITY_DIMENSION_VALUES } from '../activities/activities.dto.js';
import { auditReportDueDate } from '../documents/registrar-documents.service.js';
import { RegistrarDocumentsRepository } from '../documents/registrar-documents.repository.js';
import { REGISTRAR_DOCUMENT_TYPES } from '../documents/upload-rules.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  isSelectableFinancialYear,
  latestCompletedFinancialYear,
} from '../societies/financial-year.js';
import { MAP_POINT_LIMIT } from '../societies/societies.repository.js';
import { MEMBERSHIP_CATEGORY_VALUES } from '../societies/societies.service.js';
import { auditPastDue, pageMeta, percent, period } from './national-rules.js';
import { NationalRepository } from './national.repository.js';

const TOP_SDGS = 6;
const RECENT_ACTIVITIES = 6;
const OPEN_INCIDENTS = 3;

/** The financial year asked for, or the latest one that has ended. */
export function chosenYear(year: number | undefined, now = new Date()) {
  if (year === undefined) return latestCompletedFinancialYear(now);
  if (!isSelectableFinancialYear(year, now))
    throw new BadRequestException(
      'Choose one of the last five financial years',
    );
  return year;
}

function categoryTotals(
  rows: { category: string; female: number; male: number }[],
) {
  return MEMBERSHIP_CATEGORY_VALUES.map((category) => {
    const row = rows.find((entry) => entry.category === category);
    const female = row?.female ?? 0;
    const male = row?.male ?? 0;
    return { category, female, male, total: female + male };
  });
}

function dimensionTotals(
  rows: { dimension: string | null; planned: number; completed: number }[],
) {
  return ACTIVITY_DIMENSION_VALUES.map((dimension) => {
    const row = rows.find((entry) => entry.dimension === dimension);
    return {
      dimension,
      planned: row?.planned ?? 0,
      completed: row?.completed ?? 0,
    };
  });
}

/** All 17 goals: most completed first, equal counts by SDG number. */
export function rankSdgs(rows: { sdg: number; completed: number }[]) {
  return Array.from({ length: 17 }, (_, index) => ({
    sdg: index + 1,
    completed: rows.find((row) => row.sdg === index + 1)?.completed ?? 0,
  })).sort((a, b) => b.completed - a.completed || a.sdg - b.sdg);
}

/** V5 PR 5: the HQ National Dashboard and its drill-downs (HQ only). */
@Injectable()
export class NationalService {
  constructor(
    private readonly repository: NationalRepository,
    private readonly registrar: RegistrarDocumentsRepository,
  ) {}

  async overview(year: number | undefined, now = new Date()) {
    const startYear = chosenYear(year, now);
    const membershipYear = await this.repository.latestMembershipYear();
    const [
      societies,
      waiting,
      districts,
      membership,
      activities,
      finance,
      registrar,
      incidents,
    ] = await Promise.all([
      this.repository.societyCounts(now),
      this.repository.gradeRequestsWaiting(),
      this.repository.districts(startYear),
      membershipYear === null
        ? Promise.resolve(null)
        : this.repository.membership(membershipYear),
      this.repository.activities(startYear, now),
      this.repository.finance(startYear),
      this.registrar.nationalTotals(startYear),
      this.repository.openIncidents(OPEN_INCIDENTS),
    ]);
    const categories = categoryTotals(membership?.categories ?? []);
    const female = categories.reduce((sum, row) => sum + row.female, 0);
    const male = categories.reduce((sum, row) => sum + row.male, 0);
    const byDimension = dimensionTotals(activities.dimensions);

    return {
      financialYear: period(startYear),
      societies: {
        registered: societies.registered,
        active: societies.active,
        registeredNotActive: societies.registered - societies.active,
        grades: societies.grades,
        notUpdatedIn90Days: societies.stale,
        gradeRequestsWaiting: waiting,
        withoutLocation: societies.withoutLocation,
      },
      districts: districts.map((district) => ({
        id: district.id,
        name: district.name,
        active: district.active,
        latitude: district.latitude === null ? null : Number(district.latitude),
        longitude:
          district.longitude === null ? null : Number(district.longitude),
      })),
      membership: {
        year: membershipYear,
        female,
        male,
        total: female + male,
        societiesReported: membership?.societiesReported ?? 0,
        categories,
      },
      activities: {
        planned:
          byDimension.reduce((sum, row) => sum + row.planned, 0) +
          (activities.dimensions.find((row) => row.dimension === null)
            ?.planned ?? 0),
        completed:
          byDimension.reduce((sum, row) => sum + row.completed, 0) +
          (activities.dimensions.find((row) => row.dimension === null)
            ?.completed ?? 0),
        byDimension,
        topSdgs: rankSdgs(activities.sdgs)
          .filter((row) => row.completed > 0)
          .slice(0, TOP_SDGS),
      },
      finance: {
        activeSocieties: societies.active,
        totalProfit: finance.profit,
        totalExpenses: finance.expenses,
        societiesWithBoth: finance.both,
        notSubmitted: Math.max(0, societies.active - finance.both),
      },
      registrarDocuments: {
        activeSocieties: registrar.activeSocieties,
        allFour: registrar.allFour,
        auditReportDueOn: auditReportDueDate(startYear),
        pastDue: auditPastDue(startYear, now),
        byType: REGISTRAR_DOCUMENT_TYPES.map((documentType) => {
          const submitted = registrar.byType.get(documentType) ?? 0;
          return {
            documentType,
            submitted,
            missing: Math.max(0, registrar.activeSocieties - submitted),
          };
        }),
      },
      incidents: incidents.map((entry) => ({
        id: entry.incident.id,
        title: entry.incident.title,
        severity: entry.incident.severity,
        status: entry.incident.status,
        districtName: entry.incident.district.nameEn,
        activatedAt: entry.incident.activatedAt.toISOString(),
        societiesInArea: entry.societiesInArea,
        assessed: entry.assessed,
        peopleAffected: entry.peopleAffected,
        householdsAffected: entry.householdsAffected,
        actions: entry.actions,
        actionsCompleted: entry.actionsCompleted,
      })),
    };
  }

  async districts(year: number | undefined, now = new Date()) {
    const startYear = chosenYear(year, now);
    const membershipYear = await this.repository.latestMembershipYear();
    const [rows, membership] = await Promise.all([
      this.repository.districts(startYear),
      membershipYear === null
        ? Promise.resolve(null)
        : this.repository.membership(membershipYear),
    ]);
    const data = rows.map((row) => {
      const members = membership?.districts.find(
        (entry) => entry.id === row.id,
      );
      return {
        id: row.id,
        name: row.name,
        province: row.province,
        active: row.active,
        grades: { A: row.a, B: row.b, C: row.c, ungraded: row.ungraded },
        members: (members?.female ?? 0) + (members?.male ?? 0),
        recordsCompletePercent: percent(row.complete, row.active),
        auditPercent: percent(row.audited, row.active),
      };
    });
    const sum = (pick: (row: (typeof rows)[number]) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    return {
      financialYear: period(startYear),
      totals: {
        active: sum((row) => row.active),
        grades: {
          A: sum((row) => row.a),
          B: sum((row) => row.b),
          C: sum((row) => row.c),
          ungraded: sum((row) => row.ungraded),
        },
        recordsCompletePercent: percent(
          sum((row) => row.complete),
          sum((row) => row.active),
        ),
      },
      data,
    };
  }

  async map(input: { status?: 'ACTIVE' | 'ALL'; grade?: 'A' | 'B' | 'C' }) {
    const where: Prisma.SocietyWhereInput = {
      ...(input.status === 'ALL' ? {} : { status: 'ACTIVE' }),
      ...(input.grade ? { grade: input.grade } : {}),
    };
    const [counts, points] = await Promise.all([
      this.repository.mapCounts(),
      this.repository.mapPoints(where),
    ]);
    return {
      counts,
      points: points.slice(0, MAP_POINT_LIMIT).map((point) => ({
        id: point.id,
        name: point.nameEn,
        societyCode: point.societyCode,
        class:
          point.status !== 'ACTIVE'
            ? ('NOT_ACTIVE' as const)
            : (point.grade ?? ('UNGRADED' as const)),
        latitude: point.latitude!,
        longitude: point.longitude!,
        district: point.district.nameEn,
      })),
      truncated: points.length > MAP_POINT_LIMIT,
    };
  }

  async membership() {
    const year = await this.repository.latestMembershipYear();
    const [counts, districts, membership] = await Promise.all([
      this.repository.societyCounts(),
      this.repository.districts(latestCompletedFinancialYear()),
      year === null ? Promise.resolve(null) : this.repository.membership(year),
    ]);
    const categories = categoryTotals(membership?.categories ?? []);
    const female = categories.reduce((sum, row) => sum + row.female, 0);
    const male = categories.reduce((sum, row) => sum + row.male, 0);
    return {
      year,
      activeSocieties: counts.active,
      societiesReported: membership?.societiesReported ?? 0,
      female,
      male,
      total: female + male,
      categories,
      districts: districts.map((district) => {
        const row = membership?.districts.find(
          (entry) => entry.id === district.id,
        );
        const districtFemale = row?.female ?? 0;
        const districtMale = row?.male ?? 0;
        return {
          id: district.id,
          name: district.name,
          active: district.active,
          female: districtFemale,
          male: districtMale,
          total: districtFemale + districtMale,
        };
      }),
    };
  }

  async programmes(year: number | undefined, now = new Date()) {
    const startYear = chosenYear(year, now);
    const [activities, recent] = await Promise.all([
      this.repository.activities(startYear, now),
      this.repository.recentApprovedActivities(RECENT_ACTIVITIES),
    ]);
    const planned = activities.sectors.reduce(
      (sum, row) => sum + row.planned,
      0,
    );
    const done = activities.sectors.reduce(
      (sum, row) => sum + row.completed,
      0,
    );
    return {
      financialYear: period(startYear),
      planned,
      completed: done,
      sectors: activities.sectors
        .filter((row) => row.sector !== null)
        .map((row) => ({
          sector: row.sector!,
          planned: row.planned,
          completed: row.completed,
          societies: row.societies,
        })),
      byDimension: dimensionTotals(activities.dimensions),
      sdgs: rankSdgs(activities.sdgs),
      recent: recent.map((activity) => ({
        id: activity.id,
        name: activity.name,
        sector: activity.sector ?? '',
        dimension: activity.dimension ?? 'SOCIAL',
        society: { id: activity.society.id, name: activity.society.nameEn },
        approvedAt: activity.reviewedAt!.toISOString(),
        approvedBy: activity.reviewedByName,
        datesLabel: activity.datesLabel,
        year: activity.year,
        femaleParticipants: activity.femaleParticipants ?? 0,
        maleParticipants: activity.maleParticipants ?? 0,
        householdsBenefited: activity.householdsBenefited ?? 0,
        createdBy: activity.createdByName,
        sdgs: activity.sdgs.map((row) => row.sdg),
      })),
    };
  }

  async finance(
    input: { year?: number; page: number; pageSize: number },
    now = new Date(),
  ) {
    const startYear = chosenYear(input.year, now);
    const [counts, totals, notAdded] = await Promise.all([
      this.repository.societyCounts(now),
      this.repository.finance(startYear),
      this.repository.figuresNotAdded(startYear, input.page, input.pageSize),
    ]);
    return {
      financialYear: period(startYear),
      activeSocieties: counts.active,
      totalProfit: totals.profit,
      totalExpenses: totals.expenses,
      societiesWithBoth: totals.both,
      notSubmitted: notAdded.totalItems,
      notAdded: notAdded.societies.map((society) => ({
        id: society.id,
        name: society.nameEn,
        district: society.district.nameEn,
      })),
      meta: pageMeta(input.page, input.pageSize, notAdded.totalItems),
    };
  }
}
