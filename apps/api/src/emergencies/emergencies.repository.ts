import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EmergencyScope } from './emergency-access.policy.js';

export type SocietyStateFilter =
  'ALL' | 'NOT_ASSESSED' | 'AFFECTED' | 'CRITICAL' | 'SAFE';

export interface SocietyRowRecord {
  id: string;
  name: string;
  code: string;
  districtId: string;
  districtName: string;
  impact: 'SAFE' | 'AFFECTED' | 'CRITICAL' | null;
  families: number | null;
  people: number | null;
  housesFully: number | null;
  housesPartly: number | null;
  injured: number | null;
  displaced: number | null;
  roadAccess: 'OPEN' | 'PARTLY_BLOCKED' | 'CUT_OFF' | 'UNKNOWN' | null;
  needs: string[] | null;
  lastReceivedAt: Date | null;
  updates: number;
  photos: number;
  total: number;
}

export interface DistrictTotalsRecord {
  districtId: string;
  assessed: number;
  affected: number;
  critical: number;
  families: number;
  people: number;
  housesFully: number;
  housesPartly: number;
}

/** Societies in a scope, as SQL on the `societies` table aliased `s`. */
function scopeCondition(scope: EmergencyScope) {
  if (scope.national) return Prisma.sql`TRUE`;
  return Prisma.sql`(s.district_id = ANY(${scope.districtIds}::uuid[]) OR s.id = ANY(${scope.societyIds}::uuid[]))`;
}

/**
 * Grouped SQL for the incident views, so a page with 150 societies costs a
 * handful of queries, never one per society.
 */
