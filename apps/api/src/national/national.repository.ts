import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAP_POINT_LIMIT } from '../societies/societies.repository.js';
import {
  RECORD_COMPLETE,
  approvedInYear,
  completed,
  staleCutoff,
} from './national-rules.js';

const int = (value: unknown) => Number(value ?? 0);

/**
 * Issue #117: the societies a DM, DDM or SPC may count. Whole districts (a
 * DM's own, or a DDM's while a temporary grant is valid) and named societies
 * (assignments). Both empty means nothing at all.
 */
export interface SocietyScope {
  districtIds: string[];
  societyIds: string[];
}

/** `a` is the work_plan_activities alias. */
function activityInScope(within: SocietyScope) {
  const parts = [
    within.districtIds.length
      ? Prisma.sql`s.district_id = ANY(${within.districtIds}::uuid[])`
      : null,
    within.societyIds.length
      ? Prisma.sql`s.id = ANY(${within.societyIds}::uuid[])`
      : null,
  ].filter((part) => part !== null);
  if (!parts.length) return Prisma.sql`FALSE`;
  return Prisma.sql`a.society_id IN (SELECT s.id FROM societies s WHERE ${Prisma.join(parts, ' OR ')})`;
}

function societyWhere(within: SocietyScope): Prisma.SocietyWhereInput {
  return {
    OR: [
      { districtId: { in: within.districtIds } },
      { id: { in: within.societyIds } },
    ],
  };
}

/**
 * PostgreSQL access for the national figures. Every count is a grouped query
 * over all societies, never a loop over them, so the cost does not grow with
 * the number of requests a page makes.
 */
@Injectable()
export class NationalRepository {
  constructor(private readonly prisma: PrismaService) {}

  private run<T>(operation: () => Promise<T>) {
    return executeDatabaseOperation(operation);
  }

  async societyCounts(now = new Date()) {
    const [row] = await this.run(
      () => this.prisma.$queryRaw<Record<string, number>[]>`
        SELECT COUNT(*)::int AS registered,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE')::int AS active,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE' AND s.grade = 'A')::int AS a,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE' AND s.grade = 'B')::int AS b,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE' AND s.grade = 'C')::int AS c,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE' AND s.grade IS NULL)::int AS ungraded,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE' AND s.updated_at < ${staleCutoff(now)})::int AS stale,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE' AND (s.latitude IS NULL OR s.longitude IS NULL))::int AS no_location,
          COUNT(*) FILTER (WHERE s.status = 'ACTIVE' AND ${RECORD_COMPLETE})::int AS complete
        FROM societies s`,
    );
    return {
      registered: int(row?.registered),
      active: int(row?.active),
      grades: {
        A: int(row?.a),
        B: int(row?.b),
        C: int(row?.c),
        ungraded: int(row?.ungraded),
      },
      stale: int(row?.stale),
      withoutLocation: int(row?.no_location),
      recordsComplete: int(row?.complete),
    };
  }

  gradeRequestsWaiting() {
    return this.run(() =>
      this.prisma.gradeChangeRequest.count({ where: { status: 'PENDING' } }),
    );
  }

  /** One row per district, alphabetical: active societies, grades, records and audit reports. */
  districts(startYear: number) {
    return this.run(
      () => this.prisma.$queryRaw<
        {
          id: string;
          name: string;
          province: string | null;
          active: number;
          a: number;
          b: number;
          c: number;
          ungraded: number;
          complete: number;
          audited: number;
          latitude: number | null;
          longitude: number | null;
        }[]
      >`
        SELECT d.id, d.name_en AS name, d.province,
          COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE')::int AS active,
          COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.grade = 'A')::int AS a,
          COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.grade = 'B')::int AS b,
          COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.grade = 'C')::int AS c,
          COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.grade IS NULL)::int AS ungraded,
          COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND ${RECORD_COMPLETE})::int AS complete,
          COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND EXISTS (
            SELECT 1 FROM society_documents doc
            WHERE doc.society_id = s.id AND doc.document_type = 'AUDIT_REPORT'
              AND doc.financial_year_start = ${startYear} AND doc.uploaded_at IS NOT NULL
          ))::int AS audited,
          AVG(s.latitude) FILTER (WHERE s.status = 'ACTIVE' AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL) AS latitude,
          AVG(s.longitude) FILTER (WHERE s.status = 'ACTIVE' AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL) AS longitude
        FROM districts d
        LEFT JOIN societies s ON s.district_id = d.id
        GROUP BY d.id
        ORDER BY d.name_en`,
    );
  }

