import { ForbiddenException, Injectable } from '@nestjs/common';
import type {
  HomeAccessGrant,
  HomeEndedGrant,
  HomeRole,
  HomeSocietyList,
  HomeSummary,
} from './home.types.js';

import { readableDistrictIds, type Principal } from '../auth/principal.js';
import { executeDatabaseOperation } from '../prisma/prisma-operation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DistrictAccessService } from '../identity/district-access.service.js';
import {
  financialYear,
  latestCompletedFinancialYear,
} from '../societies/financial-year.js';
import {
  composeHome,
  composeSocietyList,
  type HomeInput,
  type SocietyListQuery,
} from './home.compose.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Changes shown in "Latest in my societies". NIC views are never listed. */
const RECENT_LIMIT = 4;
const HIDDEN_ACTIONS = ['MEMBER_NIC_REVEALED', 'MEMBER_NIC_UPDATED'];

export function homeRoleOf(principal: Principal): HomeRole | null {
  if (principal.roles.includes('DISTRICT_MANAGER')) return 'DISTRICT_MANAGER';
  if (principal.roles.includes('DEPUTY_DISTRICT_MANAGER'))
    return 'DEPUTY_DISTRICT_MANAGER';
  if (principal.roles.includes('PROGRAMME_COORDINATOR'))
    return 'PROGRAMME_COORDINATOR';
  return null;
}