@Injectable()
export class EmergenciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Active societies in each district of an area. */
  async societiesPerDistrict(districtIds: string[]) {
    if (!districtIds.length) return new Map<string, number>();
    const rows = await executeDatabaseOperation(() =>
      this.prisma.society.groupBy({
        by: ['districtId'],
        where: { districtId: { in: districtIds }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    );
    return new Map(rows.map((row) => [row.districtId, row._count._all]));
  }

  /** How many societies sent at least one assessment, per incident. */
  async assessedPerIncident(incidentIds: string[]) {
    if (!incidentIds.length) return new Map<string, number>();
    const rows = await executeDatabaseOperation(
      () => this.prisma.$queryRaw<{ incidentId: string; assessed: number }[]>`
        SELECT a.incident_id AS "incidentId", COUNT(DISTINCT a.society_id)::int AS assessed
        FROM emergency_assessments a
        WHERE a.incident_id = ANY(${incidentIds}::uuid[]) AND a.status = 'SUBMITTED'
        GROUP BY a.incident_id`,
    );
    return new Map(rows.map((row) => [row.incidentId, row.assessed]));
  }

  /** Counts from each society's latest assessment, by district. */
  async districtTotals(incidentId: string) {
    return executeDatabaseOperation(
      () => this.prisma.$queryRaw<DistrictTotalsRecord[]>`
        WITH latest AS (${latestFor(incidentId)})
        SELECT s.district_id AS "districtId",
               COUNT(*)::int AS assessed,
               COUNT(*) FILTER (WHERE l.impact <> 'SAFE')::int AS affected,
               COUNT(*) FILTER (WHERE l.impact = 'CRITICAL')::int AS critical,
               COALESCE(SUM(l.households_affected), 0)::int AS families,
               COALESCE(SUM(l.people_affected), 0)::int AS people,
               COALESCE(SUM(l.houses_fully_damaged), 0)::int AS "housesFully",
               COALESCE(SUM(l.houses_partly_damaged), 0)::int AS "housesPartly"
        FROM latest l
        JOIN societies s ON s.id = l.society_id
        GROUP BY s.district_id`,
    );
  }

  /** V5 D31 "Urgent needs": how many affected societies asked for each need. */
  async needCounts(incidentId: string) {
    return executeDatabaseOperation(
      () => this.prisma.$queryRaw<{ need: string; societies: number }[]>`
        WITH latest AS (${latestFor(incidentId)})
        SELECT n.need::text AS need, COUNT(*)::int AS societies
        FROM latest l, unnest(l.needs) AS n(need)
        WHERE l.impact <> 'SAFE'
        GROUP BY n.need
        ORDER BY societies DESC, need`,
    );
  }

  /** Response actions, and how many every helper has delivered. */
  async actionCounts(incidentId: string) {
    const rows = await executeDatabaseOperation(
      () => this.prisma.$queryRaw<{ total: number; delivered: number }[]>`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE h.helpers > 0 AND h.helpers = h.delivered)::int AS delivered
        FROM emergency_response_actions r
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS helpers, COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered
          FROM emergency_action_helpers WHERE action_id = r.id
        ) h ON TRUE
        WHERE r.incident_id = ${incidentId}::uuid`,
    );
    return rows[0] ?? { total: 0, delivered: 0 };
  }

  /**
   * One page of the area's societies inside the viewer's scope, each with its
   * latest assessment. Received assessments come first, newest first.
   */
  async societyRows(input: {
    incidentId: string;
    areaDistrictIds: string[];
    scope: EmergencyScope;
    state: SocietyStateFilter;
    societyIds?: string[];
    limit: number;
    offset: number;
  }) {
    const stateCondition =
      input.state === 'ALL'
        ? Prisma.sql`TRUE`
        : input.state === 'NOT_ASSESSED'
          ? Prisma.sql`l.id IS NULL`
          : Prisma.sql`l.impact::text = ${input.state}`;
    const onlySocieties = input.societyIds
      ? Prisma.sql`s.id = ANY(${input.societyIds}::uuid[])`
      : Prisma.sql`TRUE`;
    const rows = await executeDatabaseOperation(
      () => this.prisma.$queryRaw<SocietyRowRecord[]>`
        SELECT s.id, s.name_en AS name, s.society_code AS code,
               s.district_id AS "districtId", d.name_en AS "districtName",
               l.impact::text AS impact,
               l.households_affected AS families, l.people_affected AS people,
               l.houses_fully_damaged AS "housesFully", l.houses_partly_damaged AS "housesPartly",
               l.injured, l.displaced_people AS displaced, l.road_access::text AS "roadAccess",
               l.needs::text[] AS needs, l.created_at AS "lastReceivedAt",
               (SELECT COUNT(*)::int FROM emergency_assessments u
                  WHERE u.incident_id = ${input.incidentId}::uuid AND u.society_id = s.id AND u.status = 'SUBMITTED') AS updates,
               (SELECT COUNT(*)::int FROM emergency_evidence e
                  WHERE e.assessment_id = l.id AND e.uploaded_at IS NOT NULL) AS photos,
               COUNT(*) OVER ()::int AS total
        FROM societies s
        JOIN districts d ON d.id = s.district_id
        LEFT JOIN LATERAL (
          SELECT a.id, a.impact, a.households_affected, a.people_affected,
                 a.houses_fully_damaged, a.houses_partly_damaged, a.injured,
                 a.displaced_people, a.road_access, a.needs, a.created_at
          FROM emergency_assessments a
          WHERE a.incident_id = ${input.incidentId}::uuid AND a.society_id = s.id AND a.status = 'SUBMITTED'
          ORDER BY a.created_at DESC
          LIMIT 1
        ) l ON TRUE
        WHERE s.district_id = ANY(${input.areaDistrictIds}::uuid[])
          AND s.status = 'ACTIVE'
          AND ${scopeCondition(input.scope)}
          AND ${onlySocieties}
          AND ${stateCondition}
        ORDER BY l.created_at DESC NULLS LAST, s.name_en, s.id
        LIMIT ${input.limit} OFFSET ${input.offset}`,
    );
    return rows;
  }

  /** Societies in the area that have not sent an assessment yet (for reminders). */
  async notAssessedSocieties(incidentId: string, areaDistrictIds: string[]) {
    return executeDatabaseOperation(
      () => this.prisma.$queryRaw<{ id: string; districtId: string }[]>`
        SELECT s.id, s.district_id AS "districtId"
        FROM societies s
        WHERE s.district_id = ANY(${areaDistrictIds}::uuid[])
          AND s.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM emergency_assessments a
            WHERE a.incident_id = ${incidentId}::uuid AND a.society_id = s.id AND a.status = 'SUBMITTED'
          )`,
    );
  }
}

/** The latest received assessment for each society (one row per society). */
function latestFor(incidentId: string) {
  return Prisma.sql`
    SELECT DISTINCT ON (a.society_id)
           a.id, a.society_id, a.impact, a.households_affected, a.people_affected,
           a.houses_fully_damaged, a.houses_partly_damaged, a.needs, a.created_at
    FROM emergency_assessments a
    WHERE a.incident_id = ${incidentId}::uuid AND a.status = 'SUBMITTED'
    ORDER BY a.society_id, a.created_at DESC`;
}