  /** The latest year with membership counts from active societies. */
  async latestMembershipYear() {
    const [row] = await this.run(
      () => this.prisma.$queryRaw<{ year: number | null }[]>`
        SELECT MAX(m.year)::int AS year
        FROM society_membership_counts m
        JOIN societies s ON s.id = m.society_id AND s.status = 'ACTIVE'`,
    );
    return row?.year ?? null;
  }

  async membership(year: number) {
    const [categories, reported, districts] = await this.run(() =>
      Promise.all([
        this.prisma.$queryRaw<
          { category: string; female: number; male: number }[]
        >`
          SELECT m.category::text AS category,
            SUM(m.female)::int AS female, SUM(m.male)::int AS male
          FROM society_membership_counts m
          JOIN societies s ON s.id = m.society_id AND s.status = 'ACTIVE'
          WHERE m.year = ${year}
          GROUP BY m.category`,
        this.prisma.$queryRaw<{ societies: number }[]>`
          SELECT COUNT(DISTINCT m.society_id)::int AS societies
          FROM society_membership_counts m
          JOIN societies s ON s.id = m.society_id AND s.status = 'ACTIVE'
          WHERE m.year = ${year} AND (m.female > 0 OR m.male > 0)`,
        this.prisma.$queryRaw<{ id: string; female: number; male: number }[]>`
          SELECT s.district_id AS id,
            SUM(m.female)::int AS female, SUM(m.male)::int AS male
          FROM society_membership_counts m
          JOIN societies s ON s.id = m.society_id AND s.status = 'ACTIVE'
          WHERE m.year = ${year}
          GROUP BY s.district_id`,
      ]),
    );
    return {
      categories,
      societiesReported: reported[0]?.societies ?? 0,
      districts,
    };
  }

  /**
   * Approved activities in the financial year by dimension and sector, and UN
   * SDGs. `within` limits them to some societies (issue #117); without it the
   * figures are national, for HQ.
   */
  async activities(startYear: number, now = new Date(), within?: SocietyScope) {
    const scope = within
      ? Prisma.sql`${approvedInYear(startYear)} AND ${activityInScope(within)}`
      : approvedInYear(startYear);
    const done = completed(now);
    const [dimensions, sectors, sdgs] = await this.run(() =>
      Promise.all([
        this.prisma.$queryRaw<
          { dimension: string | null; planned: number; completed: number }[]
        >`
          SELECT a.dimension::text AS dimension, COUNT(*)::int AS planned,
            COUNT(*) FILTER (WHERE ${done})::int AS completed
          FROM work_plan_activities a WHERE ${scope}
          GROUP BY a.dimension`,
        this.prisma.$queryRaw<
          {
            sector: string | null;
            planned: number;
            completed: number;
            societies: number;
          }[]
        >`
          SELECT a.sector, COUNT(*)::int AS planned,
            COUNT(*) FILTER (WHERE ${done})::int AS completed,
            COUNT(DISTINCT a.society_id)::int AS societies
          FROM work_plan_activities a WHERE ${scope}
          GROUP BY a.sector`,
        this.prisma.$queryRaw<{ sdg: number; completed: number }[]>`
          SELECT g.sdg::int AS sdg, COUNT(*)::int AS completed
          FROM work_plan_activity_sdgs g
          JOIN work_plan_activities a ON a.id = g.activity_id
          WHERE ${scope} AND ${done}
          GROUP BY g.sdg`,
      ]),
    );
    return { dimensions, sectors, sdgs };
  }