/**
 * V5 SP01, DD01 and DM01. The SPC and DDM see the societies assigned to
 * them; the DM sees every society in their district, view only. Every query
 * is limited to that scope, so the home never reveals other societies.
 */
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: DistrictAccessService,
  ) {}

  /** Active grants with names and counts, in the home's shape. */
  private async accessGrants(
    grants: Parameters<DistrictAccessService['views']>[0],
    now: Date,
  ): Promise<HomeAccessGrant[]> {
    return (await this.access.views(grants, now)).map((g) => ({
      id: g.id,
      deputyName: g.deputy.name,
      districtName: g.district.name,
      startsAt: g.startsAt,
      expiresAt: g.expiresAt,
      grantedByName: g.grantedBy.name,
      grantedAt: g.grantedAt,
      societiesOpened: g.societiesOpened,
      districtSocietyCount: g.district.societyCount,
    }));
  }

  /** V5 DD07: a DDM's last grant, if it ended in the last 7 days. */
  private async recentlyEnded(
    deputyId: string,
    now: Date,
  ): Promise<HomeEndedGrant | null> {
    if (!UUID.test(deputyId)) return null;
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const [grant] = await this.prisma.districtAccessGrant.findMany({
      where: {
        deputyId,
        OR: [
          { revokedAt: { gt: since, lte: now } },
          { revokedAt: null, expiresAt: { gt: since, lte: now } },
        ],
      },
      orderBy: { expiresAt: 'desc' },
      take: 1,
    });
    if (!grant) return null;
    const [view] = await this.access.views([grant], now);
    return {
      districtName: view!.district.name,
      grantedByName: view!.grantedBy.name,
      startsAt: view!.startsAt,
      expiresAt: view!.expiresAt,
      endedAt: (grant.revokedAt ?? grant.expiresAt).toISOString(),
      endedEarly: Boolean(grant.revokedAt),
    };
  }

  async summary(principal: Principal, now = new Date()): Promise<HomeSummary> {
    const role = homeRoleOf(principal);
    if (!role)
      throw new ForbiddenException(
        'The home is for SPCs, DDMs and District Managers',
      );
    return executeDatabaseOperation(() => this.load(role, principal, now));
  }

  /** SP02 / DD03 / DM02: the same scope as the home, filtered and paged. */
  async societies(
    principal: Principal,
    query: SocietyListQuery,
    now = new Date(),
  ): Promise<HomeSocietyList> {
    const role = homeRoleOf(principal);
    if (!role)
      throw new ForbiddenException(
        'The society list is for SPCs, DDMs and District Managers',
      );
    const delegated = readableDistrictIds(principal, now).filter((id) =>
      UUID.test(id),
    );
    const isDdm = role === 'DEPUTY_DISTRICT_MANAGER';
    const districtScope = isDdm && query.scope === 'DISTRICT';
    // DD04: the district list needs active temporary access, checked now.
    if (districtScope && !delegated.length)
      throw new ForbiddenException(
        'Your temporary district-wide view has ended',
      );
    return executeDatabaseOperation(async () => {
      const db = this.prisma;
      const myDistricts = principal.districtIds.filter((id) => UUID.test(id));
      const assigned = principal.societyIds.filter((id) => UUID.test(id));
      const [societies, district] = await Promise.all([
        db.society.findMany({
          where:
            role === 'DISTRICT_MANAGER'
              ? { districtId: { in: myDistricts } }
              : districtScope
                ? { districtId: { in: delegated } }
                : { id: { in: assigned } },
          select: {
            id: true,
            societyCode: true,
            nameEn: true,
            nameLocal: true,
            dsDivision: true,
            grade: true,
            status: true,
            memberCount: true,
            updatedAt: true,
          },
          orderBy: { nameEn: 'asc' },
        }),
        myDistricts[0]
          ? db.district.findUnique({
              where: { id: myDistricts[0] },
              select: { id: true, nameEn: true },
            })
          : null,
      ]);
      const ids = societies.map((s) => s.id);
      const grants = isDdm
        ? await db.districtAccessGrant.findMany({
            where: {
              deputyId: UUID.test(principal.id) ? principal.id : undefined,
              revokedAt: null,
              startsAt: { lte: now },
              expiresAt: { gt: now },
            },
            orderBy: { expiresAt: 'desc' },
            take: 1,
          })
        : [];
      const [access] = grants.length
        ? await this.accessGrants(grants, now)
        : [null];
      const [pending, accounts] = await Promise.all([
        db.gradeChangeRequest.findMany({
          where: { societyId: { in: ids }, status: 'PENDING' },
          select: {
            societyId: true,
            fromGrade: true,
            toGrade: true,
            requestedAt: true,
          },
        }),
        db.platformAccount.findMany({
          where: {
            status: 'ACTIVE',
            role: {
              in: [
                'SOCIETY_OFFICER',
                'PROGRAMME_COORDINATOR',
                'DEPUTY_DISTRICT_MANAGER',
              ],
            },
            societyIds: { hasSome: ids },
          },
          select: { id: true, displayName: true, role: true, societyIds: true },
          orderBy: { displayName: 'asc' },
        }),
      ]);
      return composeSocietyList(
        {
          role,
          now,
          district: district
            ? { id: district.id, name: district.nameEn }
            : null,
          societies: societies.map((s) => ({ ...s, grade: s.grade ?? null })),
          pendingGradeRequests: pending,
          accounts,
          scope: districtScope ? 'DISTRICT' : 'MINE',
          assigned: new Set(assigned),
          tabs: isDdm
            ? {
                mine: districtScope
                  ? await db.society.count({ where: { id: { in: assigned } } })
                  : societies.length,
                district: access ? access.districtSocietyCount : null,
              }
            : { mine: societies.length, district: null },
          access: access ?? null,
          recentlyEnded:
            isDdm && !access
              ? await this.recentlyEnded(principal.id, now)
              : null,
        },
        query,
      );
    });
  }

  private async load(role: HomeRole, principal: Principal, now: Date) {
    const db = this.prisma;
    const fyStart = latestCompletedFinancialYear(now);
    const fy = financialYear(fyStart);
    const planYear = now.getUTCFullYear() + 1;
    // Demonstration principals use readable ids; only real UUIDs reach the database.
    const myDistricts = principal.districtIds.filter((id) => UUID.test(id));
    const districtId = myDistricts[0] ?? null;

    const societyWhere =
      role === 'DISTRICT_MANAGER'
        ? { districtId: { in: myDistricts } }
        : { id: { in: principal.societyIds.filter((id) => UUID.test(id)) } };
    const [societies, district] = await Promise.all([
      db.society.findMany({
        where: societyWhere,
        select: {
          id: true,
          nameEn: true,
          grade: true,
          status: true,
          memberCount: true,
          updatedAt: true,
          districtId: true,
        },
        orderBy: { nameEn: 'asc' },
      }),
      districtId
        ? db.district.findUnique({
            where: { id: districtId },
            select: { id: true, nameEn: true },
          })
        : null,
    ]);
    const ids = societies.map((s) => s.id);
    const scopeDistricts = [
      ...new Set([
        ...societies.map((s) => s.districtId),
        ...(role === 'PROGRAMME_COORDINATOR' ? [] : myDistricts),
        ...readableDistrictIds(principal, now),
      ]),
    ].filter((id) => UUID.test(id));
    const delegated = readableDistrictIds(principal, now).filter((id) =>
      UUID.test(id),
    );

    const [
      pending,
      waiting,
      summaries,
      audits,
      planned,
      accounts,
      events,
      grants,
      incidents,
      districtViewCount,
    ] = await Promise.all([
      db.gradeChangeRequest.findMany({
        where: { societyId: { in: ids }, status: 'PENDING' },
        select: {
          societyId: true,
          fromGrade: true,
          toGrade: true,
          requestedAt: true,
        },
      }),
      role === 'PROGRAMME_COORDINATOR'
        ? db.workPlanActivity.findMany({
            where: { societyId: { in: ids }, status: 'WAITING_FOR_SPC' },
            select: { societyId: true, name: true },
            orderBy: { createdAt: 'asc' },
          })
        : [],
      db.annualFinancialSummary.findMany({
        where: {
          societyId: { in: ids },
          financialYear: fyStart,
          totalProfit: { not: null },
          totalExpenses: { not: null },
        },
        select: { societyId: true },
      }),
      db.societyDocument.findMany({
        where: {
          societyId: { in: ids },
          documentType: 'AUDIT_REPORT',
          financialYear: fyStart,
          status: { in: ['SUBMITTED', 'APPROVED'] },
        },
        select: { societyId: true },
        distinct: ['societyId'],
      }),
      db.workPlanActivity.findMany({
        where: { societyId: { in: ids }, year: planYear },
        select: { societyId: true },
        distinct: ['societyId'],
      }),
      db.platformAccount.findMany({
        where: {
          status: 'ACTIVE',
          role: {
            in: [
              'SOCIETY_OFFICER',
              'PROGRAMME_COORDINATOR',
              'DEPUTY_DISTRICT_MANAGER',
            ],
          },
          societyIds: { hasSome: ids },
        },
        select: { id: true, displayName: true, role: true, societyIds: true },
      }),
      role === 'PROGRAMME_COORDINATOR'
        ? db.platformAuditEvent.findMany({
            where: {
              societyId: { in: ids },
              action: { notIn: HIDDEN_ACTIONS },
            },
            orderBy: { createdAt: 'desc' },
            take: RECENT_LIMIT,
          })
        : [],
      db.districtAccessGrant.findMany({
        where: {
          revokedAt: null,
          startsAt: { lte: now },
          expiresAt: { gt: now },
          ...(role === 'DISTRICT_MANAGER'
            ? { districtId: { in: myDistricts } }
            : role === 'DEPUTY_DISTRICT_MANAGER' && UUID.test(principal.id)
              ? { deputyId: principal.id }
              : { id: { in: [] } }),
        },
        orderBy: { expiresAt: 'asc' },
      }),
      db.emergencyIncident.findMany({
        where: { districtId: { in: scopeDistricts }, status: 'ACTIVE' },
        include: { district: { select: { nameEn: true } } },
        orderBy: { activatedAt: 'desc' },
      }),
      role === 'DEPUTY_DISTRICT_MANAGER' && delegated.length
        ? db.society.count({ where: { districtId: { in: delegated } } })
        : null,
    ]);

    // Names for the people who opened incidents.
    const personIds = incidents
      .map((i) => i.createdById)
      .filter((id) => UUID.test(id));
    const people = personIds.length
      ? await db.platformAccount.findMany({
          where: { id: { in: [...new Set(personIds)] } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameOf = new Map(people.map((p) => [p.id, p.displayName]));
    const societyName = new Map(societies.map((s) => [s.id, s.nameEn]));

    const input: HomeInput = {
      role,
      now,
      financialYear: { startYear: fy.startYear, label: fy.label },
      planYear,
      district: district ? { id: district.id, name: district.nameEn } : null,
      societies: societies.map((s) => ({ ...s, grade: s.grade ?? null })),
      pendingGradeRequests: pending,
      waitingActivities: waiting,
      summariesDone: new Set(summaries.map((s) => s.societyId)),
      auditReportsDone: new Set(audits.map((d) => d.societyId)),
      plannedSocieties: new Set(planned.map((p) => p.societyId)),
      accounts,
      recent: events.map((e) => ({
        societyId: e.societyId,
        societyName: e.societyId
          ? (societyName.get(e.societyId) ?? null)
          : null,
        action: e.action,
        detail: e.detail,
        actorName: e.actorName,
        actorRole: e.actorRole,
        at: e.createdAt.toISOString(),
      })),
      temporaryAccess: await this.accessGrants(grants, now),
      districtViewCount,
      recentlyEnded:
        role === 'DEPUTY_DISTRICT_MANAGER' && !grants.length
          ? await this.recentlyEnded(principal.id, now)
          : null,
      incidents: incidents.map((i) => ({
        id: i.id,
        title: i.title,
        type: i.type,
        districtName: i.district.nameEn,
        openedAt: i.activatedAt.toISOString(),
        openedByName: nameOf.get(i.createdById) ?? null,
      })),
    };
    return composeHome(input);
  }
}