  /**
   * The latest approved activities in the financial year, by the same April to
   * March rule as `approvedInYear`, so the list never shows an activity the
   * year's totals leave out.
   */
  recentApprovedActivities(
    startYear: number,
    limit: number,
    within?: SocietyScope,
  ) {
    return this.run(() =>
      this.prisma.workPlanActivity.findMany({
        where: {
          status: 'APPROVED',
          reviewedAt: { not: null },
          OR: [
            { year: startYear, month: { gte: 4 } },
            { year: startYear + 1, month: { lt: 4 } },
          ],
          ...(within ? { society: societyWhere(within) } : {}),
        },
        include: {
          sdgs: { orderBy: { sdg: 'asc' } },
          society: { select: { id: true, nameEn: true } },
        },
        orderBy: [{ reviewedAt: 'desc' }, { id: 'asc' }],
        take: limit,
      }),
    );
  }

  /** Issue #117: how many societies, and which districts, a scope covers. */
  async scopeSummary(within: SocietyScope) {
    const [societies, districts] = await this.run(() =>
      Promise.all([
        this.prisma.society.count({ where: societyWhere(within) }),
        this.prisma.district.findMany({
          where: { id: { in: within.districtIds } },
          select: { id: true, nameEn: true },
          orderBy: { nameEn: 'asc' },
        }),
      ]),
    );
    return { societies, districts };
  }

  async finance(startYear: number) {
    const [row] = await this.run(
      () => this.prisma.$queryRaw<
        { profit: string; expenses: string; both: number }[]
      >`
        SELECT COALESCE(SUM(f.total_profit), 0)::text AS profit,
          COALESCE(SUM(f.total_expenses), 0)::text AS expenses,
          COUNT(*) FILTER (WHERE f.total_profit IS NOT NULL AND f.total_expenses IS NOT NULL)::int AS both
        FROM annual_financial_summaries f
        JOIN societies s ON s.id = f.society_id AND s.status = 'ACTIVE'
        WHERE f.financial_year_start = ${startYear}`,
    );
    return {
      profit: row?.profit ?? '0',
      expenses: row?.expenses ?? '0',
      both: int(row?.both),
    };
  }

  /** Active societies that have not entered both yearly figures, by name. */
  async figuresNotAdded(startYear: number, page: number, pageSize: number) {
    const where: Prisma.SocietyWhereInput = {
      status: 'ACTIVE',
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
    const [societies, totalItems] = await this.run(() =>
      this.prisma.$transaction([
        this.prisma.society.findMany({
          where,
          select: {
            id: true,
            nameEn: true,
            district: { select: { nameEn: true } },
          },
          orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.society.count({ where }),
      ]),
    );
    return { societies, totalItems };
  }

  /** Incidents that are not closed, newest first, with their counts. */
  async openIncidents(limit: number) {
    const incidents = await this.run(() =>
      this.prisma.emergencyIncident.findMany({
        where: { status: { not: 'CLOSED' } },
        include: { district: { select: { nameEn: true } } },
        orderBy: [{ activatedAt: 'desc' }, { id: 'asc' }],
        take: limit,
      }),
    );
    if (incidents.length === 0) return [];
    const ids = incidents.map((incident) => incident.id);
    const [assessments, actions, societies] = await this.run(() =>
      Promise.all([
        this.prisma.$queryRaw<
          { id: string; assessed: number; people: number; households: number }[]
        >`
          SELECT incident_id AS id, COUNT(DISTINCT society_id)::int AS assessed,
            COALESCE(SUM(people_affected), 0)::int AS people,
            COALESCE(SUM(households_affected), 0)::int AS households
          FROM emergency_assessments
          WHERE status = 'SUBMITTED' AND incident_id IN (${Prisma.join(ids)})
          GROUP BY incident_id`,
        this.prisma.$queryRaw<{ id: string; total: number; done: number }[]>`
          SELECT incident_id AS id, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS done
          FROM emergency_response_actions
          WHERE status <> 'CANCELLED' AND incident_id IN (${Prisma.join(ids)})
          GROUP BY incident_id`,
        this.prisma.society.groupBy({
          by: ['districtId'],
          where: {
            status: 'ACTIVE',
            districtId: {
              in: incidents.map((incident) => incident.districtId),
            },
          },
          _count: { _all: true },
        }),
      ]),
    );
    return incidents.map((incident) => {
      const assessment = assessments.find((row) => row.id === incident.id);
      const action = actions.find((row) => row.id === incident.id);
      return {
        incident,
        societiesInArea:
          societies.find((row) => row.districtId === incident.districtId)
            ?._count._all ?? 0,
        assessed: assessment?.assessed ?? 0,
        peopleAffected: assessment?.people ?? 0,
        householdsAffected: assessment?.households ?? 0,
        actions: action?.total ?? 0,
        actionsCompleted: action?.done ?? 0,
      };
    });
  }

  /** D15: per district, active societies with each Registrar document for the year. */
  districtDocuments(startYear: number) {
    return this.run(
      () => this.prisma.$queryRaw<
        { id: string; type: string; societies: number }[]
      >`
        SELECT s.district_id AS id, d.document_type::text AS type,
          COUNT(DISTINCT d.society_id)::int AS societies
        FROM society_documents d
        JOIN societies s ON s.id = d.society_id AND s.status = 'ACTIVE'
        WHERE d.financial_year_start = ${startYear} AND d.uploaded_at IS NOT NULL
        GROUP BY s.district_id, d.document_type`,
    );
  }

  /** D15: per district, both yearly figures added and their totals. */
  districtFinance(startYear: number) {
    return this.run(
      () => this.prisma.$queryRaw<
        { id: string; both: number; profit: string; expenses: string }[]
      >`
        SELECT s.district_id AS id,
          COUNT(*) FILTER (WHERE f.total_profit IS NOT NULL AND f.total_expenses IS NOT NULL)::int AS both,
          COALESCE(SUM(f.total_profit), 0)::text AS profit,
          COALESCE(SUM(f.total_expenses), 0)::text AS expenses
        FROM annual_financial_summaries f
        JOIN societies s ON s.id = f.society_id AND s.status = 'ACTIVE'
        WHERE f.financial_year_start = ${startYear}
        GROUP BY s.district_id`,
    );
  }

  /** D15 data quality: per district, stale records and records without a map position. */
  districtDataQuality(now = new Date()) {
    return this.run(
      () => this.prisma.$queryRaw<
        { id: string; stale: number; no_location: number }[]
      >`
        SELECT s.district_id AS id,
          COUNT(*) FILTER (WHERE s.updated_at < ${staleCutoff(now)})::int AS stale,
          COUNT(*) FILTER (WHERE s.latitude IS NULL OR s.longitude IS NULL)::int AS no_location
        FROM societies s
        WHERE s.status = 'ACTIVE'
        GROUP BY s.district_id`,
    );
  }

  /** D03: societies with a recorded position. */
  mapPoints(where: Prisma.SocietyWhereInput) {
    return this.run(() =>
      this.prisma.society.findMany({
        where: { ...where, latitude: { not: null }, longitude: { not: null } },
        select: {
          id: true,
          nameEn: true,
          societyCode: true,
          status: true,
          grade: true,
          latitude: true,
          longitude: true,
          district: { select: { nameEn: true } },
        },
        orderBy: { id: 'asc' },
        take: MAP_POINT_LIMIT + 1,
      }),
    );
  }

  async mapCounts() {
    const [row] = await this.run(
      () => this.prisma.$queryRaw<Record<string, number>[]>`
        SELECT
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND grade = 'A')::int AS a,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND grade = 'B')::int AS b,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND grade = 'C')::int AS c,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND grade IS NULL)::int AS ungraded,
          COUNT(*) FILTER (WHERE status <> 'ACTIVE')::int AS not_active,
          COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL)::int AS no_location
        FROM societies`,
    );
    return {
      A: int(row?.a),
      B: int(row?.b),
      C: int(row?.c),
      ungraded: int(row?.ungraded),
      notActive: int(row?.not_active),
      withoutLocation: int(row?.no_location),
    };
  }
}
